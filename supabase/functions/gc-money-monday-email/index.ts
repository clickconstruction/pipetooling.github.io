/**
 * gc-money-monday-email — GC mode's Monday money email (Owner Billing's O7b, the gc_money_monday
 * REPORT_SUBSCRIPTIONS stream). The money team (gc_money_team(): dev, the leaders, the controller) asks
 * for it from Money in GC projects, for themselves or each other, a weekday and a time each, weekly.
 * The payload is the same for every recipient (get_gc_money_monday_payload(): Who owes us as the Money
 * lens reads it, and last week's sends and certificates), rebuilt fresh at send time. No six weeks line
 * yet (the lead's call 2, 2026-10-08). Internal: logged, no sent copy.
 *
 * Modes on the POST JSON body:
 * - { mode: 'preview' }   — the caller's JWT, money team; returns { subject, html }.
 * - { mode: 'test_send' } — the same gate; a [TEST] send to the caller only.
 * - cron (no mode)        — X-Cron-Secret; drains gc_money_monday_email_requests, a weekly row
 *                           re-inserting itself +7 days.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, RESEND_API_KEY, CRON_SECRET,
 * APP_ORIGIN (the Open Money link). config.toml keeps verify_jwt = false: the cron sends no JWT.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { gcMoneyMondaySubject, renderGcMoneyMondayHtml, renderGcMoneyMondayText, type GcMoneyMondayPayload } from './render.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

/** Keep in sync with public.gc_money_team() and the requests table's INSERT policy. */
const MONEY_TEAM = new Set(['dev', 'master_technician', 'controller'])
const MAX_QUEUE_BATCH = 10
const MAX_ATTEMPTS = 5
const APP_ORIGIN = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com').replace(/\/+$/, '')
const MONEY_URL = `${APP_ORIGIN}/gc?view=money`
const EMAIL_TYPE = 'gc_money_monday'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any
type UserRow = { id: string; email: string | null; name: string | null; role: string | null; archived_at: string | null }

async function loadUser(admin: Admin, id: string): Promise<UserRow | null> {
  const { data } = await admin.from('users').select('id, email, name, role, archived_at').match(REAL_ACCOUNT).eq('id', id).maybeSingle()
  return (data as UserRow | null) ?? null
}

/** The caller's JWT → an active money-team user; a Response means the gate failed. */
async function requireMoneyTeam(req: Request, admin: Admin): Promise<UserRow | Response> {
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
  if (!me || me.archived_at || !MONEY_TEAM.has(String(me.role))) return jsonResponse({ error: 'Forbidden' }, 403)
  return me
}

async function loadPayload(admin: Admin): Promise<GcMoneyMondayPayload> {
  const { data, error } = await admin.rpc('get_gc_money_monday_payload')
  if (error) throw new Error(`payload rpc: ${error.message}`)
  const payload = data as GcMoneyMondayPayload | null
  if (!payload || !Array.isArray(payload.bills)) throw new Error('empty payload')
  return payload
}

function buildEmail(payload: GcMoneyMondayPayload, requesterName?: string): { subject: string; html: string; text: string } {
  return {
    subject: gcMoneyMondaySubject(payload),
    html: renderGcMoneyMondayHtml(payload, MONEY_URL, requesterName),
    text: renderGcMoneyMondayText(payload, MONEY_URL),
  }
}

/** The cron: every due row, one payload for the batch, each weekly row re-inserted once. */
async function runDispatch(admin: Admin, resendApiKey: string): Promise<Response> {
  const { data: pending, error: qErr } = await admin
    .from('gc_money_monday_email_requests')
    .select('id, requested_by, recipient_user_id, attempts, send_at, repeat_weekly')
    .is('sent_at', null)
    .lte('send_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('send_at', { ascending: true })
    .limit(MAX_QUEUE_BATCH)
  if (qErr) return jsonResponse({ error: qErr.message }, 500)
  const rows = (pending ?? []) as Array<{ id: string; requested_by: string; recipient_user_id: string; attempts: number; send_at: string; repeat_weekly: boolean }>
  if (rows.length === 0) return jsonResponse({ ok: true, processed: 0, sent: 0, errors: [] })

  const payload = await loadPayload(admin)
  let sent = 0
  const errors: string[] = []
  for (const row of rows) {
    try {
      const recipient = await loadUser(admin, row.recipient_user_id)
      const email = (recipient?.email ?? '').trim()
      if (!recipient || recipient.archived_at || !email || !MONEY_TEAM.has(String(recipient.role))) {
        await admin
          .from('gc_money_monday_email_requests')
          .update({ sent_at: new Date().toISOString(), error: 'recipient unavailable (archived, no email, or off the money team)' })
          .eq('id', row.id)
        continue
      }
      const requester = await loadUser(admin, row.requested_by)
      const mail = buildEmail(payload, requester?.name?.trim() || undefined)
      const replyTo = typeof requester?.email === 'string' && requester.email.includes('@') ? requester.email : undefined
      const res = await sendEmailViaResend(email, mail.subject, mail.text, mail.html, resendApiKey, { emailType: EMAIL_TYPE, ...(replyTo ? { replyTo } : {}) })
      if (!res.success) throw new Error(res.error || 'Resend failed')
      await admin.from('gc_money_monday_email_requests').update({ sent_at: new Date().toISOString(), error: null }).eq('id', row.id)
      sent += 1
      if (row.repeat_weekly) {
        // The weekly chain (billed-report's pattern), guarded against a retry inserting it twice.
        const nextSendAt = new Date(new Date(row.send_at).getTime() + 7 * 86_400_000).toISOString()
        const { data: existing } = await admin
          .from('gc_money_monday_email_requests')
          .select('id')
          .eq('recipient_user_id', row.recipient_user_id)
          .eq('send_at', nextSendAt)
          .is('sent_at', null)
          .limit(1)
        if (!existing || existing.length === 0) {
          await admin.from('gc_money_monday_email_requests').insert({
            requested_by: row.requested_by,
            recipient_user_id: row.recipient_user_id,
            send_at: nextSendAt,
            repeat_weekly: true,
          })
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await admin.from('gc_money_monday_email_requests').update({ error: msg.slice(0, 900), attempts: row.attempts + 1 }).eq('id', row.id)
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
      const me = await requireMoneyTeam(req, admin)
      if (me instanceof Response) return me
      const mail = buildEmail(await loadPayload(admin), me.name?.trim() || undefined)
      if (mode === 'preview') return jsonResponse({ subject: mail.subject, html: mail.html })
      const email = (me.email ?? '').trim()
      if (!email) return jsonResponse({ error: 'Your account has no email address' }, 400)
      const res = await sendEmailViaResend(email, `[TEST] ${mail.subject}`, mail.text, mail.html, resendApiKey, { emailType: EMAIL_TYPE })
      if (!res.success) return jsonResponse({ error: res.error || 'Send failed' }, 500)
      return jsonResponse({ ok: true })
    }

    // The cron.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const bodySecret = typeof body.cron_secret === 'string' ? body.cron_secret : undefined
    if (!cronSecret || (headerSecret !== cronSecret && bodySecret !== cronSecret)) return jsonResponse({ error: 'Unauthorized' }, 401)
    return await runDispatch(admin, resendApiKey)
  } catch (e) {
    console.error('gc-money-monday-email', e)
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
