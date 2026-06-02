import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import {
  buildShareEmail,
  computeShareDates,
  isShareConfigValid,
  type ShareBlockRow,
  type ShareScope,
} from '../_shared/scheduleShareCore.ts'
import {
  calendarYmdForInstantInZone,
  scheduleMatchesNowWallQuarter,
  weekdayIndexSun0InZone,
} from '../_shared/recurringJobReportTimezone.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const MANAGE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'superintendent'])
const MAX_INSTANT_RECIPIENTS = 50

type SubscriptionRow = {
  id: string
  recipient_user_id: string
  created_by: string | null
  time_local: string
  timezone: string
  days_of_week: number[]
  include_current_day: boolean
  scope: ShareScope
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// deno-lint-ignore no-explicit-any
type Admin = any

/** Resolve the full board (p_viewer's visibility) over the supplied date set; one RPC + filter to the set. */
async function fetchBoardBlocks(
  admin: Admin,
  viewerId: string,
  dates: string[],
): Promise<{ blocks: ShareBlockRow[]; error?: string }> {
  if (dates.length === 0) return { blocks: [] }
  const start = dates[0]!
  const end = dates[dates.length - 1]!
  const { data, error } = await admin.rpc('list_schedule_blocks_for_share', {
    p_viewer: viewerId,
    p_start: start,
    p_end: end,
  })
  if (error) return { blocks: [], error: error.message }
  const set = new Set(dates)
  const blocks = ((data ?? []) as ShareBlockRow[]).filter((b) =>
    set.has(String(b.work_date).slice(0, 10)),
  )
  return { blocks }
}

async function recipientEmail(
  admin: Admin,
  userId: string,
): Promise<{ email: string | null; archived: boolean }> {
  const { data } = await admin
    .from('users')
    .select('email, archived_at')
    .eq('id', userId)
    .maybeSingle()
  const email = (typeof data?.email === 'string' ? data.email : '').trim()
  return { email: email || null, archived: Boolean(data?.archived_at) }
}

/** pg_cron path: find due recurring subscriptions and send the full board once per local run date. */
async function runRecurring(admin: Admin, resendApiKey: string): Promise<Response> {
  const now = new Date()
  const { data: subs, error: subErr } = await admin
    .from('schedule_share_recurring')
    .select('id, recipient_user_id, created_by, time_local, timezone, days_of_week, include_current_day, scope')
    .eq('enabled', true)

  if (subErr) {
    console.error('schedule_share_recurring', subErr)
    return jsonResponse({ error: subErr.message }, 500)
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const raw of (subs ?? []) as SubscriptionRow[]) {
    const zone = (raw.timezone ?? APP_CALENDAR_TZ).trim() || APP_CALENDAR_TZ
    const wd = weekdayIndexSun0InZone(zone, now)
    const dows = Array.isArray(raw.days_of_week) ? raw.days_of_week : []
    if (!dows.includes(wd)) continue
    if (!scheduleMatchesNowWallQuarter(raw.time_local, zone, now)) continue

    const runDate = calendarYmdForInstantInZone(zone, now)

    // Idempotency: at most one send per subscription per local run date.
    const { data: dup } = await admin
      .from('schedule_share_recurring_log')
      .select('id')
      .eq('subscription_id', raw.id)
      .eq('run_date', runDate)
      .maybeSingle()
    if (dup) {
      skipped += 1
      continue
    }

    const dates = computeShareDates(runDate, {
      includeCurrentDay: raw.include_current_day,
      scope: raw.scope,
    })
    if (dates.length === 0) {
      skipped += 1
      continue
    }

    const { email, archived } = await recipientEmail(admin, raw.recipient_user_id)
    if (!email || archived) {
      await admin.from('schedule_share_recurring_log').insert({
        subscription_id: raw.id,
        run_date: runDate,
        status: 'failed',
        error: 'Recipient email missing or archived',
      })
      errors.push(`${raw.id}: no email`)
      continue
    }

    const viewerId = raw.created_by ?? raw.recipient_user_id
    const { blocks, error: blockErr } = await fetchBoardBlocks(admin, viewerId, dates)
    if (blockErr) {
      await admin.from('schedule_share_recurring_log').insert({
        subscription_id: raw.id,
        run_date: runDate,
        status: 'failed',
        error: `blocks: ${blockErr}`.slice(0, 900),
      })
      errors.push(`${raw.id}: rpc`)
      continue
    }

    const { html, text, subject } = buildShareEmail({ dates, blocks })
    const mail = await sendEmailViaResend(email, subject, text, html, resendApiKey)

    await admin.from('schedule_share_recurring_log').insert({
      subscription_id: raw.id,
      run_date: runDate,
      status: mail.success ? 'sent' : 'failed',
      error: mail.success ? null : (mail.error ?? 'Resend error').slice(0, 900),
    })

    if (mail.success) sent += 1
    else errors.push(`${raw.id}: ${mail.error ?? 'resend'}`)
  }

  return jsonResponse({ ok: true, mode: 'recurring', processed: (subs ?? []).length, sent, skipped, errors })
}

/** Instant path (caller JWT): send the full board to the selected recipients right now. */
async function runInstant(req: Request, admin: Admin, resendApiKey: string): Promise<Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing authorization' }, 401)
  }
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser(token)
  if (authErr || !user) {
    return jsonResponse({ error: 'Invalid session' }, 401)
  }

  // Role gate (mirror schedule-dispatch edit roles).
  const { data: meRow } = await admin
    .from('users')
    .select('role, archived_at')
    .eq('id', user.id)
    .maybeSingle()
  if (!meRow || meRow.archived_at || !MANAGE_ROLES.has(String(meRow.role))) {
    return jsonResponse({ error: 'Not allowed to share the schedule' }, 403)
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }
  const recipientIds = Array.isArray(body.recipientUserIds)
    ? (body.recipientUserIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : []
  const baseDate = typeof body.baseDate === 'string' ? body.baseDate.trim() : ''
  const includeCurrentDay = body.includeCurrentDay === true
  const scope: ShareScope =
    body.scope === 'next_day' || body.scope === 'rest_of_week' ? body.scope : 'none'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
    return jsonResponse({ error: 'baseDate must be YYYY-MM-DD' }, 400)
  }
  if (recipientIds.length === 0) {
    return jsonResponse({ error: 'Pick at least one recipient' }, 400)
  }
  if (recipientIds.length > MAX_INSTANT_RECIPIENTS) {
    return jsonResponse({ error: `Too many recipients (max ${MAX_INSTANT_RECIPIENTS})` }, 400)
  }
  if (!isShareConfigValid({ includeCurrentDay, scope })) {
    return jsonResponse({ error: 'Choose at least one of current day / next day / rest of week' }, 400)
  }

  const dates = computeShareDates(baseDate, { includeCurrentDay, scope })
  if (dates.length === 0) {
    return jsonResponse({ error: 'Selected options cover no dates' }, 400)
  }

  // One board fetch from the sharer's visibility; same content to every recipient.
  const { blocks, error: blockErr } = await fetchBoardBlocks(admin, user.id, dates)
  if (blockErr) {
    return jsonResponse({ error: `Could not load schedule: ${blockErr}` }, 500)
  }
  const { html, text, subject } = buildShareEmail({ dates, blocks })

  const results: { recipientUserId: string; ok: boolean; error?: string }[] = []
  for (const rid of [...new Set(recipientIds)]) {
    const { email, archived } = await recipientEmail(admin, rid)
    if (!email || archived) {
      results.push({ recipientUserId: rid, ok: false, error: 'Email missing or archived' })
      continue
    }
    const mail = await sendEmailViaResend(email, subject, text, html, resendApiKey)
    results.push({ recipientUserId: rid, ok: mail.success, error: mail.success ? undefined : mail.error })
  }

  const sent = results.filter((r) => r.ok).length
  return jsonResponse({ ok: sent > 0, mode: 'instant', sent, results })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    }
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!serviceRole || !supabaseUrl) {
      return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    }
    const admin = createClient(supabaseUrl, serviceRole)

    // Distinguish cron (recurring) vs instant (user JWT) by the cron secret.
    let bodyPeek: Record<string, unknown> = {}
    const rawBody = await req.clone().text()
    if (rawBody) {
      try {
        bodyPeek = JSON.parse(rawBody) as Record<string, unknown>
      } catch {
        bodyPeek = {}
      }
    }
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof bodyPeek.cron_secret === 'string' ? bodyPeek.cron_secret : undefined
    const isCron = Boolean(cronSecret) && (headerSecret === cronSecret || bodySecret === cronSecret)

    if (isCron) {
      return await runRecurring(admin, resendApiKey)
    }
    return await runInstant(req, admin, resendApiKey)
  } catch (e) {
    console.error(e)
    return jsonResponse({ error: String(e) }, 500)
  }
})
