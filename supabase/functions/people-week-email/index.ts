/**
 * people-week-email — Your people's week, the Monday email (punch list #273, PR 5, v2.6603; the people_week
 * REPORT_SUBSCRIPTIONS stream). A person subscribes themself with the people they picked (the office roles anyone,
 * everyone else only themselves, the request table's own policy), a weekday and a time, weekly. Each send is rebuilt
 * fresh from get_people_week_payload(recipient, people, week_start) for the week just finished (Monday to Sunday,
 * the last full week before the send day in Central) and rendered by _shared/peopleWeekEmail.ts.
 *
 * Modes on the POST JSON body:
 * - { mode: 'preview', people_user_ids? } — the caller's JWT; returns { subject, html } for the caller's own week.
 * - { mode: 'test_send', people_user_ids? } — the same gate; a [TEST] send to the caller only.
 * - cron (no mode) — X-Cron-Secret; drains people_week_email_requests, a weekly row re-inserting itself +7 days.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, CRON_SECRET, APP_ORIGIN
 * (the Open Review link). config.toml keeps verify_jwt = false: the cron sends no JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { calendarYmdInAppTzFromIso } from '../_shared/appTimeZone.ts'
import { peopleWeekSubject, renderPeopleWeekHtml, renderPeopleWeekText, type PeopleWeekPayload } from '../_shared/peopleWeekEmail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

/** Keep in sync with public.is_dev_or_master_or_assistant() and the request table's INSERT policy. */
// Who may pick other people: is_dev_or_master_or_assistant() in SQL, the insert policy's gate, primaries included.
const OFFICE = new Set(['dev', 'master_technician', 'assistant', 'controller', 'primary'])
const MAX_QUEUE_BATCH = 10
const MAX_ATTEMPTS = 5
const APP_ORIGIN = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com').replace(/\/+$/, '')
const REVIEW_URL = `${APP_ORIGIN}/checklist?tab=review`
const EMAIL_TYPE = 'people_week'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any
type UserRow = { id: string; email: string | null; name: string | null; role: string | null; archived_at: string | null }

async function loadUser(admin: Admin, id: string): Promise<UserRow | null> {
  const { data } = await admin.from('users').select('id, email, name, role, archived_at').match(REAL_ACCOUNT).eq('id', id).maybeSingle()
  const row = (data as UserRow | null) ?? null
  return row && (row.email ?? '').trim() ? row : null
}

/** The caller's JWT → an active user; a Response means the gate failed. */
async function requireUser(req: Request, admin: Admin): Promise<UserRow | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const jwtClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: authErr,
  } = await jwtClient.auth.getUser(token)
  if (authErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
  const me = await loadUser(admin, user.id)
  const archivedRefusal = await refuseArchivedCaller(admin, user.id, corsHeaders)
  if (archivedRefusal) return archivedRefusal
  if (!me) return jsonResponse({ error: 'Forbidden' }, 403)
  return me
}

/** The Monday of the last full week before the day, YYYY-MM-DD; a Monday send reads the week that just ended. */
export function weekStartBefore(dayYmd: string): string {
  const t = Date.parse(`${dayYmd}T00:00:00Z`)
  const d = new Date(Number.isFinite(t) ? t : Date.now())
  const dow = d.getUTCDay()
  const mondayOffset = (dow + 6) % 7
  const monday = new Date(d.getTime() - mondayOffset * 86_400_000 - 7 * 86_400_000)
  return monday.toISOString().slice(0, 10)
}

async function loadPayload(admin: Admin, recipient: string, people: string[], weekStart: string): Promise<PeopleWeekPayload> {
  const { data, error } = await admin.rpc('get_people_week_payload', { p_recipient: recipient, p_people: people, p_week_start: weekStart })
  if (error) throw new Error(`payload rpc: ${error.message}`)
  const payload = data as PeopleWeekPayload | null
  if (!payload || !Array.isArray(payload.people)) throw new Error('empty payload')
  return payload
}

function buildEmail(payload: PeopleWeekPayload): { subject: string; html: string; text: string } {
  return { subject: peopleWeekSubject(payload), html: renderPeopleWeekHtml(payload, REVIEW_URL), text: renderPeopleWeekText(payload, REVIEW_URL) }
}

/** The people a caller may ask about: the office anyone, everyone else themselves. */
function peopleFor(me: UserRow, asked: unknown): string[] {
  const list = Array.isArray(asked) ? asked.filter((x): x is string => typeof x === 'string' && x.length > 0) : []
  if (!OFFICE.has(String(me.role))) return [me.id]
  return list.length ? Array.from(new Set(list)).slice(0, 50) : [me.id]
}

/** The cron: every due row, a payload per row, each weekly row re-inserted once. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('people_week_email_requests')
    .select('id, requested_by, recipient_user_id, people_user_ids, attempts, send_at, repeat_weekly')
    .is('sent_at', null)
    .lte('send_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('send_at', { ascending: true })
    .limit(MAX_QUEUE_BATCH)
  if (qErr) return jsonResponse({ error: qErr.message }, 500)
  const rows = (pending ?? []) as Array<{ id: string; requested_by: string; recipient_user_id: string; people_user_ids: string[]; attempts: number; send_at: string; repeat_weekly: boolean }>
  if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

  let sent = 0
  const errors: string[] = []
  for (const row of rows) {
    try {
      const recipient = await loadUser(admin, row.recipient_user_id)
      const email = (recipient?.email ?? '').trim()
      if (!recipient || recipient.archived_at || !email) {
        await admin.from('people_week_email_requests').update({ sent_at: new Date().toISOString(), error: 'recipient unavailable (archived or no email)' }).eq('id', row.id)
        continue
      }
      const people = OFFICE.has(String(recipient.role)) ? row.people_user_ids : [recipient.id]
      const weekStart = weekStartBefore(calendarYmdInAppTzFromIso(row.send_at))
      const mail = buildEmail(await loadPayload(admin, recipient.id, people, weekStart))
      const res = await sendEmailViaResend(email, mail.subject, mail.text, mail.html, resendApiKey, { emailType: EMAIL_TYPE })
      if (!res.success) throw new Error(res.error || 'Resend failed')
      await admin.from('people_week_email_requests').update({ sent_at: new Date().toISOString(), error: null }).eq('id', row.id)
      sent += 1
      if (row.repeat_weekly) {
        const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
        const { data: existing } = await admin.from('people_week_email_requests').select('id').eq('recipient_user_id', row.recipient_user_id).eq('send_at', nextSendAt).is('sent_at', null).limit(1)
        if (!existing || existing.length === 0) {
          await admin.from('people_week_email_requests').insert({
            requested_by: row.requested_by,
            recipient_user_id: row.recipient_user_id,
            people_user_ids: row.people_user_ids,
            send_at: nextSendAt,
            repeat_weekly: true,
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.from('people_week_email_requests').update({ error: msg.slice(0, 900), attempts: row.attempts + 1 }).eq('id', row.id)
      errors.push(`${row.id}: ${msg}`)
    }
  }
  return jsonResponse({ ok: true, processed: rows.length, sent, errors })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Supabase service env not configured' }, 500)
    if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
    const admin = createClient(supabaseUrl, serviceRole)

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      body = {}
    }
    const mode = typeof body.mode === 'string' ? body.mode : ''

    if (mode === 'preview' || mode === 'test_send') {
      const me = await requireUser(req, admin)
      if (me instanceof Response) return me
      const people = peopleFor(me, body.people_user_ids)
      const weekStart = weekStartBefore(calendarYmdInAppTzFromIso(new Date().toISOString()))
      const mail = buildEmail(await loadPayload(admin, me.id, people, weekStart))
      if (mode === 'preview') return jsonResponse({ subject: mail.subject, html: mail.html })
      const email = (me.email ?? '').trim()
      if (!email) return jsonResponse({ error: 'Your account has no email address' }, 400)
      const res = await sendEmailViaResend(email, `[TEST] ${mail.subject}`, mail.text, mail.html, resendApiKey, { emailType: EMAIL_TYPE })
      if (!res.success) return jsonResponse({ error: res.error || 'Send failed' }, 500)
      return jsonResponse({ ok: true })
    }

    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof body.cron_secret === 'string' ? body.cron_secret : undefined
    if (!cronSecret || (headerSecret !== cronSecret && bodySecret !== cronSecret)) return jsonResponse({ error: 'Unauthorized' }, 401)
    return await runDispatch(admin, resendApiKey)
  } catch (e) {
    console.error('people-week-email', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'The send failed.' }, 500)
  }
})
