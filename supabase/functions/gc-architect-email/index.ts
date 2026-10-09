import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { COMPANY_EMAIL_FROM } from '../_shared/emailFrom.ts'
import { officeYmd } from '../_shared/bidFollowupReminder.ts'
import { buildGcRfiEmail, buildGcSubmittalEmail } from '../_shared/gcArchitectEmail.ts'

/**
 * gc-architect-email — GC mode, the real build, the Building lane's U4b and U5b (to-dos/gc-mode/mockups/building-u4.md
 * and building-u5.md on spike/gc-mode, decision 10). The office sends a project's architect what needs their answer
 * while we build, from COMPANY_EMAIL_FROM with the project manager (else the sender) as Reply-To, as
 * gc-plan-question-email does: a submittal's newest round with the file's Drive link, or an RFI's question with its
 * sheets and the work it holds. The send is recorded through gc_send_submittal_to_architect or gc_send_rfi_to_architect,
 * called as the caller, so whose move it is is checked in one place.
 *
 *   POST { kind: 'submittal', submittal_id } | { kind: 'rfi', rfi_id }   staff JWT → { success, to, sent_on }
 *
 * Who may send is who may read the submittal or the RFI: it is read under the caller's own JWT, so the tables'
 * policies decide (a dev's only until Building's door). Never a training account or a digital twin: the service role
 * sends here, so the read-only blocks and the twin fence never see it.
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

function contactEmail(ci: unknown): string {
  if (ci && typeof ci === 'object' && typeof (ci as { email?: unknown }).email === 'string') return String((ci as { email: string }).email).trim()
  return ''
}

/** A company day in the words the email reads, "Mon, Oct 20". */
function dayWords(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The submittal and its newest round, read as the caller so the tables' policies decide who may send it. The same
 * words gc_send_submittal_to_architect says, before any email goes.
 */
async function readSubmittal(asCaller: SupabaseClient, id: unknown) {
  const submittalId = String(id ?? '').trim()
  if (!submittalId) return json({ error: 'submittal_id is required' }, 400)
  const { data: s } = await asCaller.from('gc_submittals').select('id, project_id, package_id, number, title, kind, lead_days, needed_by').eq('id', submittalId).maybeSingle()
  if (!s) return json({ error: 'No submittal with that id.' }, 404)
  const { data: round } = await asCaller
    .from('gc_submittal_rounds')
    .select('id, round, file_name, drive_url, note, to_architect_on, answer')
    .eq('submittal_id', s.id)
    .order('round', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!round || round.answer === 'revise') return json({ error: 'Nothing has come in from the trade to send.' }, 400)
  if (round.answer) return json({ error: 'It is approved already.' }, 400)
  if (round.to_architect_on) return json({ error: 'It went to the architect already.' }, 400)
  if (!round.drive_url) return json({ error: 'Add the file’s Drive link first. The architect opens it from there.' }, 400)
  return { kind: 'submittal' as const, projectId: s.project_id as string, packageId: s.package_id as string, s, round }
}

/** The RFI, read as the caller. The same words gc_send_rfi_to_architect says, before any email goes. */
async function readRfi(asCaller: SupabaseClient, id: unknown) {
  const rfiId = String(id ?? '').trim()
  if (!rfiId) return json({ error: 'rfi_id is required' }, 400)
  const { data: r } = await asCaller
    .from('gc_rfis')
    .select('id, project_id, number, question, sheets, package_id, asked_by_company_id, asked_on, needed_days, sent_to_architect_on, answered_on')
    .eq('id', rfiId)
    .maybeSingle()
  if (!r) return json({ error: 'No RFI with that id.' }, 404)
  if (r.answered_on) return json({ error: 'It is answered already.' }, 400)
  if (r.sent_to_architect_on) return json({ error: 'It went to the architect already.' }, 400)
  return { kind: 'rfi' as const, projectId: r.project_id as string, packageId: r.package_id as string | null, r }
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
    const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await asCaller.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)
    const { data: who } = await admin.from('users').select('name, email, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
    if (!who) return json({ error: 'Sign in first.' }, 401)
    if (who.read_only) return json({ error: 'A training account cannot send email.' }, 403)
    if (who.is_digital_twin) return json({ error: 'A digital twin cannot send email.' }, 403)

    const body = (await req.json().catch(() => ({}))) as { kind?: string; submittal_id?: string; rfi_id?: string }
    if (body.kind !== 'submittal' && body.kind !== 'rfi') return json({ error: 'Only a submittal or an RFI is sent this way.' }, 400)
    const item = body.kind === 'submittal' ? await readSubmittal(asCaller, body.submittal_id) : await readRfi(asCaller, body.rfi_id)
    if (item instanceof Response) return item

    const { data: project } = await admin.from('projects').select('id, name, address').eq('id', item.projectId).maybeSingle()
    const { data: gc } = await admin.from('gc_projects').select('architect_customer_id, project_manager_user_id').eq('project_id', item.projectId).maybeSingle()
    if (!project || !gc) return json({ error: 'No GC project with that id.' }, 404)
    if (!gc.architect_customer_id) return json({ error: 'The project has no architect on record. Add one on the project first.' }, 400)
    const { data: architect } = await admin.from('customers').select('id, name, contact_info').eq('id', gc.architect_customer_id).maybeSingle()
    const to = contactEmail(architect?.contact_info)
    if (!architect || !to) return json({ error: `${architect?.name ?? 'The architect'} has no email on record. Add it on the customer first.` }, 400)

    // The trade, and the company it is awarded to.
    const { data: pkg } = item.packageId ? await admin.from('gc_trade_packages').select('trade, awarded_invite_id').eq('id', item.packageId).maybeSingle() : { data: null }
    const companyId = pkg?.awarded_invite_id ? (await admin.from('gc_invites').select('company_id').eq('id', pkg.awarded_invite_id).maybeSingle()).data?.company_id ?? null : null
    const company = companyId ? (await admin.from('gc_companies').select('name').eq('id', companyId).maybeSingle()).data?.name ?? null : null

    const pm = gc.project_manager_user_id ? (await admin.from('users').select('name, email').eq('id', gc.project_manager_user_id).maybeSingle()).data : null
    const replyTo = (pm?.email || who.email || '').trim() || undefined
    const signer = (pm?.name || who.name || 'Click Construction').trim()

    let email: { subject: string; text: string; html: string }
    // Sent copies (docs/SENT_COPIES.md): what went to the architect, on the architect's customer record and its own row.
    let copy: { kind: string; title: string; source: { table: string; id: string } }
    if (item.kind === 'submittal') {
      const { s, round } = item
      // The day we need the answer (submittalNeededBy): the first start of the work it holds less its lead days, else
      // the day the office set.
      const { data: holds } = await admin.from('gc_submittal_holds').select('scope_item_id').eq('submittal_id', s.id)
      const lineIds = (holds ?? []).map((h) => h.scope_item_id)
      const starts = lineIds.length ? ((await admin.from('gc_schedule_activities').select('start').eq('project_id', s.project_id).in('scope_item_id', lineIds)).data ?? []).map((a) => a.start as string) : []
      const neededOn = starts.length ? addDays(starts.reduce((m, d) => (d < m ? d : m)), -Number(s.lead_days ?? 0)) : (s.needed_by ?? null)
      email = buildGcSubmittalEmail({
        architectName: architect.name,
        projectName: project.name,
        projectAddress: project.address ?? null,
        number: s.number,
        title: s.title,
        kind: s.kind as 'product data' | 'shop drawings' | 'samples',
        from: [pkg?.trade, company].filter(Boolean).join(', ') || 'the trade',
        round: round.round,
        file: round.file_name,
        driveUrl: round.drive_url,
        note: round.note ?? '',
        neededBy: neededOn ? dayWords(neededOn) : null,
        signer,
        companyName: 'Click Construction',
      })
      copy = { kind: 'gc_submittal', title: `Submittal ${s.number}: ${project.name}`, source: { table: 'gc_submittal_rounds', id: round.id } }
    } else {
      const { r } = item
      // Who asked: the company that phoned it in, with its trade, else our own people.
      const asker = r.asked_by_company_id ? ((await admin.from('gc_companies').select('name').eq('id', r.asked_by_company_id).maybeSingle()).data?.name ?? company) : null
      // The work it holds, soonest first, and the day we need the answer (rfiNeededBy): the first held work's start
      // less its days, never before the day it was asked.
      const { data: holds } = await admin.from('gc_rfi_holds').select('scope_item_id').eq('rfi_id', r.id)
      const lineIds = (holds ?? []).map((h) => h.scope_item_id as string)
      const lines = lineIds.length ? ((await admin.from('gc_scope_items').select('id, label').in('id', lineIds)).data ?? []) : []
      const bars = lineIds.length ? ((await admin.from('gc_schedule_activities').select('scope_item_id, start').eq('project_id', r.project_id).in('scope_item_id', lineIds)).data ?? []) : []
      const startOf = new Map<string, string>()
      for (const b of bars) if (!startOf.has(b.scope_item_id) || b.start < startOf.get(b.scope_item_id)!) startOf.set(b.scope_item_id, b.start)
      const held = lines
        .map((l) => ({ label: l.label as string, start: startOf.get(l.id) ?? '9999-12-31' }))
        .sort((a, b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label))
      const first = [...startOf.values()].sort()[0] ?? null
      const byStart = first ? addDays(first, -Number(r.needed_days ?? 0)) : null
      const neededOn = byStart && byStart < r.asked_on ? r.asked_on : byStart
      const label = `RFI-${String(r.number).padStart(3, '0')}`
      email = buildGcRfiEmail({
        architectName: architect.name,
        projectName: project.name,
        projectAddress: project.address ?? null,
        label,
        question: r.question,
        sheets: r.sheets ?? [],
        from: asker ? [asker, pkg?.trade].filter(Boolean).join(', ') : 'our superintendent',
        holds: held.map((h) => h.label),
        neededBy: neededOn ? dayWords(neededOn) : null,
        signer,
        companyName: 'Click Construction',
      })
      copy = { kind: 'gc_rfi', title: `${label}: ${project.name}`, source: { table: 'gc_rfis', id: r.id } }
    }

    const sent = await sendEmailViaResend(to, email.subject, email.text, email.html, resendApiKey, {
      ...(replyTo ? { replyTo } : {}),
      from: COMPANY_EMAIL_FROM,
      emailType: copy.kind,
      file: { kind: copy.kind, title: copy.title, recipientName: architect.name, customerId: architect.id, source: copy.source, sentBy: u.user.id },
    })
    if (!sent.success) return json({ error: `The email was not sent: ${sent.error ?? 'Resend said no'}` }, 502)

    const logId = sent.resendEmailId
      ? ((await admin.from('email_send_log').select('id').eq('resend_email_id', sent.resendEmailId).maybeSingle()).data?.id ?? null)
      : null
    // Recorded as the caller, through the same function the window's "We sent it another way" calls.
    const { data: sentOn, error } =
      item.kind === 'submittal'
        ? await asCaller.rpc('gc_send_submittal_to_architect', { p_submittal_id: item.s.id, p_email_send_log_id: logId })
        : await asCaller.rpc('gc_send_rfi_to_architect', { p_rfi_id: item.r.id, p_email_send_log_id: logId })
    if (error) return json({ error: `Sent, but not recorded: ${error.message}` }, 500)
    return json({ success: true, to, sent_on: sentOn ?? officeYmd(new Date().toISOString()) })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
