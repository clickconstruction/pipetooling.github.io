import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'

/**
 * The firm's emails (Legal portal train, PR 5). Two doors:
 *
 *   POST (pg_cron every 5 minutes, X-Cron-Secret) —
 *     1. drains legal_notification_queue rows not yet sent: every confirmed, unpaused
 *        recipient at the firm with mode 'now' (and, for scope 'mine', named as the
 *        matter's handling person) gets one email per event; stamps sent_now_at.
 *     2. digests: each confirmed, unpaused recipient with mode 'digest' whose weekday and
 *        Central time have arrived and who has not had today's digest gets ONE email —
 *        every open matter for the firm plus the events since their last digest;
 *        stamps last_digest_at and the events' digested_at.
 *     A paused firm (legal_firms.paused_at) sends nothing; the queue waits.
 *
 *   GET ?confirm=<token> / ?unsubscribe=<token> — the two links every email carries.
 *     Confirm activates a recipient (nothing is sent to an address before this);
 *     unsubscribe pauses that person. Plain HTML pages, no auth: the token is the
 *     capability.
 *
 * The wording of every email here is short and factual; the portal link is the door.
 * Required secrets: CRON_SECRET, RESEND_API_KEY (+ APP_ORIGIN for the portal link).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const WITH_FIRM = ['referred', 'demand', 'suit', 'judgment']

type Row = Record<string, unknown>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
function html(body: string, status = 200): Response {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${PORTAL_COMPANY.name}</title><style>body{font:16px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;background:#f6f3ec;margin:0;padding:40px 20px}main{max-width:520px;margin:0 auto;background:#fdfcf9;border:1px solid #ddd6c8;border-radius:8px;padding:24px}h1{font-size:20px;margin:0 0 8px}p{margin:8px 0;color:#5a6b7e}</style></head><body><main>${body}</main></body></html>`, { status, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
/** Weekday 1..7 (Mon..Sun) and HH:MM in the company time zone. */
function nowInAppTz(now = new Date()): { weekday: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const days: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const hh = get('hour') === '24' ? '00' : get('hour')
  return { weekday: days[get('weekday')] ?? 1, hhmm: `${hh}:${get('minute')}` }
}
function ymdInAppTz(iso: string | null | undefined): string | null {
  if (!iso) return null
  return todayYmdInAppTz(new Date(iso))
}

type Recipient = { id: string; firm_id: string; name: string; email: string; mode: string; scope: string; digest_weekday: number; digest_time: string; confirmed_at: string | null; paused_at: string | null; last_digest_at: string | null; unsubscribe_token_hash: string | null }

async function unsubscribeLink(admin: SupabaseClient, r: Recipient): Promise<string> {
  // The unsubscribe token is minted once per recipient, hashed at rest; the raw value lives only in the emails.
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/legal-notify-dispatch`
  const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  if (!r.unsubscribe_token_hash) {
    await admin.from('legal_firm_recipients').update({ unsubscribe_token_hash: await sha256Hex(raw), updated_at: new Date().toISOString() }).eq('id', r.id)
    r.unsubscribe_token_hash = await sha256Hex(raw)
    return `${base}?unsubscribe=${raw}`
  }
  // An existing hash cannot be reversed; rotate it so this email's link works (older emails' links stop — acceptable).
  await admin.from('legal_firm_recipients').update({ unsubscribe_token_hash: await sha256Hex(raw), updated_at: new Date().toISOString() }).eq('id', r.id)
  return `${base}?unsubscribe=${raw}`
}

function portalLink(token: string | null): string {
  const origin = Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'
  return token ? `${origin}/legal?t=${token}` : origin
}

function wrap(bodyHtml: string, unsub: string): string {
  return `<div style="font:15px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;max-width:600px"><div style="border-bottom:2px solid #b0662f;padding-bottom:8px;margin-bottom:14px"><b>${esc(PORTAL_COMPANY.name)}</b><br><span style="color:#5a6b7e;font-size:13px">Collections referred to counsel</span></div>${bodyHtml}<p style="color:#8a97a6;font-size:12px;margin-top:22px">You get this because you are listed at the firm on Click's legal portal. <a href="${unsub}" style="color:#8a97a6">Stop these emails to you</a>.</p></div>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const url = new URL(req.url)

  // --- GET: confirm / unsubscribe --------------------------------------------
  if (req.method === 'GET') {
    const confirm = url.searchParams.get('confirm')?.trim()
    const unsub = url.searchParams.get('unsubscribe')?.trim()
    if (confirm && confirm.length >= 16) {
      const hash = await sha256Hex(confirm)
      const { data } = await admin.from('legal_firm_recipients').select('id, name, email, confirmed_at').eq('confirm_token_hash', hash).is('removed_at', null).maybeSingle()
      const r = data as { id: string; name: string; email: string; confirmed_at: string | null } | null
      if (!r) return html('<h1>That link has expired.</h1><p>Ask someone at the firm to add you again from the portal.</p>', 404)
      if (!r.confirmed_at) await admin.from('legal_firm_recipients').update({ confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id)
      return html(`<h1>You're confirmed, ${esc(r.name)}.</h1><p>${esc(r.email)} will now get the firm's emails from ${esc(PORTAL_COMPANY.name)} — right away or in a weekly digest, whichever the portal says. Every email carries a link to stop them.</p>`)
    }
    if (unsub && unsub.length >= 16) {
      const hash = await sha256Hex(unsub)
      const { data } = await admin.from('legal_firm_recipients').select('id, name').eq('unsubscribe_token_hash', hash).maybeSingle()
      const r = data as { id: string; name: string } | null
      if (!r) return html('<h1>That link has expired.</h1><p>Use the link in a newer email, or stop emails from the portal.</p>', 404)
      await admin.from('legal_firm_recipients').update({ paused_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id)
      return html(`<h1>Done, ${esc(r.name)}.</h1><p>No more emails to you from ${esc(PORTAL_COMPANY.name)}'s legal portal. The portal itself still works; turn emails back on from its Notifications page.</p>`)
    }
    return html('<h1>Nothing to do.</h1><p>This address only answers the links in the firm\'s emails.</p>', 400)
  }

  // --- POST: the cron tick -----------------------------------------------------
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'Unauthorized' }, 401)
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ error: 'RESEND_API_KEY missing' }, 500)

  const result = { now: 0, digests: 0, skipped: 0, errors: [] as string[] }
  try {
    const { data: firmRows } = await admin.from('legal_firms').select('id, name, paused_at').eq('active', true)
    const firms = (firmRows ?? []) as Array<{ id: string; name: string; paused_at: string | null }>
    for (const firm of firms) {
      if (firm.paused_at) {
        result.skipped++
        continue
      }
      const { data: recRows } = await admin.from('legal_firm_recipients').select('*').eq('firm_id', firm.id).is('removed_at', null).not('confirmed_at', 'is', null).is('paused_at', null)
      const recipients = (recRows ?? []) as Recipient[]
      if (recipients.length === 0) continue
      const { data: linkRow } = await admin.from('legal_portal_links').select('token').eq('firm_id', firm.id).is('revoked_at', null).maybeSingle()
      const portal = portalLink(((linkRow as Row | null)?.token as string | null) ?? null)
      const { data: matterRows } = await admin.from('legal_matters').select('id, payer_name, stage, handling_name, released_at').eq('firm_id', firm.id).in('stage', WITH_FIRM)
      const matters = (matterRows ?? []) as Array<{ id: string; payer_name: string; stage: string; handling_name: string; released_at: string | null }>
      const matterById = new Map(matters.map((m) => [m.id, m] as const))
      const canSee = (r: Recipient, matterId: string | null) => r.scope === 'all' || !matterId || (matterById.get(matterId)?.handling_name ?? '').trim().toLowerCase() === r.name.trim().toLowerCase()

      // 1. "Now" recipients drain the queue.
      const { data: openRows } = await admin.from('legal_notification_queue').select('*').eq('firm_id', firm.id).is('sent_now_at', null).order('created_at').limit(50)
      for (const ev of (openRows ?? []) as Array<{ id: string; matter_id: string | null; trigger: string; payload: Row }>) {
        const targets = recipients.filter((r) => r.mode === 'now' && canSee(r, ev.matter_id))
        for (const r of targets) {
          const unsub = await unsubscribeLink(admin, r)
          const payer = String(ev.payload.payer ?? 'an account')
          const subject = ev.trigger === 'referred' ? `New account referred: ${payer}` : ev.trigger === 'answer' ? `${PORTAL_COMPANY.name} answered on ${payer}` : `Pulled back: ${payer}`
          const line = ev.trigger === 'referred' ? `${PORTAL_COMPANY.name} has marked <b>${esc(payer)}</b> attorney-ready and released it to ${esc(firm.name)}${ev.payload.handling ? ` — handling: ${esc(ev.payload.handling)}` : ''}.${ev.payload.note ? `<br><i>“${esc(ev.payload.note)}”</i>` : ''}` : ev.trigger === 'answer' ? `The office answered your question on <b>${esc(payer)}</b>:<br><i>${esc(ev.payload.body)}</i>` : `<b>${esc(payer)}</b> has been pulled back by the office and no longer shows on the portal.`
          const bodyHtml = wrap(`<p>${line}</p><p><a href="${portal}" style="display:inline-block;background:#b0662f;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none">Open the portal</a></p>`, unsub)
          const res = await sendEmailViaResend(r.email, subject, `${subject}\n\n${portal}`, bodyHtml, resendKey)
          if (!res.success) result.errors.push(`${r.email}: ${res.error ?? 'send failed'}`)
          else result.now++
        }
        await admin.from('legal_notification_queue').update({ sent_now_at: new Date().toISOString() }).eq('id', ev.id)
      }

      // 2. Digests on each recipient's weekday, once the time has arrived, once per day.
      const { weekday, hhmm } = nowInAppTz()
      const today = todayYmdInAppTz()
      for (const r of recipients.filter((x) => x.mode === 'digest')) {
        if (r.digest_weekday !== weekday || hhmm < r.digest_time) continue
        if (ymdInAppTz(r.last_digest_at) === today) continue
        const { data: sinceRows } = await admin.from('legal_notification_queue').select('*').eq('firm_id', firm.id).is('digested_at', null).order('created_at').limit(200)
        const events = ((sinceRows ?? []) as Array<{ id: string; matter_id: string | null; trigger: string; payload: Row; created_at: string }>).filter((e) => canSee(r, e.matter_id))
        const mine = matters.filter((m) => canSee(r, m.id))
        const unsub = await unsubscribeLink(admin, r)
        const matterLines = mine.length ? mine.map((m) => `<li><b>${esc(m.payer_name)}</b> — ${esc(m.stage)}${m.handling_name ? ` · handling ${esc(m.handling_name)}` : ''}${m.released_at ? ` · since ${esc(String(m.released_at).slice(0, 10))}` : ''}</li>`).join('') : '<li>No open matters.</li>'
        const eventLines = events.length ? events.map((e) => `<li>${esc(String(e.created_at).slice(0, 10))} · ${e.trigger === 'referred' ? 'New account referred' : e.trigger === 'answer' ? 'Office answered' : 'Pulled back'}: <b>${esc(String(e.payload.payer ?? ''))}</b>${e.trigger === 'answer' && e.payload.body ? ` — ${esc(String(e.payload.body))}` : ''}</li>`).join('') : '<li>Nothing new since your last digest.</li>'
        const subject = `Weekly digest — ${mine.length} open matter${mine.length === 1 ? '' : 's'} at ${PORTAL_COMPANY.name}`
        const bodyHtml = wrap(`<p>Your weekly digest, ${esc(r.name)}.</p><h3 style="font-size:14px;margin:12px 0 4px">Open matters</h3><ul>${matterLines}</ul><h3 style="font-size:14px;margin:12px 0 4px">Since your last digest</h3><ul>${eventLines}</ul><p><a href="${portal}" style="display:inline-block;background:#b0662f;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none">Open the portal</a></p>`, unsub)
        const res = await sendEmailViaResend(r.email, subject, `${subject}\n\n${portal}`, bodyHtml, resendKey)
        if (!res.success) {
          result.errors.push(`${r.email}: ${res.error ?? 'digest failed'}`)
          continue
        }
        result.digests++
        await admin.from('legal_firm_recipients').update({ last_digest_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id)
        // An event is "digested" once every digest recipient who could see it has had it — approximate with the last digest recipient of the firm.
        const digestRecipients = recipients.filter((x) => x.mode === 'digest')
        if (digestRecipients.every((x) => x.id === r.id || ymdInAppTz(x.last_digest_at) === today || x.digest_weekday !== weekday)) {
          const ids = events.map((e) => e.id)
          if (ids.length) await admin.from('legal_notification_queue').update({ digested_at: new Date().toISOString() }).in('id', ids)
        }
      }
    }
    return json({ ok: true, ...result })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error', ...result }, 500)
  }
})
