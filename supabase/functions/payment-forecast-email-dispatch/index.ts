/**
 * payment-forecast-email-dispatch — share the Payment forecast (v2.2225).
 *
 * Skeleton mirrors billed-report-email (the reference dispatcher). Modes on
 * POST JSON body:
 *
 * - { mode: 'preview' } — caller JWT, staff role (dev/master_technician/
 *   assistant/controller); returns { html }. No DB writes, no send.
 * - { mode: 'test_send' } — same gate; sends the forecast via Resend to the
 *   CALLER's own email only, subject prefixed [TEST]. No request row.
 * - { mode: 'send_now', recipient_user_id } — same gate; validates the
 *   recipient (active, office-capable role, has email), inserts an audit row
 *   in payment_forecast_email_requests (send_at = now), sends immediately,
 *   stamps sent_at. The email footer carries "Sent by {caller}".
 * - cron (no mode or { mode: 'dispatch' }) — X-Cron-Secret must equal
 *   CRON_SECRET. Drains payment_forecast_email_requests rows with
 *   send_at <= now(), sent_at IS NULL, attempts < 5. The payload is rebuilt
 *   once per batch (fresh numbers at send time — rows carry no snapshot).
 *   A repeat_weekly row re-enqueues itself +7d on successful send.
 *
 * Recipients are office-capable roles only (dev/master_technician/assistant/
 * controller/primary) — the forecast carries the same AR dollars as the
 * billed report. An empty board still sends a one-liner (a silent skip reads
 * as a broken subscription); weekly chains advance either way.
 *
 * Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * RESEND_API_KEY, CRON_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { resolveServerEmailWording } from '../_shared/emailWordingServer.ts'
import {
  paymentForecastEmailSubject,
  paymentForecastEmailText,
  renderPaymentForecastEmail,
  type ForecastEmailPayload,
} from './render.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

/** Who can open the share modal / trigger sends. */
const SENDER_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
/** Who may RECEIVE the forecast (office-capable — mirrors billed-report-email). */
const RECIPIENT_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller', 'primary'])
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

async function fetchPayload(admin: Admin): Promise<ForecastEmailPayload> {
  const { data, error } = await admin.rpc('get_payment_forecast_email_payload')
  if (error) throw new Error(`get_payment_forecast_email_payload: ${error.message}`)
  if (!data || typeof data !== 'object' || !Array.isArray((data as ForecastEmailPayload).rows)) {
    throw new Error('Empty payload')
  }
  return data as ForecastEmailPayload
}

/** Caller JWT → active staff users row; a Response means the gate failed. */
async function requireStaff(
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

async function sendForecast(
  resendApiKey: string,
  payload: ForecastEmailPayload,
  recipientEmail: string,
  senderName: string | null,
  subjectPrefix = '',
): Promise<{ success: boolean; error?: string }> {
  // Dev-saved wording (Settings -> Email templates, v2.2659): subject template
  // + optional intro paragraph above the built digest; built-in copy otherwise.
  const wording = await resolveServerEmailWording('payment_forecast', {}, paymentForecastEmailSubject(payload))
  const subject = `${subjectPrefix}${wording.subject}`
  return await sendEmailViaResend(
    recipientEmail,
    subject,
    (wording.introText ? wording.introText + '\n\n' : '') + paymentForecastEmailText(payload),
    (wording.introHtml ?? '') + renderPaymentForecastEmail(payload, senderName ?? undefined),
    resendApiKey,
  )
}

/** Cron path: drain due request rows; the payload is rebuilt once per batch. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('payment_forecast_email_requests')
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

  let payload: ForecastEmailPayload
  try {
    payload = await fetchPayload(admin)
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }

  let sent = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      const recipient = await loadUser(admin, row.recipient_user_id)
      const recipientEmail = (recipient?.email ?? '').trim()
      if (!recipient || recipient.archived_at || !recipientEmail) {
        // Recipient gone/archived/email-less: stamp so the row never retries forever.
        await admin
          .from('payment_forecast_email_requests')
          .update({ sent_at: new Date().toISOString(), error: 'recipient unavailable (archived or no email)' })
          .eq('id', row.id)
        continue
      }
      const requester = await loadUser(admin, row.requested_by)
      const mail = await sendForecast(resendApiKey, payload, recipientEmail, requester?.name ?? null)
      if (mail.success) {
        await admin
          .from('payment_forecast_email_requests')
          .update({ sent_at: new Date().toISOString(), error: null })
          .eq('id', row.id)
        sent += 1
        // Weekly chains are self-perpetuating (billed-report v2.1323 pattern):
        // a successful send of a repeat_weekly row enqueues next week's row,
        // guarded against a retry double-inserting.
        if (row.repeat_weekly) {
          const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
          const { data: existing } = await admin
            .from('payment_forecast_email_requests')
            .select('id')
            .eq('recipient_user_id', row.recipient_user_id)
            .eq('send_at', nextSendAt)
            .is('sent_at', null)
            .limit(1)
          if (!existing || existing.length === 0) {
            await admin.from('payment_forecast_email_requests').insert({
              requested_by: row.requested_by,
              recipient_user_id: row.recipient_user_id,
              send_at: nextSendAt,
              repeat_weekly: true,
            })
          }
        }
      } else {
        await admin
          .from('payment_forecast_email_requests')
          .update({ error: (mail.error ?? 'resend').slice(0, 900), attempts: row.attempts + 1 })
          .eq('id', row.id)
        errors.push(`${row.id}: ${mail.error ?? 'resend'}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin
        .from('payment_forecast_email_requests')
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
      const gate = await requireStaff(req, admin)
      if (gate instanceof Response) return gate

      const payload = await fetchPayload(admin)

      if (mode === 'preview') {
        return jsonResponse({ html: renderPaymentForecastEmail(payload, gate.name ?? undefined) })
      }

      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)

      if (mode === 'test_send') {
        if (!gate.email) return jsonResponse({ error: 'Your account has no email on file' }, 400)
        const mail = await sendForecast(resendApiKey, payload, gate.email, gate.name, '[TEST] ')
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
        .from('payment_forecast_email_requests')
        .insert({ requested_by: gate.userId, recipient_user_id: recipientId, send_at: new Date().toISOString() })
        .select('id')
        .single()
      if (insErr) return jsonResponse({ error: insErr.message }, 500)

      const mail = await sendForecast(resendApiKey, payload, recipientEmail, gate.name)
      await admin
        .from('payment_forecast_email_requests')
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
    console.error('payment-forecast-email-dispatch', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
