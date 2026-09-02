/**
 * paid-job-email — "Customer paid" + "Ready to Bill" notifications (v2.965;
 * ready_to_bill stream v2.1836).
 *
 * Modes on POST JSON body (dual-mode shape modeled on
 * schedule-share-dispatch; preview/test-send modeled on
 * recurring-job-report-preview / -test-send):
 *
 * - { mode: 'preview', job_id, variant: 'detailed' | 'summary', kind? } —
 *   caller JWT, role dev/master_technician; returns { html }. No DB writes,
 *   no send. kind 'ready_to_bill' renders that stream's template.
 * - { mode: 'send_to', job_id, recipient_user_id } — same role gate; sends the
 *   REAL email to the chosen active user, variant decided by the RECIPIENT's
 *   role, with a 'Sent manually by …' footer (v2.970).
 * - { mode: 'test_send', job_id, kind?, recipient_user_id? } — same role gate;
 *   [TEST]-prefixed email. Default: DETAILED variant to the CALLER's own
 *   email. With recipient_user_id (ready_to_bill, v2.1844): to that active
 *   user, variant picked by THEIR role.
 * - { mode: 'test_push', job_id, recipient_user_id? } — same role gate;
 *   [TEST]-prefixed Ready to Bill web-push to the caller's (default) or the
 *   chosen user's push_subscriptions devices.
 * - cron (no mode or { mode: 'dispatch' }) — X-Cron-Secret header must equal
 *   CRON_SECRET. Drains paid_job_email_queue (sent_at IS NULL, attempts < 5).
 *   paid_in_full / payment rows email their app_settings lists (detailed to
 *   dev/master_technician, sterilized summary to everyone else).
 *   ready_to_bill rows read 'ready_to_bill_notify_recipients_v2' (per-person
 *   { id, email, push } channel prefs, v2.1844; falls back to the v1
 *   list+channels pair until v2 exists) and fan out email and/or web push per
 *   person (push bodies follow the same detailed/summary split; dead
 *   subscriptions are pruned).
 *
 * Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * RESEND_API_KEY, CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { resolveServerEmailWording } from '../_shared/emailWordingServer.ts'
import {
  paidJobEmailSubject,
  paidJobEmailText,
  renderPaidJobEmailDetailed,
  renderPaidJobEmailSummary,
  type PaidJobEmailPayload,
} from './render.ts'
import {
  readyToBillPushBody,
  readyToBillPushTitle,
  readyToBillSubject,
  readyToBillText,
  renderReadyToBillDetailed,
  renderReadyToBillSummary,
  type ReadyToBillPayload,
} from './readyToBillRender.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const RECIPIENTS_SETTING_KEY = 'paid_job_email_recipients_v1'
/** Payment-made stream (v2.1310): fires on every payment row; separate list. */
const PAYMENT_RECIPIENTS_SETTING_KEY = 'payment_made_email_recipients_v1'
/**
 * Ready to Bill stream (v2.1836): fires on status→ready_to_bill; email + push.
 * v2 (v2.1844): per-person channel prefs — JSON array of { id, email, push }.
 * The v1 pair (uuid list + org-wide channels) remains the fallback until the
 * first v2 save / the conversion migration.
 */
const RTB_RECIPIENTS_V2_SETTING_KEY = 'ready_to_bill_notify_recipients_v2'
const RTB_RECIPIENTS_SETTING_KEY = 'ready_to_bill_notify_recipients_v1'
const RTB_CHANNELS_SETTING_KEY = 'ready_to_bill_notify_channels_v1'
const DETAILED_ROLES = new Set(['dev', 'master_technician'])
const MAX_QUEUE_BATCH = 20
const MAX_ATTEMPTS = 5

type QueueKind = 'paid_in_full' | 'payment' | 'ready_to_bill'
type RtbChannels = { email: boolean; push: boolean }
/** RecipientRow + this person's channel choices (v2). */
type RtbRecipient = RecipientRow & { emailOn: boolean; pushOn: boolean }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function fetchPayload(admin: Admin, jobId: string): Promise<PaidJobEmailPayload> {
  const { data, error } = await admin.rpc('get_paid_job_email_payload', { p_job_id: jobId })
  if (error) throw new Error(`get_paid_job_email_payload: ${error.message}`)
  if (!data || typeof data !== 'object' || !(data as PaidJobEmailPayload).job) {
    throw new Error('Job not found')
  }
  return data as PaidJobEmailPayload
}

async function fetchReadyToBillPayload(admin: Admin, jobId: string): Promise<ReadyToBillPayload> {
  const { data, error } = await admin.rpc('get_ready_to_bill_email_payload', { p_job_id: jobId })
  if (error) throw new Error(`get_ready_to_bill_email_payload: ${error.message}`)
  if (!data || typeof data !== 'object' || !(data as ReadyToBillPayload).job) {
    throw new Error('Job not found')
  }
  return data as ReadyToBillPayload
}

/** v1 channels (fallback only): missing/garbage ⇒ both on; only explicit false disables. */
async function loadRtbChannels(admin: Admin): Promise<RtbChannels> {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', RTB_CHANNELS_SETTING_KEY)
    .maybeSingle()
  try {
    const parsed = JSON.parse(setting?.value_text ?? '')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { email: parsed.email !== false, push: parsed.push !== false }
    }
  } catch {
    // fall through to default
  }
  return { email: true, push: true }
}

/**
 * Ready to Bill recipients with per-person channels (v2), joined to active
 * users. Falls back to the v1 list + org-wide channels when the v2 key has
 * never been written. Mirrors src/lib/readyToBillNotify.ts — keep in sync.
 */
async function loadRtbRecipients(admin: Admin): Promise<RtbRecipient[]> {
  const { data: v2Setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', RTB_RECIPIENTS_V2_SETTING_KEY)
    .maybeSingle()

  let prefs: Array<{ id: string; email: boolean; push: boolean }> = []
  if (v2Setting?.value_text != null) {
    try {
      const parsed = JSON.parse(v2Setting.value_text)
      if (Array.isArray(parsed)) {
        const seen = new Set<string>()
        for (const x of parsed) {
          if (!x || typeof x !== 'object' || Array.isArray(x)) continue
          const id = typeof x.id === 'string' ? x.id.trim() : ''
          if (!id || seen.has(id)) continue
          const email = x.email !== false
          const push = x.push !== false
          if (!email && !push) continue
          seen.add(id)
          prefs.push({ id, email, push })
        }
      }
    } catch {
      prefs = []
    }
  } else {
    // v1 fallback: uuid list + org-wide channels.
    const v1 = await loadRecipients(admin, RTB_RECIPIENTS_SETTING_KEY, false)
    const channels = await loadRtbChannels(admin)
    if (!channels.email && !channels.push) return []
    return v1.map((r) => ({ ...r, emailOn: channels.email, pushOn: channels.push }))
  }

  if (prefs.length === 0) return []
  const { data: users } = await admin
    .from('users')
    .select('id, email, name, role, archived_at')
    .in('id', prefs.map((p) => p.id))
    .is('archived_at', null)
  const byId = new Map(
    ((users ?? []) as Array<RecipientRow & { archived_at: string | null }>).map((u) => [u.id, u]),
  )
  return prefs.flatMap((p) => {
    const u = byId.get(p.id)
    return u ? [{ ...u, emailOn: p.email, pushOn: p.push }] : []
  })
}

type PushSubRow = { id: string; user_id: string; endpoint: string; p256dh_key: string; auth_key: string }

/**
 * Web-push one Ready to Bill notification to each user's subscribed devices.
 * Bodies follow the detailed/summary role split (dollars for detailed only).
 * Dead subscriptions (404/410) are pruned; other push failures are reported
 * but never retried — a retry would re-email everyone on the row.
 */
async function sendReadyToBillPush(
  admin: Admin,
  recipients: RecipientRow[],
  payload: ReadyToBillPayload,
  titlePrefix = '',
): Promise<{ sent: number; errors: string[] }> {
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { sent: 0, errors: ['VAPID keys not configured'] }
  }
  const ids = recipients.map((r) => r.id)
  if (ids.length === 0) return { sent: 0, errors: [] }
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh_key, auth_key')
    .in('user_id', ids)
  if (subErr) return { sent: 0, errors: [`push_subscriptions: ${subErr.message}`] }

  webpush.setVapidDetails('mailto:team@pipetooling.com', vapidPublicKey, vapidPrivateKey)
  const detailedById = new Map(recipients.map((r) => [r.id, DETAILED_ROLES.has(String(r.role))]))
  const title = `${titlePrefix}${readyToBillPushTitle(payload)}`

  let sent = 0
  const errors: string[] = []
  for (const sub of (subs ?? []) as PushSubRow[]) {
    const body = readyToBillPushBody(payload, detailedById.get(sub.user_id) ?? false)
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh_key, auth: sub.auth_key } },
        JSON.stringify({ title, body, url: '/jobs', tag: `ready-to-bill-${payload.job.id}` }),
        { TTL: 86400 },
      )
      sent += 1
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        // Subscription is gone — prune it so we stop trying.
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        errors.push(`push ${sub.user_id}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }
  return { sent, errors }
}

/** Caller JWT → users row; null response means an error Response was returned. */
async function requireDevOrMaster(
  req: Request,
  admin: Admin,
): Promise<{ userId: string; email: string | null; name: string | null } | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const jwtClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authErr,
  } = await jwtClient.auth.getUser(token)
  if (authErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

  const { data: meRow } = await admin
    .from('users')
    .select('role, email, name, archived_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!meRow || meRow.archived_at || !DETAILED_ROLES.has(String(meRow.role))) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  return {
    userId: user.id,
    email: typeof meRow.email === 'string' ? meRow.email.trim() || null : null,
    name: typeof meRow.name === 'string' ? meRow.name.trim() || null : null,
  }
}

type RecipientRow = { id: string; email: string | null; name: string | null; role: string | null }

/**
 * app_settings recipient ids joined to active users. requireEmail=false keeps
 * email-less users (the ready_to_bill stream can still push to them).
 */
async function loadRecipients(
  admin: Admin,
  settingKey = RECIPIENTS_SETTING_KEY,
  requireEmail = true,
): Promise<RecipientRow[]> {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', settingKey)
    .maybeSingle()
  let ids: string[] = []
  try {
    const parsed = JSON.parse(setting?.value_text ?? '[]')
    if (Array.isArray(parsed)) ids = parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    ids = []
  }
  if (ids.length === 0) return []
  const { data: users } = await admin
    .from('users')
    .select('id, email, name, role, archived_at')
    .in('id', ids)
    .is('archived_at', null)
  return ((users ?? []) as Array<RecipientRow & { archived_at: string | null }>).filter(
    (u) => !requireEmail || (u.email ?? '').trim() !== '',
  )
}

/**
 * Cron path: drain the queue — one payload fetch per job, one send per recipient.
 *
 * Two kinds since v2.1310 (`kind` column; pre-migration rows read as
 * paid_in_full via the column default): paid_in_full keeps its list; payment
 * rows go to the payment_made list. Before sending, same-job rows collapse:
 * a pending paid_in_full row supersedes that job's payment rows (the final
 * payment fires both triggers in one transaction — one email, not two), and
 * multiple payment rows for one job (e.g. a Mercury deposit split across
 * invoices) coalesce into the newest row.
 */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('paid_job_email_queue')
    .select('id, job_ledger_id, attempts, kind')
    .is('sent_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(MAX_QUEUE_BATCH)
  if (qErr) return jsonResponse({ error: qErr.message }, 500)

  const allRows = (pending ?? []) as Array<{
    id: string
    job_ledger_id: string
    attempts: number
    kind?: QueueKind | null
  }>
  if (allRows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

  const kindOf = (r: { kind?: QueueKind | null }): QueueKind =>
    r.kind === 'payment' || r.kind === 'ready_to_bill' ? r.kind : 'paid_in_full'

  // Collapse same-job rows: paid_in_full wins over payment; else keep the
  // newest payment row. ready_to_bill rows are independent of the paid kinds
  // but coalesce among themselves (rapid flip-flops → one notification).
  const jobsWithPaidInFull = new Set(
    allRows.filter((r) => kindOf(r) === 'paid_in_full').map((r) => r.job_ledger_id),
  )
  const newestPaymentRowByJob = new Map<string, string>()
  const newestRtbRowByJob = new Map<string, string>()
  for (const r of allRows) {
    if (kindOf(r) === 'payment') newestPaymentRowByJob.set(r.job_ledger_id, r.id) // queued_at asc ⇒ last wins
    if (kindOf(r) === 'ready_to_bill') newestRtbRowByJob.set(r.job_ledger_id, r.id)
  }
  const superseded: string[] = []
  const rows: typeof allRows = []
  for (const r of allRows) {
    if (kindOf(r) === 'payment') {
      if (jobsWithPaidInFull.has(r.job_ledger_id)) {
        superseded.push(r.id)
        continue
      }
      if (newestPaymentRowByJob.get(r.job_ledger_id) !== r.id) {
        superseded.push(r.id)
        continue
      }
    }
    if (kindOf(r) === 'ready_to_bill' && newestRtbRowByJob.get(r.job_ledger_id) !== r.id) {
      superseded.push(r.id)
      continue
    }
    rows.push(r)
  }
  if (superseded.length > 0) {
    await admin
      .from('paid_job_email_queue')
      .update({ sent_at: new Date().toISOString(), error: 'superseded (coalesced with a same-job row)' })
      .in('id', superseded)
  }

  const recipientsByKind: Record<Exclude<QueueKind, 'ready_to_bill'>, RecipientRow[]> = {
    paid_in_full: await loadRecipients(admin),
    payment: await loadRecipients(admin, PAYMENT_RECIPIENTS_SETTING_KEY),
  }
  const rtbRecipients = rows.some((r) => kindOf(r) === 'ready_to_bill')
    ? await loadRtbRecipients(admin)
    : []

  let sent = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      if (kindOf(row) === 'ready_to_bill') {
        if (rtbRecipients.length === 0) {
          // Don't retry forever when nobody is configured.
          await admin
            .from('paid_job_email_queue')
            .update({ sent_at: new Date().toISOString(), error: 'no recipients configured' })
            .eq('id', row.id)
          continue
        }
        const rtbPayload = await fetchReadyToBillPayload(admin, row.job_ledger_id)

        // Per-person channels (v2): email the emailOn set, push the pushOn set.
        const emailErrors: string[] = []
        const emailRecipients = rtbRecipients.filter((r) => r.emailOn && (r.email ?? '').trim() !== '')
        if (emailRecipients.length > 0) {
          // Dev-saved wording (Settings → Email templates, v2.2659).
          const rtbWording = await resolveServerEmailWording('ready_to_bill', {}, readyToBillSubject(rtbPayload))
          const subject = rtbWording.subject
          const text = (rtbWording.introText ? rtbWording.introText + '\n\n' : '') + readyToBillText(rtbPayload)
          const detailedHtml = renderReadyToBillDetailed(rtbPayload)
          const summaryHtml = renderReadyToBillSummary(rtbPayload)
          for (const r of emailRecipients) {
            const html = (rtbWording.introHtml ?? '') + (DETAILED_ROLES.has(String(r.role)) ? detailedHtml : summaryHtml)
            const mail = await sendEmailViaResend((r.email ?? '').trim(), subject, text, html, resendApiKey)
            if (!mail.success) emailErrors.push(`${r.id}: ${mail.error ?? 'resend'}`)
          }
        }

        // Push runs even when some emails failed; push failures never retry
        // the row (that would re-email every recipient) — they're noted only.
        const pushNotes: string[] = []
        const pushRecipients = rtbRecipients.filter((r) => r.pushOn)
        if (pushRecipients.length > 0) {
          const pushResult = await sendReadyToBillPush(admin, pushRecipients, rtbPayload)
          pushNotes.push(...pushResult.errors)
        }

        if (emailErrors.length === 0) {
          await admin
            .from('paid_job_email_queue')
            .update({
              sent_at: new Date().toISOString(),
              error: pushNotes.length > 0 ? pushNotes.join('; ').slice(0, 900) : null,
            })
            .eq('id', row.id)
          sent += 1
        } else {
          await admin
            .from('paid_job_email_queue')
            .update({
              error: [...emailErrors, ...pushNotes].join('; ').slice(0, 900),
              attempts: row.attempts + 1,
            })
            .eq('id', row.id)
          errors.push(`${row.id}: ${emailErrors.join('; ')}`)
        }
        continue
      }

      const recipients = recipientsByKind[kindOf(row) as Exclude<QueueKind, 'ready_to_bill'>]
      if (recipients.length === 0) {
        // Don't retry forever when nobody is configured.
        await admin
          .from('paid_job_email_queue')
          .update({ sent_at: new Date().toISOString(), error: 'no recipients configured' })
          .eq('id', row.id)
        continue
      }

      const payload = await fetchPayload(admin, row.job_ledger_id)
      // Dev-saved wording (Settings -> Email templates, v2.2659).
      const wording = await resolveServerEmailWording('paid_job', {}, paidJobEmailSubject(payload))
      const subject = wording.subject
      const text = (wording.introText ? wording.introText + '\n\n' : '') + paidJobEmailText(payload)
      const detailedHtml = renderPaidJobEmailDetailed(payload)
      const summaryHtml = renderPaidJobEmailSummary(payload)

      const sendErrors: string[] = []
      for (const r of recipients) {
        const html = (wording.introHtml ?? '') + (DETAILED_ROLES.has(String(r.role)) ? detailedHtml : summaryHtml)
        const mail = await sendEmailViaResend((r.email ?? '').trim(), subject, text, html, resendApiKey)
        if (!mail.success) sendErrors.push(`${r.id}: ${mail.error ?? 'resend'}`)
      }

      if (sendErrors.length === 0) {
        await admin
          .from('paid_job_email_queue')
          .update({ sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id)
        sent += 1
      } else {
        await admin
          .from('paid_job_email_queue')
          .update({ error: sendErrors.join('; ').slice(0, 900), attempts: row.attempts + 1 })
          .eq('id', row.id)
        errors.push(`${row.id}: ${sendErrors.join('; ')}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin
        .from('paid_job_email_queue')
        .update({ error: msg.slice(0, 900), attempts: row.attempts + 1 })
        .eq('id', row.id)
      errors.push(`${row.id}: ${msg}`)
    }
  }

  return jsonResponse({ ok: true, processed: rows.length, sent, errors })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRole) {
      return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    }
    const admin = createClient(supabaseUrl, serviceRole)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const mode = typeof body.mode === 'string' ? body.mode : 'dispatch'

    if (mode === 'preview' || mode === 'test_send' || mode === 'send_to' || mode === 'test_push') {
      const gate = await requireDevOrMaster(req, admin)
      if (gate instanceof Response) return gate

      const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
      if (!jobId) return jsonResponse({ error: 'job_id required' }, 400)

      // The ready_to_bill stream has its own payload + templates (v2.1836).
      const isRtb = body.kind === 'ready_to_bill' || mode === 'test_push'

      // Optional test target (v2.1844): a chosen active user instead of the
      // caller. The RECIPIENT's role picks the variant, same as send_to.
      const testRecipientId =
        typeof body.recipient_user_id === 'string' ? body.recipient_user_id.trim() : ''
      let testTarget: RecipientRow = { id: gate.userId, email: gate.email, name: gate.name, role: 'dev' }
      if (testRecipientId && (mode === 'test_push' || (mode === 'test_send' && isRtb))) {
        const { data: rec } = await admin
          .from('users')
          .select('id, email, name, role, archived_at')
          .eq('id', testRecipientId)
          .maybeSingle()
        if (!rec || rec.archived_at) return jsonResponse({ error: 'Recipient not found or archived' }, 404)
        testTarget = { id: rec.id, email: rec.email, name: rec.name, role: rec.role }
      }

      if (mode === 'test_push') {
        const rtbPayload = await fetchReadyToBillPayload(admin, jobId)
        const result = await sendReadyToBillPush(admin, [testTarget], rtbPayload, '[TEST] ')
        if (result.errors.length > 0 && result.sent === 0) {
          return jsonResponse({ error: result.errors.join('; ') }, 502)
        }
        return jsonResponse({ success: true, push_sent: result.sent })
      }

      const payload = isRtb ? null : await fetchPayload(admin, jobId)
      const rtbPayload = isRtb ? await fetchReadyToBillPayload(admin, jobId) : null

      if (mode === 'preview') {
        const variant = body.variant === 'summary' ? 'summary' : 'detailed'
        const html = rtbPayload
          ? variant === 'summary'
            ? renderReadyToBillSummary(rtbPayload)
            : renderReadyToBillDetailed(rtbPayload)
          : variant === 'summary'
            ? renderPaidJobEmailSummary(payload!)
            : renderPaidJobEmailDetailed(payload!)
        return jsonResponse({ html, variant })
      }

      if (mode === 'send_to') {
        // Real send to a chosen active user; the RECIPIENT's role picks the
        // variant (a sender can never mail financials to a summary-tier role).
        // Paid streams only — the RTB gear has no ad-hoc send surface.
        if (!payload) return jsonResponse({ error: 'send_to is not supported for ready_to_bill' }, 400)
        const recipientId = typeof body.recipient_user_id === 'string' ? body.recipient_user_id.trim() : ''
        if (!recipientId) return jsonResponse({ error: 'recipient_user_id required' }, 400)
        const { data: rec } = await admin
          .from('users')
          .select('id, email, name, role, archived_at')
          .eq('id', recipientId)
          .maybeSingle()
        if (!rec || rec.archived_at) return jsonResponse({ error: 'Recipient not found or archived' }, 404)
        const recEmail = typeof rec.email === 'string' ? rec.email.trim() : ''
        if (!recEmail) return jsonResponse({ error: 'Recipient has no email on file' }, 400)
        const resendKey = Deno.env.get('RESEND_API_KEY')
        if (!resendKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
        const detailed = DETAILED_ROLES.has(String(rec.role))
        const manualNote = `Sent manually by ${gate.name ?? 'a teammate'}`
        const html = detailed
          ? renderPaidJobEmailDetailed(payload, manualNote)
          : renderPaidJobEmailSummary(payload, manualNote)
        const mail = await sendEmailViaResend(recEmail, paidJobEmailSubject(payload), paidJobEmailText(payload), html, resendKey)
        if (!mail.success) return jsonResponse({ error: mail.error ?? 'Send failed' }, 502)
        return jsonResponse({ success: true, variant: detailed ? 'detailed' : 'summary' })
      }

      // test_send — [TEST]-prefixed email. Default: detailed to the caller;
      // with recipient_user_id (ready_to_bill), the target's role picks the
      // variant so financials never reach a summary-tier inbox.
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
      const testEmail = (testTarget.email ?? '').trim()
      if (!testEmail) {
        return jsonResponse(
          { error: testTarget.id === gate.userId ? 'Your account has no email on file' : 'Recipient has no email on file' },
          400,
        )
      }
      const mail = rtbPayload
        ? await sendEmailViaResend(
            testEmail,
            `[TEST] ${readyToBillSubject(rtbPayload)}`,
            readyToBillText(rtbPayload),
            DETAILED_ROLES.has(String(testTarget.role))
              ? renderReadyToBillDetailed(rtbPayload)
              : renderReadyToBillSummary(rtbPayload),
            resendApiKey,
          )
        : await sendEmailViaResend(
            testEmail,
            `[TEST] ${paidJobEmailSubject(payload!)}`,
            paidJobEmailText(payload!),
            renderPaidJobEmailDetailed(payload!),
            resendApiKey,
          )
      if (!mail.success) return jsonResponse({ error: mail.error ?? 'Send failed' }, 502)
      return jsonResponse({ success: true })
    }

    // Cron dispatch — X-Cron-Secret must match.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof body.cron_secret === 'string' ? body.cron_secret : undefined
    const isCron = Boolean(cronSecret) && (headerSecret === cronSecret || bodySecret === cronSecret)
    if (!isCron) return jsonResponse({ error: 'Unauthorized' }, 401)

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    return await runDispatch(admin, resendApiKey)
  } catch (e) {
    console.error('paid-job-email', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
