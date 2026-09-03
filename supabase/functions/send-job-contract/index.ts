/**
 * send-job-contract (Contract Desk PR 2): the office sends a job contract for
 * signature — by email, or by minting the link to copy/text. Staff JWT in the
 * Authorization header; the row is read through the caller's RLS so only the
 * office set that can see the contract can send it. The link is durable: the
 * first send mints the plaintext token (the bid-room / portal-links
 * precedent), every later send reuses it and refreshes the expiry.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import {
  amountCentsFromFields,
  appOrigin,
  contractHeading,
  corsHeaders,
  escapeHtml,
  formatMoney,
  isValidEmail,
  JOB_CONTRACT_LINK_DAYS,
  JOB_CONTRACT_REMINDER_DAYS,
  jobNumberLabel,
  json,
  randomUrlToken,
  signingUrl,
} from '../_shared/jobContract.ts'

type Body = {
  contract_id?: string
  mode?: 'email' | 'link'
  recipient_email?: string
  recipient_name?: string
  cc_emails?: string[]
  public_origin?: string
  message?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) return json({ error: 'Server misconfigured' }, 500)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt)
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = (await req.json().catch(() => ({}))) as Body
    const contractId = (body.contract_id ?? '').trim()
    const mode: 'email' | 'link' = body.mode === 'link' ? 'link' : 'email'
    if (!contractId) return json({ error: 'contract_id required' }, 400)

    const { data: row, error: selErr } = await userClient
      .from('job_contracts')
      .select(
        'id, job_id, status, revision, public_token, public_token_expires_at, recipient_name, recipient_email, recipient_phone, cc_emails, send_count, sent_at, fields, body_html, template_name, reminders_enabled, voided_at',
      )
      .eq('id', contractId)
      .maybeSingle()
    if (selErr || !row) return json({ error: 'Contract not found or access denied' }, 403)
    const c = row as {
      id: string
      job_id: string
      status: string
      revision: number
      public_token: string | null
      public_token_expires_at: string | null
      recipient_name: string | null
      recipient_email: string | null
      recipient_phone: string | null
      cc_emails: string[] | null
      send_count: number
      sent_at: string | null
      fields: unknown
      body_html: string | null
      template_name: string | null
      reminders_enabled: boolean
      voided_at: string | null
    }
    if (c.voided_at || c.status === 'voided') return json({ error: 'This contract was voided. Start a new one.' }, 409)
    if (c.status === 'signed') return json({ error: 'This contract is already signed.' }, 409)
    if (!(c.body_html ?? '').trim()) return json({ error: 'Add the terms before sending.' }, 400)

    const recipientEmail = (body.recipient_email ?? c.recipient_email ?? '').trim()
    const recipientName = (body.recipient_name ?? c.recipient_name ?? '').trim()
    if (mode === 'email' && !isValidEmail(recipientEmail)) return json({ error: 'A valid recipient email is required.' }, 400)
    const cc = (Array.isArray(body.cc_emails) ? body.cc_emails : c.cc_emails ?? [])
      .map((e) => String(e ?? '').trim())
      .filter((e) => e && isValidEmail(e))
      .slice(0, 10)

    const { data: jobRow } = await userClient
      .from('jobs_ledger')
      .select('id, hcp_number, click_number, job_name, job_address, customer_name')
      .eq('id', c.job_id)
      .maybeSingle()
    const job = (jobRow ?? { id: c.job_id, hcp_number: null, click_number: null, job_name: null, job_address: null, customer_name: null }) as {
      id: string
      hcp_number: string | null
      click_number: string | null
      job_name: string | null
      job_address: string | null
      customer_name: string | null
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const token = (c.public_token ?? '').trim() || randomUrlToken()
    const nowIso = new Date().toISOString()
    const expiresAt = new Date(Date.now() + JOB_CONTRACT_LINK_DAYS * 86_400_000).toISOString()
    const nextReminder = c.reminders_enabled ? new Date(Date.now() + JOB_CONTRACT_REMINDER_DAYS * 86_400_000).toISOString() : null

    const { data: updated, error: upErr } = await admin
      .from('job_contracts')
      .update({
        status: 'sent',
        public_token: token,
        public_token_expires_at: expiresAt,
        sent_at: c.sent_at ?? nowIso,
        last_sent_at: nowIso,
        send_count: (c.send_count ?? 0) + 1,
        recipient_email: recipientEmail || c.recipient_email,
        recipient_name: recipientName || c.recipient_name,
        cc_emails: cc,
        next_reminder_at: nextReminder,
      })
      .eq('id', c.id)
      .in('status', ['draft', 'sent'])
      .select('id')
    if (upErr || !updated?.length) {
      console.error(upErr)
      return json({ error: 'Could not activate the signing link' }, 500)
    }

    const origin = appOrigin(body.public_origin)
    const url = signingUrl(origin, token)
    const heading = contractHeading(job)
    const jobNo = jobNumberLabel(job)
    const amount = amountCentsFromFields(c.fields)

    await admin.from('job_contract_events').insert({
      contract_id: c.id,
      event_type: 'sent',
      metadata: { channel: mode, to: mode === 'email' ? recipientEmail : null, revision: c.revision },
      actor_user_id: user.id,
    })

    if (mode === 'link') return json({ ok: true, emailed: false, sign_url: url })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return json({ ok: true, emailed: false, sign_url: url, warning: 'RESEND_API_KEY not set; link not emailed' })

    const { data: senderRow } = await admin.from('users').select('email, name').eq('id', user.id).maybeSingle()
    const senderEmail = (senderRow as { email?: string | null } | null)?.email ?? null
    const senderName = ((senderRow as { name?: string | null } | null)?.name ?? '').trim()

    const message = (body.message ?? '').trim().slice(0, 4000)
    const greeting = recipientName ? `Hi ${recipientName.split(' ')[0]},` : 'Hello,'
    const subject = `Please sign: ${heading} — Job #${jobNo}`
    const amountLine = amount != null ? `Contract amount: ${formatMoney(amount)}` : ''
    const textPlain =
      `${greeting}\n\n` +
      `${message || `Here is your service agreement for ${job.job_address || 'your project'}. It takes about a minute to review and sign on your phone.`}\n\n` +
      `${heading}\nJob #${jobNo}${amountLine ? `\n${amountLine}` : ''}\n\n` +
      `Review and sign here:\n${url}\n\n` +
      `Questions? Just reply to this email.${senderName ? `\n\n— ${senderName}` : ''}\n`
    const html =
      `<p>${escapeHtml(greeting)}</p>` +
      `<p>${escapeHtml(message || `Here is your service agreement for ${job.job_address || 'your project'}. It takes about a minute to review and sign on your phone.`).replace(/\n/g, '<br>')}</p>` +
      `<p><strong>${escapeHtml(heading)}</strong><br>Job #${escapeHtml(jobNo)}${amountLine ? `<br>${escapeHtml(amountLine)}` : ''}</p>` +
      `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#c2410c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Review &amp; sign</a></p>` +
      `<p style="color:#6b7280;font-size:13px">Or open this link: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` +
      `<p>Questions? Just reply to this email.${senderName ? `<br>— ${escapeHtml(senderName)}` : ''}</p>`

    const sent = await sendEmailViaResend(recipientEmail, subject, textPlain, html, resendKey, {
      ...(senderEmail ? { replyTo: senderEmail } : {}),
      ...(cc.length > 0 ? { cc } : {}),
    })
    if (!sent.success) return json({ ok: true, emailed: false, sign_url: url, email_error: sent.error })
    return json({ ok: true, emailed: true, sign_url: url })
  } catch (e) {
    console.error(e)
    return json({ error: 'Internal error' }, 500)
  }
})
