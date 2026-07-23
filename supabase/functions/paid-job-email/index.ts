/**
 * paid-job-email — "Customer paid" notifications (v2.965).
 *
 * Three modes on POST JSON body (dual-mode shape modeled on
 * schedule-share-dispatch; preview/test-send modeled on
 * recurring-job-report-preview / -test-send):
 *
 * - { mode: 'preview', job_id, variant: 'detailed' | 'summary' } — caller JWT,
 *   role dev/master_technician; returns { html }. No DB writes, no send.
 * - { mode: 'test_send', job_id } — same role gate; sends the DETAILED variant
 *   via Resend to the CALLER's own email only, subject prefixed [TEST].
 * - cron (no mode or { mode: 'dispatch' }) — X-Cron-Secret header must equal
 *   CRON_SECRET. Drains paid_job_email_queue (sent_at IS NULL, attempts < 5),
 *   loads recipients from app_settings 'paid_job_email_recipients_v1' (JSON
 *   array of user ids in value_text), sends detailed to dev/master_technician
 *   recipients and the sterilized summary to everyone else.
 *
 * Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * RESEND_API_KEY, CRON_SECRET.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import {
  paidJobEmailSubject,
  paidJobEmailText,
  renderPaidJobEmailDetailed,
  renderPaidJobEmailSummary,
  type PaidJobEmailPayload,
} from './render.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const RECIPIENTS_SETTING_KEY = 'paid_job_email_recipients_v1'
const DETAILED_ROLES = new Set(['dev', 'master_technician'])
const MAX_QUEUE_BATCH = 20
const MAX_ATTEMPTS = 5

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

/** Caller JWT → users row; null response means an error Response was returned. */
async function requireDevOrMaster(
  req: Request,
  admin: Admin,
): Promise<{ userId: string; email: string | null } | Response> {
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
    .select('role, email, archived_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!meRow || meRow.archived_at || !DETAILED_ROLES.has(String(meRow.role))) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  return { userId: user.id, email: typeof meRow.email === 'string' ? meRow.email.trim() || null : null }
}

type RecipientRow = { id: string; email: string | null; name: string | null; role: string | null }

/** app_settings recipient ids joined to active users. */
async function loadRecipients(admin: Admin): Promise<RecipientRow[]> {
  const { data: setting } = await admin
    .from('app_settings')
    .select('value_text')
    .eq('key', RECIPIENTS_SETTING_KEY)
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
    (u) => (u.email ?? '').trim() !== '',
  )
}

/** Cron path: drain the queue — one payload fetch per job, one send per recipient. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('paid_job_email_queue')
    .select('id, job_ledger_id, attempts')
    .is('sent_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('queued_at', { ascending: true })
    .limit(MAX_QUEUE_BATCH)
  if (qErr) return jsonResponse({ error: qErr.message }, 500)

  const rows = (pending ?? []) as Array<{ id: string; job_ledger_id: string; attempts: number }>
  if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

  const recipients = await loadRecipients(admin)

  let sent = 0
  const errors: string[] = []

  for (const row of rows) {
    try {
      if (recipients.length === 0) {
        // Don't retry forever when nobody is configured.
        await admin
          .from('paid_job_email_queue')
          .update({ sent_at: new Date().toISOString(), error: 'no recipients configured' })
          .eq('id', row.id)
        continue
      }

      const payload = await fetchPayload(admin, row.job_ledger_id)
      const subject = paidJobEmailSubject(payload)
      const text = paidJobEmailText(payload)
      const detailedHtml = renderPaidJobEmailDetailed(payload)
      const summaryHtml = renderPaidJobEmailSummary(payload)

      const sendErrors: string[] = []
      for (const r of recipients) {
        const html = DETAILED_ROLES.has(String(r.role)) ? detailedHtml : summaryHtml
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

    if (mode === 'preview' || mode === 'test_send') {
      const gate = await requireDevOrMaster(req, admin)
      if (gate instanceof Response) return gate

      const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : ''
      if (!jobId) return jsonResponse({ error: 'job_id required' }, 400)

      const payload = await fetchPayload(admin, jobId)

      if (mode === 'preview') {
        const variant = body.variant === 'summary' ? 'summary' : 'detailed'
        const html =
          variant === 'summary' ? renderPaidJobEmailSummary(payload) : renderPaidJobEmailDetailed(payload)
        return jsonResponse({ html, variant })
      }

      // test_send — detailed variant to the caller's own email only.
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
      if (!gate.email) return jsonResponse({ error: 'Your account has no email on file' }, 400)
      const mail = await sendEmailViaResend(
        gate.email,
        `[TEST] ${paidJobEmailSubject(payload)}`,
        paidJobEmailText(payload),
        renderPaidJobEmailDetailed(payload),
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
