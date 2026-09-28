import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'
import { isPreviewFlag, PUBLIC_PREVIEW_PARAM, requestStaff } from '../_shared/publicViewCounting.ts'
import {
  validateWordAskAnswers,
  wordAskEmail,
  wordAskLinkMessage,
  wordAskLinkProblem,
  wordAskPageGcs,
  wordAskUrl,
  type WordAskAnswerRow,
  type WordAskGc,
  type WordAskWeekItem,
} from '../_shared/gcWordAsk.ts'

/**
 * gc-word-ask — ask by link (punch list #49, step 7). The office sends an
 * account man a no-login link; he says where his GCs stand; the office reads
 * his answers and saves them as the week's word under its own sign-in.
 *
 *   GET  ?token=…                       no auth — the page: his GCs, what each owes,
 *                                       the last word, the promise, his answers so far.
 *   POST { token, answers[] }           no auth — his answers, pending until the office
 *                                       reads them. An answer the office already
 *                                       accepted is left as it is.
 *   POST { mode: 'email', askId }       caller JWT, office role — emails him the link.
 *
 * The link is the capability (raw token, sha256 fallback), lives eight days
 * and can be turned off (gc_word_asks.revoked_at). It never writes a mark:
 * gc_statement_round_marks stays RLS-pinned to the office user who saves.
 * The GCs come from get_statement_week_for_office() filtered to the ones the
 * ask names — a GC paid down under the line drops off the page.
 *
 * Secrets used: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
 * RESEND_API_KEY (email mode), APP_ORIGIN (the link in the email).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OFFICE_ROLES = new Set(['dev', 'master_technician', 'assistant', 'controller'])
const APP_ORIGIN = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://clicktooling.com').replace(/\/+$/, '')
const ASK_COLUMNS = 'id, week_start, owner_user_id, owner_name, gc_ids, token, created_by, created_by_name, expires_at, emailed_at, opened_at, answered_at, revoked_at'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Ask = {
  id: string
  week_start: string
  owner_user_id: string
  owner_name: string
  gc_ids: string[]
  token: string | null
  created_by: string | null
  created_by_name: string
  expires_at: string
  emailed_at: string | null
  opened_at: string | null
  answered_at: string | null
  revoked_at: string | null
}

async function resolveAsk(admin: SupabaseClient, token: string): Promise<Ask | null> {
  let { data } = await admin.from('gc_word_asks').select(ASK_COLUMNS).eq('token', token).maybeSingle()
  if (!data) data = (await admin.from('gc_word_asks').select(ASK_COLUMNS).eq('token_hash', await sha256Hex(token)).maybeSingle()).data
  return (data as Ask | null) ?? null
}

/** The GCs the ask names, as the office's week has them now, with his answers so far. */
async function pageGcs(admin: SupabaseClient, ask: Ask): Promise<WordAskGc[]> {
  const { data: week, error } = await admin.rpc('get_statement_week_for_office')
  if (error) throw new Error(`get_statement_week_for_office: ${error.message}`)
  const items = ((week as { items?: WordAskWeekItem[] } | null)?.items ?? []) as WordAskWeekItem[]
  const { data: answers } = await admin.from('gc_word_ask_answers').select('gc_customer_id, temperature, note, expected_pay_by, no_change, status').eq('ask_id', ask.id)
  return wordAskPageGcs(items, ask.gc_ids ?? [], (answers ?? []) as WordAskAnswerRow[])
}

const expiresFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'long', month: 'short', day: 'numeric' })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    // ── The page ────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const token = url.searchParams.get('token')?.trim() ?? ''
      if (token.length < 16 || token.length > 128) return jsonResponse({ error: 'Missing token' }, 400)
      const ask = await resolveAsk(admin, token)
      const problem = wordAskLinkProblem(ask, Date.now())
      if (problem || !ask) return jsonResponse({ error: wordAskLinkMessage(problem ?? 'missing') }, 404)
      const gcs = await pageGcs(admin, ask)
      // "Opened" is his opening it — not the office's preview, and not whoever sent it checking the link.
      if (!ask.opened_at && !isPreviewFlag(url.searchParams.get(PUBLIC_PREVIEW_PARAM))) {
        const viewer = await requestStaff(req, admin, anonKey)
        if (!viewer.userId || viewer.userId !== ask.created_by) {
          void admin.from('gc_word_asks').update({ opened_at: new Date().toISOString() }).eq('id', ask.id).is('opened_at', null).then(() => {}, () => {})
        }
      }
      return jsonResponse({
        ownerName: ask.owner_name,
        askedByName: ask.created_by_name,
        weekStart: ask.week_start,
        expiresAt: ask.expires_at,
        answeredAt: ask.answered_at,
        gcs,
      })
    }

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return jsonResponse({ error: 'Bad request' }, 400)

    // ── Email him the link (office, signed in) ──────────────────────────────
    if (body.mode === 'email') {
      const viewer = await requestStaff(req, admin, anonKey)
      if (!viewer.userId) return jsonResponse({ error: 'Unauthorized' }, 401)
      const { data: me } = await admin.from('users').select('id, name, role, archived_at').eq('id', viewer.userId).maybeSingle()
      const meRow = me as { id: string; name: string | null; role: string | null; archived_at: string | null } | null
      if (!meRow || meRow.archived_at || !OFFICE_ROLES.has(String(meRow.role))) return jsonResponse({ error: 'Forbidden' }, 403)
      const askId = typeof body.askId === 'string' ? body.askId : ''
      if (!askId) return jsonResponse({ error: 'askId required' }, 400)
      const { data: askRow } = await admin.from('gc_word_asks').select(ASK_COLUMNS).eq('id', askId).maybeSingle()
      const ask = askRow as Ask | null
      const problem = wordAskLinkProblem(ask, Date.now())
      if (problem || !ask || !ask.token) return jsonResponse({ error: wordAskLinkMessage(problem ?? 'missing') }, 404)
      const { data: owner } = await admin.from('users').select('id, name, email, archived_at').eq('id', ask.owner_user_id).maybeSingle()
      const ownerRow = owner as { id: string; name: string | null; email: string | null; archived_at: string | null } | null
      const to = (ownerRow?.email ?? '').trim()
      if (!ownerRow || ownerRow.archived_at || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return jsonResponse({ error: `${ask.owner_name || 'That person'} has no email on file — copy the link and text it instead.` }, 400)
      }
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500)
      const gcs = await pageGcs(admin, ask)
      if (gcs.length === 0) return jsonResponse({ error: 'None of these GCs owes over the line any more — nothing to ask.' }, 400)
      const mail = wordAskEmail({
        ownerName: ownerRow.name,
        askedByName: meRow.name ?? ask.created_by_name,
        gcs,
        url: wordAskUrl(APP_ORIGIN, ask.token),
        expiresLabel: expiresFmt.format(new Date(ask.expires_at)),
      })
      const sent = await sendEmailViaResend(to, mail.subject, mail.text, mail.html, resendApiKey, { emailType: 'gc_word_ask' })
      if (!sent.success) return jsonResponse({ error: sent.error || 'The email did not go out.' }, 502)
      await admin.from('gc_word_asks').update({ emailed_at: new Date().toISOString(), emailed_to: to }).eq('id', ask.id)
      return jsonResponse({ ok: true, emailedTo: to })
    }

    // ── His answers ─────────────────────────────────────────────────────────
    // Honeypot: a filled "website" is a bot. Pretend success, write nothing.
    if (typeof body.website === 'string' && body.website.trim()) return jsonResponse({ ok: true, saved: 0 })
    const token = typeof body.token === 'string' ? body.token.trim().slice(0, 128) : ''
    if (token.length < 16) return jsonResponse({ error: 'Missing token' }, 400)
    const ask = await resolveAsk(admin, token)
    const problem = wordAskLinkProblem(ask, Date.now())
    if (problem || !ask) return jsonResponse({ error: wordAskLinkMessage(problem ?? 'missing') }, 404)
    const gcs = await pageGcs(admin, ask)
    const checked = validateWordAskAnswers(body.answers, gcs)
    if (!checked.ok) return jsonResponse({ error: checked.error }, 400)

    // What the office already accepted is the record; a later answer does not reopen it.
    const accepted = new Set(gcs.filter((g) => g.answer?.status === 'accepted').map((g) => g.gcId))
    const rows = checked.answers
      .filter((a) => !accepted.has(a.gcId))
      .map((a) => ({
        ask_id: ask.id,
        gc_customer_id: a.gcId,
        temperature: a.temperature,
        note: a.note,
        expected_pay_by: a.payBy,
        no_change: a.noChange,
        answered_at: new Date().toISOString(),
        status: 'pending',
        decided_by: null,
        decided_by_name: null,
        decided_at: null,
      }))
    if (rows.length > 0) {
      const { error: upErr } = await admin.from('gc_word_ask_answers').upsert(rows, { onConflict: 'ask_id,gc_customer_id' })
      if (upErr) {
        console.error('gc-word-ask: answers upsert failed', upErr)
        return jsonResponse({ error: 'Could not save your answers. Please try again.' }, 500)
      }
      await admin.from('gc_word_asks').update({ answered_at: new Date().toISOString(), opened_at: ask.opened_at ?? new Date().toISOString() }).eq('id', ask.id)
    }
    return jsonResponse({ ok: true, saved: rows.length, alreadyAccepted: checked.answers.length - rows.length })
  } catch (e) {
    console.error('gc-word-ask error', e)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
