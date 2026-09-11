import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'

/**
 * The firm's acts on its portal (Legal portal train, PR 4): one POST endpoint,
 * token-authenticated like submit-sub-portal, five kinds —
 *
 *   fee · cost          — an amount and a note; rolls into the matter's total demand
 *   step                — demand · suit · judgment · settled (+ detail); moves the matter's stage
 *   question            — free text for the office
 *   payment_received    — money the firm received; the office applies it to the job
 *
 * Every act is one legal_matter_entries row with via_portal = true and
 * acknowledged_at NULL — the office's Needs You reads exactly those. The firm
 * never marks anything paid, edits a job, or emails the customer through us.
 *
 * Guards: honeypot `website`, length caps, the matter must belong to the
 * firm and be in the with-firm set, 30 acts per firm per hour.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact the office.'
const WITH_FIRM_STAGES = ['referred', 'demand', 'suit', 'judgment']
const MAX_PER_HOUR = 30
const MAX_BODY = 2000
const MAX_AMOUNT = 1_000_000

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Link = { firm_id: string; revoked_at: string | null }

async function resolveLink(admin: SupabaseClient, token: string): Promise<Link | null> {
  let { data: link } = await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token', token).maybeSingle()
  if (!link) {
    const hash = await sha256Hex(token)
    link = (await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token_hash', hash).maybeSingle()).data
  }
  const l = link as Link | null
  return l && !l.revoked_at ? l : null
}

const str = (v: unknown, max = MAX_BODY): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return jsonResponse({ error: 'Bad request' }, 400)
    if (str(body.website, 100)) return jsonResponse({ ok: true }) // honeypot: pretend success, write nothing
    const token = str(body.token, 128)
    if (token.length < 16) return jsonResponse({ error: 'Missing token' }, 400)
    const kind = str(body.kind, 40)
    const matterId = str(body.matterId, 64)
    const RECIPIENT_KINDS = ['recipient_add', 'recipient_rules', 'recipient_stop', 'recipient_resume', 'recipient_resend']
    if (![...RECIPIENT_KINDS, 'fee', 'cost', 'step', 'question', 'payment_received'].includes(kind)) return jsonResponse({ error: 'Unknown act' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const link = await resolveLink(admin, token)
    if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    // --- The firm's people and their email rules (PR 5) ---------------------
    if (RECIPIENT_KINDS.includes(kind)) {
      const nowIso = new Date().toISOString()
      const sendConfirm = async (id: string, name: string, email: string): Promise<boolean> => {
        const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        await admin.from('legal_firm_recipients').update({ confirm_token_hash: await sha256Hex(raw), updated_at: nowIso }).eq('id', id)
        const key = Deno.env.get('RESEND_API_KEY')
        if (!key) return false
        const confirmUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/legal-notify-dispatch?confirm=${raw}`
        const subject = `Confirm your email for ${PORTAL_COMPANY.name}'s legal portal`
        const html = `<div style="font:15px/1.5 -apple-system,'Segoe UI',Roboto,sans-serif;color:#16283c;max-width:600px"><p>Someone at your firm added <b>${email}</b> to hear from ${PORTAL_COMPANY.name} about accounts referred to counsel.</p><p><a href="${confirmUrl}" style="display:inline-block;background:#b0662f;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none">Yes, email me</a></p><p style="color:#8a97a6;font-size:12px">Nothing else is sent to this address unless you click. If this wasn't you, ignore this email.</p></div>`
        const res = await sendEmailViaResend(email, subject, `${subject}\n\n${confirmUrl}`, html, key)
        return res.success
      }
      if (kind === 'recipient_add') {
        const name = str(body.name, 120)
        const email = str(body.email, 200).toLowerCase()
        const role = str(body.role, 60)
        if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonResponse({ error: 'A name and a working email, please.' }, 400)
        const { count: n } = await admin.from('legal_firm_recipients').select('id', { count: 'exact', head: true }).eq('firm_id', link.firm_id).is('removed_at', null)
        if ((n ?? 0) >= 12) return jsonResponse({ error: 'Twelve people is the limit — remove someone first.' }, 400)
        const { data: ins, error } = await admin.from('legal_firm_recipients').insert({ firm_id: link.firm_id, name, email, role, added_via_portal: true, mode: str(body.mode, 10) === 'digest' ? 'digest' : 'now', scope: str(body.scope, 10) === 'mine' ? 'mine' : 'all' }).select('id').single()
        if (error) return jsonResponse({ error: error.message.includes('legal_firm_recipients_email_idx') ? 'That address is already on the list.' : 'Could not add them.' }, 400)
        const sent = await sendConfirm((ins as { id: string }).id, name, email)
        return jsonResponse({ ok: true, confirmationSent: sent })
      }
      const rid = str(body.recipientId, 64)
      const { data: rec } = await admin.from('legal_firm_recipients').select('id, name, email, firm_id, removed_at').eq('id', rid).maybeSingle()
      const r = rec as { id: string; name: string; email: string; firm_id: string; removed_at: string | null } | null
      if (!r || r.firm_id !== link.firm_id || r.removed_at) return jsonResponse({ error: 'Not on your list.' }, 404)
      if (kind === 'recipient_rules') {
        const patch: Record<string, unknown> = { updated_at: nowIso }
        const mode = str(body.mode, 10)
        if (mode === 'now' || mode === 'digest') patch.mode = mode
        const scope = str(body.scope, 10)
        if (scope === 'all' || scope === 'mine') patch.scope = scope
        const wd = Number(body.digestWeekday)
        if (Number.isInteger(wd) && wd >= 1 && wd <= 7) patch.digest_weekday = wd
        const t = str(body.digestTime, 5)
        if (/^[0-2][0-9]:[0-5][0-9]$/.test(t)) patch.digest_time = t
        const { error } = await admin.from('legal_firm_recipients').update(patch).eq('id', r.id)
        return error ? jsonResponse({ error: 'Could not save the rule.' }, 500) : jsonResponse({ ok: true })
      }
      if (kind === 'recipient_stop') {
        await admin.from('legal_firm_recipients').update({ paused_at: nowIso, updated_at: nowIso }).eq('id', r.id)
        return jsonResponse({ ok: true })
      }
      if (kind === 'recipient_resume') {
        await admin.from('legal_firm_recipients').update({ paused_at: null, updated_at: nowIso }).eq('id', r.id)
        return jsonResponse({ ok: true })
      }
      // recipient_resend
      const sent = await sendConfirm(r.id, r.name, r.email)
      return jsonResponse({ ok: true, confirmationSent: sent })
    }

    if (!matterId) return jsonResponse({ error: 'Missing matter' }, 400)

    const { data: matter } = await admin.from('legal_matters').select('id, firm_id, stage, payer_name').eq('id', matterId).maybeSingle()
    const m = matter as { id: string; firm_id: string | null; stage: string; payer_name: string } | null
    if (!m || m.firm_id !== link.firm_id || !WITH_FIRM_STAGES.includes(m.stage)) return jsonResponse({ error: 'That matter is not with your firm.' }, 403)

    // Rate limit: portal acts across the firm's matters in the last hour.
    const since = new Date(Date.now() - 3_600_000).toISOString()
    const { data: matterIds } = await admin.from('legal_matters').select('id').eq('firm_id', link.firm_id)
    const ids = ((matterIds ?? []) as Array<{ id: string }>).map((r) => r.id)
    const { count } = await admin.from('legal_matter_entries').select('id', { count: 'exact', head: true }).in('matter_id', ids.length ? ids : [matterId]).eq('via_portal', true).gte('created_at', since)
    if ((count ?? 0) >= MAX_PER_HOUR) return jsonResponse({ error: 'Too many changes in the last hour. Please try again later.' }, 429)

    const today = todayYmdInAppTz()
    const occurredOn = /^\d{4}-\d{2}-\d{2}$/.test(str(body.occurredOn, 10)) ? str(body.occurredOn, 10) : today
    const note = str(body.note)
    let amount: number | null = null
    let entryBody = note
    const meta: Record<string, unknown> = {}

    if (kind === 'fee' || kind === 'cost') {
      const n = Number(body.amount)
      if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return jsonResponse({ error: 'Enter an amount.' }, 400)
      if (!note) return jsonResponse({ error: 'Say what the amount is for.' }, 400)
      amount = Math.round(n * 100) / 100
    } else if (kind === 'payment_received') {
      const n = Number(body.amount)
      if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) return jsonResponse({ error: 'Enter the amount received.' }, 400)
      amount = Math.round(n * 100) / 100
      meta.applied = false
      entryBody = note || 'Payment received by counsel'
    } else if (kind === 'step') {
      const stage = str(body.stage, 20)
      if (!['demand', 'suit', 'judgment', 'settled'].includes(stage)) return jsonResponse({ error: 'Pick a step.' }, 400)
      const label = { demand: 'Demand sent on firm letterhead', suit: 'Suit filed', judgment: 'Judgment entered', settled: 'Settled' }[stage as 'demand' | 'suit' | 'judgment' | 'settled']
      entryBody = note ? `${label} — ${note}` : label
      meta.stage = stage
      const patch: Record<string, unknown> = { stage, updated_at: new Date().toISOString() }
      if (stage === 'settled') {
        patch.closed_at = new Date().toISOString()
        patch.closed_reason = 'Settled — reported by the firm'
      }
      const { error: upErr } = await admin.from('legal_matters').update(patch).eq('id', matterId)
      if (upErr) return jsonResponse({ error: 'Could not record the step.' }, 500)
    } else if (kind === 'question') {
      if (!note) return jsonResponse({ error: 'Type your question.' }, 400)
    }

    const { data: inserted, error } = await admin
      .from('legal_matter_entries')
      .insert({ matter_id: matterId, kind, amount, body: entryBody, occurred_on: occurredOn, meta, via_portal: true })
      .select('id')
      .single()
    if (error) return jsonResponse({ error: 'Could not save that.' }, 500)
    return jsonResponse({ ok: true, entryId: (inserted as { id: string }).id })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
