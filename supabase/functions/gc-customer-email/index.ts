import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { fileSentEmailBestEffort } from '../_shared/fileSentCopy.ts'
import { EMAIL_FROM } from '../_shared/emailFrom.ts'
import { mailboxWithName } from '../_shared/mailboxWithName.ts'
import { customerBillingEmail } from '../_shared/billToParty.ts'
import {
  buildGcCustomerEmail,
  CUSTOMER_EMAIL_ERRORS,
  GC_CUSTOMER_EMAIL_FILED_AS,
  GC_CUSTOMER_EMAIL_FROM_NAME,
  GC_CUSTOMER_EMAIL_ROLES,
  GC_CUSTOMER_EMAIL_TO,
  parseCustomerEmail,
  type CustomerEmailErrorKey,
} from '../_shared/gcCustomerEmails.ts'

/**
 * gc-customer-email — GC mode, Owner Billing's O4b: our emails to a GC project's customer and its architect, from one
 * sender (plan `to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md` → Edge functions, on spike/gc-mode). The window writes the
 * words; this frames them, sends and files the sent copy. O4b-1's kinds: `pay_app` (to the customer, the form
 * attached) and `certify_ask` (to the architect, the form attached).
 *
 *   POST { projectId, kind, sourceId, subject, lines, pdf? }   staff JWT
 *     → { to, email, resendEmailId }
 *     → { error: key } with CUSTOMER_EMAIL_ERRORS' status
 *
 * In order: the caller (the money team; never a training account or a digital twin), the shape, the project, the pay
 * application (this project's, and sent), who gets the kind (the customer's billing email, else its contact email; the
 * architect's the same way), the email, the send, then its sent copy (docs/SENT_COPIES.md, kind `bill_gc_pay_app`,
 * source `gc_owner_pay_apps`, on the billing job). The service role reads here, so the read-only blocks and the twin fence never see it. Nothing
 * is written but the send's own log and copy: the sent copies are the record of what went.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, EMAIL_FROM.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const refuse = (key: CustomerEmailErrorKey, detail?: string) => json({ error: key, ...(detail ? { detail } : {}) }, CUSTOMER_EMAIL_ERRORS[key])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'badRequest' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!serviceRoleKey) return refuse('failed', 'SUPABASE_SERVICE_ROLE_KEY is not set')
    if (!resendApiKey) return refuse('failed', 'Email is not configured yet: set RESEND_API_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey)

    // The caller: a staff session on the money team, never a training account or a twin.
    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return refuse('signIn')
    const { data: who } = await admin.from('users').select('role, name, email, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who || !GC_CUSTOMER_EMAIL_ROLES.includes(String(who.role))) return refuse('moneyTeamOnly')
    if (who.read_only || who.is_digital_twin) return refuse('readOnly')

    const parsed = parseCustomerEmail(await req.json().catch(() => null))
    if (!parsed.ok) return refuse('badRequest')
    const m = parsed.req

    const { data: project } = await admin.from('projects').select('id, name, customer_id').eq('id', m.projectId).maybeSingle()
    const { data: gc } = await admin.from('gc_projects').select('architect_customer_id, project_manager_user_id, billing_job_id').eq('project_id', m.projectId).maybeSingle()
    if (!project || !gc) return refuse('notFound')

    // The pay application: this project's, and sent (every row is, once it exists: gc_send_owner_pay_app files it as it goes).
    const { data: app } = await admin.from('gc_owner_pay_apps').select('id, project_id, number').eq('id', m.sourceId).maybeSingle()
    if (!app) return refuse('notFound')
    if (app.project_id !== m.projectId) return refuse('notSent')

    // Who gets it: the project's customer, or its architect, at the address the Pipeline bills.
    const to = GC_CUSTOMER_EMAIL_TO[m.kind]
    const recipientId = to === 'customer' ? project.customer_id : gc.architect_customer_id
    const { data: recipient } = recipientId
      ? await admin.from('customers').select('id, name, billing_email, contact_info').eq('id', recipientId).maybeSingle()
      : { data: null }
    const address = recipient ? customerBillingEmail(recipient) : ''
    if (!recipient || !address) return refuse('noEmail')

    const pm = gc.project_manager_user_id ? (await admin.from('users').select('name, email').eq('id', gc.project_manager_user_id).maybeSingle()).data : null
    const replyTo = (pm?.email || who.email || '').trim() || undefined
    const signer = (pm?.name || who.name || GC_CUSTOMER_EMAIL_FROM_NAME).trim()
    const email = buildGcCustomerEmail({ subject: m.subject, lines: m.lines, signer, gc: GC_CUSTOMER_EMAIL_FROM_NAME })

    const from = mailboxWithName(GC_CUSTOMER_EMAIL_FROM_NAME, EMAIL_FROM)
    const attachments = m.pdf ? [{ filename: m.pdf.filename, content: m.pdf.base64 }] : undefined
    const sent = await sendEmailViaResend(address, email.subject, email.text, email.html, resendApiKey, {
      from,
      ...(replyTo ? { replyTo } : {}),
      ...(attachments ? { attachments } : {}),
      emailType: 'gc_customer_email',
    })
    if (!sent.success) return refuse('sendFailed', sent.error ?? 'Resend said no')

    // Sent copies (docs/SENT_COPIES.md): the message and the form as they went, found by the pay application and on the
    // billing job's Documents tab.
    await fileSentEmailBestEffort(
      {
        kind: GC_CUSTOMER_EMAIL_FILED_AS[m.kind],
        title: email.subject,
        recipientName: String(recipient.name ?? ''),
        customerId: recipient.id,
        jobIds: gc.billing_job_id ? [gc.billing_job_id] : [],
        source: { table: 'gc_owner_pay_apps', id: app.id },
        sentBy: u.user.id,
      },
      { to: [address], from, subject: email.subject, html: email.html, attachments, resendEmailId: sent.resendEmailId ?? null },
    )
    return json({ to: String(recipient.name ?? ''), email: address, resendEmailId: sent.resendEmailId ?? null })
  } catch (e) {
    return refuse('failed', e instanceof Error ? e.message : String(e))
  }
})
