import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { officeYmd } from '../_shared/bidFollowupReminder.ts'
import { buildGcPlanQuestionEmail } from '../_shared/gcPlanQuestionEmail.ts'

/**
 * gc-plan-question-email — GC mode, the real build, step 8 (to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md
 * on spike/gc-mode). The office sends a company's question about the plans to the project's
 * architect by email, with the project manager (else the sender) as Reply-To, and the send is
 * recorded on the question (sent_to_architect_on). The architect is a customer row; its email is
 * the contact_info's email. The answer is typed back into the app by the office.
 *
 *   POST { question_id }   staff JWT, office roles → { success, to, sent_on }
 *
 * Never a training account or a digital twin (door 1, v2.4832): the service role sends and writes
 * here, so the read-only blocks and the twin fence never see it.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const OFFICE_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']

function contactEmail(ci: unknown): string {
  if (ci && typeof ci === 'object' && typeof (ci as { email?: unknown }).email === 'string') return String((ci as { email: string }).email).trim()
  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, 500)
    if (!resendApiKey) return json({ error: 'Email is not configured yet: set RESEND_API_KEY' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const auth = req.headers.get('Authorization') ?? ''
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await anon.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)
    const { data: who } = await admin.from('users').select('role, name, email, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who || !OFFICE_ROLES.includes(String(who.role))) return json({ error: 'Office only.' }, 403)
    if (who.read_only) return json({ error: 'A training account cannot send email.' }, 403)
    if (who.is_digital_twin) return json({ error: 'A digital twin cannot send email.' }, 403)

    const body = (await req.json().catch(() => ({}))) as { question_id?: string }
    const questionId = String(body.question_id ?? '').trim()
    if (!questionId) return json({ error: 'question_id is required' }, 400)

    const { data: q } = await admin.from('gc_plan_questions').select('id, project_id, package_id, asked_by_name, text, sheets, asked_on, sent_to_architect_on, answered_on').eq('id', questionId).maybeSingle()
    if (!q) return json({ error: 'No question with that id.' }, 404)
    if (q.answered_on) return json({ error: 'That question is answered already.' }, 400)
    const { data: project } = await admin.from('projects').select('id, name, address').eq('id', q.project_id).maybeSingle()
    const { data: gc } = await admin.from('gc_projects').select('architect_customer_id, project_manager_user_id').eq('project_id', q.project_id).maybeSingle()
    if (!project || !gc) return json({ error: 'No GC project with that id.' }, 404)
    if (!gc.architect_customer_id) return json({ error: 'The project has no architect on record. Add one on the project first.' }, 400)
    const { data: architect } = await admin.from('customers').select('id, name, contact_info').eq('id', gc.architect_customer_id).maybeSingle()
    const to = contactEmail(architect?.contact_info)
    if (!architect || !to) return json({ error: `${architect?.name ?? 'The architect'} has no email on record. Add it on the customer first.` }, 400)
    const trade = q.package_id ? (await admin.from('gc_trade_packages').select('trade').eq('id', q.package_id).maybeSingle()).data?.trade ?? null : null
    const pm = gc.project_manager_user_id ? (await admin.from('users').select('name, email').eq('id', gc.project_manager_user_id).maybeSingle()).data : null
    const replyTo = (pm?.email || who.email || '').trim() || undefined
    const signer = (pm?.name || who.name || 'Click Construction').trim()

    const about = (q.sheets as string[] | null)?.length ? `${(q.sheets as string[]).join(', ')}${trade ? `, ${trade}` : ''}` : trade ?? 'the plans'
    const { subject, text: textPlain, html: htmlBody } = buildGcPlanQuestionEmail({
      architectName: architect.name,
      projectName: project.name,
      projectAddress: project.address ?? null,
      askedByName: String(q.asked_by_name ?? ''),
      about,
      text: String(q.text),
      signer,
      companyName: 'Click Construction',
    })
    const sent = await sendEmailViaResend(to, subject, textPlain, htmlBody, resendApiKey, {
      ...(replyTo ? { replyTo } : {}),
      emailType: 'gc_plan_question',
      // Sent copies (docs/SENT_COPIES.md): the question as it went to the architect, on the architect's customer record and the question's row.
      file: { kind: 'gc_plan_question', title: `Question about the plans: ${project.name}`, recipientName: architect.name, customerId: architect.id, source: { table: 'gc_plan_questions', id: q.id }, sentBy: u.user.id },
    })
    if (!sent.success) return json({ error: `The email was not sent: ${sent.error ?? 'Resend said no'}` }, 502)
    const today = officeYmd(new Date().toISOString())
    const { error } = await admin.from('gc_plan_questions').update({ sent_to_architect_on: today }).eq('id', q.id)
    if (error) return json({ error: `Sent, but not recorded: ${error.message}` }, 500)
    return json({ success: true, to, sent_on: today })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
