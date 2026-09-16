import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { buildLegalDigestEmail, buildLegalNowEmail, legalPageHtml, legalWrapHtml, type LegalNowTrigger } from '../_shared/legalEmails.ts'
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
  return new Response(legalPageHtml(PORTAL_COMPANY.name, body), { status, headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
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
  // v2.3521: the link lands on the app's page (the platform relays this function's HTML as text/plain).
  const base = `${Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'}/legal/confirm`
  const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  if (!r.unsubscribe_token_hash) {
    await admin.from('legal_firm_recipients').update({ unsubscribe_token_hash: await sha256Hex(raw), updated_at: new Date().toISOString() }).eq('id', r.id)
    r.unsubscribe_token_hash = await sha256Hex(raw)
    return `${base}?t=${raw}&stop=1`
  }
  // An existing hash cannot be reversed; rotate it so this email's link works (older emails' links stop — acceptable).
  await admin.from('legal_firm_recipients').update({ unsubscribe_token_hash: await sha256Hex(raw), updated_at: new Date().toISOString() }).eq('id', r.id)
  return `${base}?t=${raw}&stop=1`
}

function portalLink(token: string | null): string {
  const origin = Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'
  return token ? `${origin}/legal?t=${token}` : origin
}

function wrap(bodyHtml: string, unsub: string): string {
  return legalWrapHtml(PORTAL_COMPANY.name, bodyHtml, unsub)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const url = new URL(req.url)

  // --- GET: confirm / unsubscribe --------------------------------------------
  // v2.3521: the platform relays this function's HTML as text/plain (recipients saw page source), so
  // the pages live in the app at /legal/confirm. `&json=1` is what that page calls; a bare link — the
  // ones in emails already sent — is redirected there with the same token. The work is the same.
  if (req.method === 'GET') {
    const confirm = url.searchParams.get('confirm')?.trim()
    const unsub = url.searchParams.get('unsubscribe')?.trim()
    const wantsJson = url.searchParams.get('json') === '1'
    const appPage = `${Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'}/legal/confirm`
    if (!wantsJson) {
      if (confirm) return Response.redirect(`${appPage}?t=${encodeURIComponent(confirm)}`, 302)
      if (unsub) return Response.redirect(`${appPage}?t=${encodeURIComponent(unsub)}&stop=1`, 302)
      return html('<h1>Nothing to do.</h1><p>This address only answers the links in the firm\'s emails.</p>', 400)
    }
    // What customers see (v2.3512): the sample token answers for Ann Sample — no row is read or written.
    if (confirm === 'sample') return json({ kind: 'confirmed', name: 'Ann Sample', email: 'ann@samplepartner.example.com' })
    if (unsub === 'sample') return json({ kind: 'unsubscribed', name: 'Ann Sample' })
    if (confirm && confirm.length >= 16) {
      const hash = await sha256Hex(confirm)
      const { data } = await admin.from('legal_firm_recipients').select('id, name, email, confirmed_at').eq('confirm_token_hash', hash).is('removed_at', null).maybeSingle()
      const r = data as { id: string; name: string; email: string; confirmed_at: string | null } | null
      if (!r) return json({ kind: 'expired', reason: 'Ask someone at the firm to add you again from the portal.' }, 404)
      if (!r.confirmed_at) await admin.from('legal_firm_recipients').update({ confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id)
      return json({ kind: 'confirmed', name: r.name, email: r.email })
    }
    if (unsub && unsub.length >= 16) {
      const hash = await sha256Hex(unsub)
      const { data } = await admin.from('legal_firm_recipients').select('id, name').eq('unsubscribe_token_hash', hash).maybeSingle()
      const r = data as { id: string; name: string } | null
      if (!r) return json({ kind: 'expired', reason: 'Use the link in a newer email, or stop emails from the portal.' }, 404)
      await admin.from('legal_firm_recipients').update({ paused_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id)
      return json({ kind: 'unsubscribed', name: r.name })
    }
    return json({ kind: 'expired', reason: 'This address only answers the links in the firm\'s emails.' }, 400)
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
      const digestRecipients = recipients.filter((x) => x.mode === 'digest')
      // An event is heard by whoever is subscribed when it happens — never replayed to whoever
      // joins later. With nobody confirmed at the firm (the state every firm starts in) the queue
      // is consumed as it arrives; with no digest people, the digest lane is consumed the same way.
      // Otherwise the first person to confirm would get every release since the firm was created.
      const stamp = new Date().toISOString()
      if (recipients.length === 0) {
        await admin.from('legal_notification_queue').update({ sent_now_at: stamp }).eq('firm_id', firm.id).is('sent_now_at', null)
        await admin.from('legal_notification_queue').update({ digested_at: stamp }).eq('firm_id', firm.id).is('digested_at', null)
        continue
      }
      if (digestRecipients.length === 0) await admin.from('legal_notification_queue').update({ digested_at: stamp }).eq('firm_id', firm.id).is('digested_at', null)
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
          // v2.3512: one builder for the sender and Settings → What customers see (_shared/legalEmails.ts).
          const mail = buildLegalNowEmail({
            companyName: PORTAL_COMPANY.name,
            firmName: firm.name,
            trigger: (ev.trigger === 'referred' || ev.trigger === 'answer' ? ev.trigger : 'pulled') as LegalNowTrigger,
            payer: String(ev.payload.payer ?? 'an account'),
            handling: ev.payload.handling ? String(ev.payload.handling) : null,
            note: ev.payload.note ? String(ev.payload.note) : null,
            body: ev.payload.body ? String(ev.payload.body) : null,
            portalUrl: portal,
            unsubscribeUrl: unsub,
          })
          const res = await sendEmailViaResend(r.email, mail.subject, mail.text, mail.html, resendKey)
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
        // v2.3512: one builder for the sender and Settings → What customers see (_shared/legalEmails.ts).
        const mail = buildLegalDigestEmail({
          companyName: PORTAL_COMPANY.name,
          recipientName: r.name,
          matters: mine.map((m) => ({ payerName: m.payer_name, stage: m.stage, handlingName: m.handling_name, releasedAt: m.released_at })),
          events: events.map((e) => ({ createdAt: String(e.created_at), trigger: (e.trigger === 'referred' || e.trigger === 'answer' ? e.trigger : 'pulled') as LegalNowTrigger, payer: String(e.payload.payer ?? ''), body: e.payload.body ? String(e.payload.body) : null })),
          portalUrl: portal,
          unsubscribeUrl: unsub,
        })
        const res = await sendEmailViaResend(r.email, mail.subject, mail.text, mail.html, resendKey)
        if (!res.success) {
          result.errors.push(`${r.email}: ${res.error ?? 'digest failed'}`)
          continue
        }
        result.digests++
        await admin.from('legal_firm_recipients').update({ last_digest_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', r.id)
        // An event is "digested" once every digest recipient who could see it has had it — approximate with the last digest recipient of the firm.
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
