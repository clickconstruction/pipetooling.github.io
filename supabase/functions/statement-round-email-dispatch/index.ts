/**
 * statement-round-email-dispatch — the "Your statement round" email
 * (v2.2771, `statement_round` REPORT_SUBSCRIPTIONS stream). Skeleton mirrors
 * crew-day-email-dispatch: the payload is PER-RECIPIENT
 * (get_statement_round_for_user computes that sender's round — certified GCs
 * assigned to them, not yet marked sent) and is rebuilt fresh at send time.
 * v2.2812: the email reads as the account man's own account — standard,
 * aging, AP contact, last word / temperature, deadline, held GCs, scoreboard.
 * Office roles only on both sides. An empty round still sends a one-liner
 * (a silent skip reads as a broken subscription).
 *
 * Modes on POST JSON body:
 * - { mode: 'preview', recipient_user_id? } — caller JWT, office role; returns { html } for the caller's own round, or a colleague's (v2.2781).
 * - { mode: 'test_send' } — same gate; [TEST]-prefixed send to the caller.
 * - cron (no mode)        — X-Cron-Secret; drains statement_round_email_requests,
 *                           repeat_weekly re-enqueues +7d.
 *
 * Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * RESEND_API_KEY, CRON_SECRET, APP_ORIGIN (deep link).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { resolveServerEmailWording } from '../_shared/emailWordingServer.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { renderStatementRoundHtml, roundTotal, statementRoundSubject, statementRoundText, type StatementRoundPayload } from './render.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

/** Keep in sync with the statement_round_email_requests INSERT policy and get_my_statement_round's gate. */
const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const MAX_QUEUE_BATCH = 10
const MAX_ATTEMPTS = 5
const APP_ORIGIN = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com').replace(/\/+$/, '')
const ROUND_URL = `${APP_ORIGIN}/jobs?tab=stages&round=1`

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any

const dateFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', month: 'short', day: 'numeric' })
const dateLabel = (): string => dateFmt.format(new Date())

async function fetchRoundForUser(admin: Admin, userId: string): Promise<StatementRoundPayload> {
  const { data, error } = await admin.rpc('get_statement_round_for_user', { p_user_id: userId })
  if (error) throw new Error(`get_statement_round_for_user: ${error.message}`)
  if (!data || typeof data !== 'object' || !Array.isArray((data as StatementRoundPayload).ready)) throw new Error('Empty payload')
  const body = data as StatementRoundPayload
  // Pre-v2.2812 payload shape (RPC not yet pushed): fill the new fields so the renderer never throws.
  if (!body.held || !Array.isArray(body.held.items)) body.held = { count: body.held?.count ?? 0, total: body.held?.total ?? 0, items: [] }
  if (typeof body.book_total !== 'number') body.book_total = roundTotal(body)
  if (typeof body.contacted_by_me !== 'number') body.contacted_by_me = 0
  if (typeof body.deadline !== 'string') body.deadline = ''
  return body
}

type UserRow = { id: string; email: string | null; name: string | null; role: string | null; archived_at: string | null }

async function loadUser(admin: Admin, id: string): Promise<UserRow | null> {
  const { data } = await admin.from('users').select('id, email, name, role, archived_at').eq('id', id).maybeSingle()
  return (data as UserRow | null) ?? null
}

/** Caller JWT → active office user; a Response means the gate failed. */
async function requireOffice(req: Request, admin: Admin): Promise<UserRow | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return jsonResponse({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const jwtClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: authErr,
  } = await jwtClient.auth.getUser(token)
  if (authErr || !user) return jsonResponse({ error: 'Unauthorized' }, 401)
  const me = await loadUser(admin, user.id)
  if (!me || me.archived_at || !OFFICE_ROLES.has(String(me.role))) return jsonResponse({ error: 'Forbidden' }, 403)
  return me
}

async function buildEmail(admin: Admin, recipient: UserRow): Promise<{ subject: string; html: string; text: string }> {
  const payload = await fetchRoundForUser(admin, recipient.id)
  const label = dateLabel()
  // Dev-saved wording (Settings → Email templates): subject template + optional intro paragraph.
  const wording = await resolveServerEmailWording('statement_round', { date: label }, statementRoundSubject(payload, recipient.name))
  const name = recipient.name?.trim() || null
  return {
    subject: wording.subject,
    html: (wording.introHtml ?? '') + renderStatementRoundHtml(payload, label, ROUND_URL, name),
    text: (wording.introText ? wording.introText + '\n\n' : '') + statementRoundText(payload, label, ROUND_URL, name),
  }
}

/** Cron path: drain due rows; each recipient's round is rebuilt for THEM. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('statement_round_email_requests')
    .select('id, requested_by, recipient_user_id, attempts, send_at, repeat_weekly')
    .is('sent_at', null)
    .lte('send_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('send_at', { ascending: true })
    .limit(MAX_QUEUE_BATCH)
  if (qErr) return jsonResponse({ error: qErr.message }, 500)
  const rows = (pending ?? []) as Array<{ id: string; requested_by: string; recipient_user_id: string; attempts: number; send_at: string; repeat_weekly: boolean }>
  if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

  let sent = 0
  const errors: string[] = []
  for (const row of rows) {
    try {
      const recipient = await loadUser(admin, row.recipient_user_id)
      const email = (recipient?.email ?? '').trim()
      if (!recipient || recipient.archived_at || !email || !OFFICE_ROLES.has(String(recipient.role))) {
        await admin
          .from('statement_round_email_requests')
          .update({ sent_at: new Date().toISOString(), error: 'recipient unavailable (archived, no email, or ineligible role)' })
          .eq('id', row.id)
        continue
      }
      const mail = await buildEmail(admin, recipient)
      const res = await sendEmailViaResend(email, mail.subject, mail.text, mail.html, resendApiKey)
      if (!res.success) throw new Error(res.error || 'Resend failed')
      await admin.from('statement_round_email_requests').update({ sent_at: new Date().toISOString(), error: null }).eq('id', row.id)
      sent += 1
      if (row.repeat_weekly) {
        // Self-perpetuating weekly chain (billed-report v2.1323 pattern), guarded against retry double-inserts.
        const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
        const { data: existing } = await admin
          .from('statement_round_email_requests')
          .select('id')
          .eq('recipient_user_id', row.recipient_user_id)
          .eq('send_at', nextSendAt)
          .is('sent_at', null)
          .limit(1)
        if (!existing || existing.length === 0) {
          await admin.from('statement_round_email_requests').insert({
            requested_by: row.requested_by,
            recipient_user_id: row.recipient_user_id,
            send_at: nextSendAt,
            repeat_weekly: true,
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.from('statement_round_email_requests').update({ error: msg.slice(0, 900), attempts: row.attempts + 1 }).eq('id', row.id)
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
      const me = await requireOffice(req, admin)
      if (me instanceof Response) return me
      // Preview another sender's round (v2.2781, the sender card): any office
      // caller may READ a colleague's round — it is the same data the GC
      // Review panel shows them — but test sends stay to the caller only.
      let subject: UserRow = me
      const previewFor = typeof body.recipient_user_id === 'string' ? body.recipient_user_id.trim() : ''
      if (mode === 'preview' && previewFor && previewFor !== me.id) {
        const other = await loadUser(admin, previewFor)
        if (!other || other.archived_at || !OFFICE_ROLES.has(String(other.role))) return jsonResponse({ error: 'That user cannot hold a round' }, 400)
        subject = other
      }
      const mail = await buildEmail(admin, subject)
      if (mode === 'preview') return jsonResponse({ html: mail.html })
      const email = (me.email ?? '').trim()
      if (!email) return jsonResponse({ error: 'Your account has no email address' }, 400)
      const res = await sendEmailViaResend(email, `[TEST] ${mail.subject}`, mail.text, mail.html, resendApiKey)
      if (!res.success) return jsonResponse({ error: res.error || 'Send failed' }, 500)
      return jsonResponse({ ok: true })
    }

    // Cron path.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof body.cron_secret === 'string' ? body.cron_secret : undefined
    if (!cronSecret || (headerSecret !== cronSecret && bodySecret !== cronSecret)) return jsonResponse({ error: 'Unauthorized' }, 401)
    return await runDispatch(admin, resendApiKey)
  } catch (e) {
    console.error('statement-round-email-dispatch', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
