/**
 * crew-day-email-dispatch — end-of-day "what everyone did today" email
 * (v2.2603). Skeleton mirrors money-waiting-email-dispatch; the differences:
 * the payload is PER-RECIPIENT (get_crew_day_payload_for_user computes the
 * recipient's role scope — superintendents get only their assigned projects'
 * crews), the emailed day is the send's Chicago calendar day, and
 * superintendents may schedule sends (to eligible recipients).
 *
 * Modes on POST JSON body:
 * - { mode: 'preview' } — caller JWT, eligible role; returns { html } for the caller's own scope.
 * - { mode: 'test_send' } — same gate; [TEST]-prefixed send to the caller.
 * - { mode: 'send_now', recipient_user_id } — audit row + immediate send (recipient's scope).
 * - cron (no mode) — X-Cron-Secret; drains crew_day_email_requests,
 *   repeat_weekly re-enqueues +7d. A quiet day still sends (a silent skip
 *   reads as a broken subscription).
 *
 * Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * RESEND_API_KEY, CRON_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import {
  buildCrewDayEmailView,
  crewDayEmailSubject,
  crewDayEmailText,
  renderCrewDayEmail,
  type CrewDayEmailPayload,
} from './render.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

/** Who can open the share modal / trigger sends (superintendents included — the stream exists for them). */
const SENDER_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'superintendent'])
/** Who may RECEIVE the email — mirrors isCrewDayRole / the payload RPC's role gate. */
const RECIPIENT_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'superintendent'])
const MAX_QUEUE_BATCH = 10
const MAX_ATTEMPTS = 5

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
type Admin = any

const chicagoYmdFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_CALENDAR_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
function chicagoTodayYmd(): string {
  const parts = chicagoYmdFmt.formatToParts(new Date())
  const get = (t: Intl.DateTimeFormatPart['type']) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

async function fetchPayloadForUser(admin: Admin, userId: string, day: string): Promise<CrewDayEmailPayload> {
  const { data, error } = await admin.rpc('get_crew_day_payload_for_user', { p_user_id: userId, p_day: day })
  if (error) throw new Error(`get_crew_day_payload_for_user: ${error.message}`)
  if (!data || typeof data !== 'object') throw new Error('Empty payload')
  const body = data as CrewDayEmailPayload & { error?: string }
  if (body.error) throw new Error(`payload: ${body.error}`)
  return body
}

/** Caller JWT → active eligible users row; a Response means the gate failed. */
async function requireEligible(
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
  if (!meRow || meRow.archived_at || !SENDER_ROLES.has(String(meRow.role))) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  return {
    userId: user.id,
    email: typeof meRow.email === 'string' ? meRow.email.trim() || null : null,
    name: typeof meRow.name === 'string' ? meRow.name.trim() || null : null,
  }
}

type UserRow = { id: string; email: string | null; name: string | null; role: string | null; archived_at: string | null }

async function loadUser(admin: Admin, id: string): Promise<UserRow | null> {
  const { data } = await admin
    .from('users')
    .select('id, email, name, role, archived_at')
    .eq('id', id)
    .maybeSingle()
  return (data as UserRow | null) ?? null
}

async function sendCrewDay(
  resendApiKey: string,
  admin: Admin,
  recipientUserId: string,
  recipientEmail: string,
  senderName: string | null,
  subjectPrefix = '',
): Promise<{ success: boolean; error?: string }> {
  const payload = await fetchPayloadForUser(admin, recipientUserId, chicagoTodayYmd())
  const view = buildCrewDayEmailView(payload, Date.now())
  const subject = `${subjectPrefix}${crewDayEmailSubject(view)}`
  return await sendEmailViaResend(
    recipientEmail,
    subject,
    crewDayEmailText(view),
    renderCrewDayEmail(view, senderName ?? undefined),
    resendApiKey,
  )
}

/** Cron path: drain due request rows; each recipient's payload is rebuilt for THEIR scope. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('crew_day_email_requests')
    .select('id, requested_by, recipient_user_id, attempts, send_at, repeat_weekly')
    .is('sent_at', null)
    .lte('send_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('send_at', { ascending: true })
    .limit(MAX_QUEUE_BATCH)
  if (qErr) return jsonResponse({ error: qErr.message }, 500)

  const rows = (pending ?? []) as Array<{
    id: string
    requested_by: string
    recipient_user_id: string
    attempts: number
    send_at: string
    repeat_weekly: boolean
  }>
  if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

  let sent = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const recipient = await loadUser(admin, row.recipient_user_id)
      const recipientEmail = (recipient?.email ?? '').trim()
      if (!recipient || recipient.archived_at || !recipientEmail || !RECIPIENT_ROLES.has(String(recipient.role))) {
        // Recipient gone/archived/email-less/ineligible: stamp so the row never retries forever.
        await admin
          .from('crew_day_email_requests')
          .update({ sent_at: new Date().toISOString(), error: 'recipient unavailable (archived, no email, or ineligible role)' })
          .eq('id', row.id)
        continue
      }
      const requester = await loadUser(admin, row.requested_by)
      const mail = await sendCrewDay(resendApiKey, admin, row.recipient_user_id, recipientEmail, requester?.name ?? null)
      if (mail.success) {
        await admin
          .from('crew_day_email_requests')
          .update({ sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id)
        sent += 1
        // Weekly chains are self-perpetuating (billed-report v2.1323 pattern):
        // a successful send of a repeat_weekly row enqueues next week's row,
        // guarded against a retry double-inserting.
        if (row.repeat_weekly) {
          const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
          const { data: existing } = await admin
            .from('crew_day_email_requests')
            .select('id')
            .eq('recipient_user_id', row.recipient_user_id)
            .eq('send_at', nextSendAt)
            .is('sent_at', null)
            .limit(1)
          if (!existing || existing.length === 0) {
            await admin.from('crew_day_email_requests').insert({
              requested_by: row.requested_by,
              recipient_user_id: row.recipient_user_id,
              send_at: nextSendAt,
              repeat_weekly: true,
            })
          }
        }
      } else {
        await admin
          .from('crew_day_email_requests')
          .update({ error: (mail.error ?? 'resend').slice(0, 900), attempts: row.attempts + 1 })
          .eq('id', row.id)
        errors.push(`${row.id}: ${mail.error ?? 'resend'}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin
        .from('crew_day_email_requests')
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

    if (mode === 'preview' || mode === 'test_send' || mode === 'send_now') {
      const gate = await requireEligible(req, admin)
      if (gate instanceof Response) return gate

      if (mode === 'preview') {
        const payload = await fetchPayloadForUser(admin, gate.userId, chicagoTodayYmd())
        const view = buildCrewDayEmailView(payload, Date.now())
        return jsonResponse({ html: renderCrewDayEmail(view, gate.name ?? undefined) })
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

      if (mode === 'test_send') {
        if (!gate.email) return jsonResponse({ error: 'Your account has no email on file' }, 400)
        const mail = await sendCrewDay(resendApiKey, admin, gate.userId, gate.email, gate.name, '[TEST] ')
        if (!mail.success) return jsonResponse({ error: mail.error ?? 'Send failed' }, 502)
        return jsonResponse({ success: true })
      }

      // send_now — validate recipient, write the audit row, send, stamp.
      const recipientId = typeof body.recipient_user_id === 'string' ? body.recipient_user_id.trim() : ''
      if (!recipientId) return jsonResponse({ error: 'recipient_user_id required' }, 400)
      const recipient = await loadUser(admin, recipientId)
      if (!recipient || recipient.archived_at) return jsonResponse({ error: 'Recipient not found or archived' }, 404)
      if (!RECIPIENT_ROLES.has(String(recipient.role))) {
        return jsonResponse({ error: 'Recipient role cannot receive this report' }, 403)
      }
      const recipientEmail = (recipient.email ?? '').trim()
      if (!recipientEmail) return jsonResponse({ error: 'Recipient has no email on file' }, 400)

      const { data: reqRow, error: insErr } = await admin
        .from('crew_day_email_requests')
        .insert({ requested_by: gate.userId, recipient_user_id: recipientId, send_at: new Date().toISOString() })
        .select('id')
        .single()
      if (insErr) return jsonResponse({ error: insErr.message }, 500)

      const mail = await sendCrewDay(resendApiKey, admin, recipientId, recipientEmail, gate.name)
      await admin
        .from('crew_day_email_requests')
        .update(
          mail.success
            ? { sent_at: new Date().toISOString(), error: null }
            : { error: (mail.error ?? 'resend').slice(0, 900), attempts: 1 },
        )
        .eq('id', (reqRow as { id: string }).id)
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
    console.error('crew-day-email-dispatch', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
