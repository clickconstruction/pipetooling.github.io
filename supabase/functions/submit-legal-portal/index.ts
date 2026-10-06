import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { sendEmailViaResend } from '../_shared/resendSendEmail.ts'
import { COMPANY_EMAIL_FROM } from '../_shared/emailFrom.ts'
import { buildLegalConfirmEmail } from '../_shared/legalEmails.ts'
// Item 7 (#85): a thrown error is logged; the firm reads one plain sentence.
import { unexpectedErrorBody } from '../_shared/legalPortalErrors.ts'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { legalRecipientSendPatch } from '../_shared/legalNotifyLedger.ts'
import { isLegalClientId, LEGAL_ACTS_PER_MATTER_PER_HOUR, legalActDateProblem, legalRateLimitMessage } from '../_shared/legalPortalActs.ts'
import { matterOpenBalance, SETTLEMENT_ASK_FLAVOR, settlementBelowFloor, settlementFloorDollars, settlementFloorOf } from '../_shared/legalSettlement.ts'
import { firmStepDecision, isLegalFirmStep, LEGAL_FIRM_STEP_WORDS, legalMatterOnPortal } from '../_shared/legalStages.ts'

/**
 * The firm's acts on its portal (Legal portal train, PR 4): one POST endpoint,
 * token-authenticated like submit-sub-portal, five kinds (six with `answer`, #41 PR 3) —
 *
 *   fee · cost          — an amount and a note; rolls into the matter's total demand
 *   step                — demand · suit · judgment · post_judgment · payment_plan · settled ·
 *                         uncollectible · dismissed (+ detail); moves the matter's stage.
 *                         Since #85 item 16 an end (settled) moves the stage but not closed_at — the
 *                         matter stays here for the check until the office closes it — and a step that
 *                         would move the stage backward is recorded with meta.proposed and waits on
 *                         the office (_shared/legalStages.ts firmStepDecision).
 *   question            — free text for the office
 *   payment_received    — money the firm received; the office applies it to the job
 *
 * Every act is one legal_matter_entries row with via_portal = true and
 * acknowledged_at NULL — the office's Needs You reads exactly those. The firm
 * never marks anything paid, edits a job, or emails the customer through us.
 *
 * Guards: the link is the key, length caps, the matter must belong to the
 * firm and be in the with-firm set, 60 acts per matter per hour (#85 item 18; 30 per firm
 * before), twelve people. No honeypot (v2.4622): the page is behind a private link, and a
 * hidden box a password manager fills would have made a real act vanish behind "Saved".
 * Since item 18 every matter act may carry `occurredOn` (the date the firm sets,
 * not in the future), `clientId` (a uuid: a retry or double click saves once, the first
 * entry is answered) and `recordedById` (a person on the firm's list → meta.recordedBy).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Item 22 (#85): an answer about one firm's matters. No cache holds it, and no page learns where it came from.
const privateHeaders = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact the office.'
const MAX_BODY = 2000
const MAX_AMOUNT = 1_000_000

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, ...privateHeaders, 'Content-Type': 'application/json' } })
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Link = { firm_id: string; revoked_at: string | null }

async function resolveLink(admin: SupabaseClient, token: string): Promise<Link | null> {
  // The hash first (item 22): the raw column is on its way out; it stays as the fallback for a link minted before the hash existed.
  let { data: link } = await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token_hash', await sha256Hex(token)).maybeSingle()
  if (!link) link = (await admin.from('legal_portal_links').select('firm_id, revoked_at').eq('token', token).maybeSingle()).data
  const l = link as Link | null
  return l && !l.revoked_at ? l : null
}

const str = (v: unknown, max = MAX_BODY): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, ...privateHeaders } })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return jsonResponse({ error: 'Bad request' }, 400)
    const token = str(body.token, 128)
    if (token.length < 16) return jsonResponse({ error: 'Missing token' }, 400)
    const kind = str(body.kind, 40)
    const matterId = str(body.matterId, 64)
    const RECIPIENT_KINDS = ['recipient_add', 'recipient_rules', 'recipient_stop', 'recipient_resume', 'recipient_resend']
    if (![...RECIPIENT_KINDS, 'fee', 'cost', 'step', 'question', 'answer', 'payment_received'].includes(kind)) return jsonResponse({ error: 'Unknown act' }, 400)

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
        // v2.4662: a confirmation that does not go marks the person "not reaching" (send_failed_since), as the dispatcher does.
        const note = async (res: { success: boolean; error?: string }) => {
          const { data: prev } = await admin.from('legal_firm_recipients').select('send_failed_since').eq('id', id).maybeSingle()
          await admin.from('legal_firm_recipients').update(legalRecipientSendPatch((prev as { send_failed_since?: string | null } | null)?.send_failed_since ?? null, res, new Date().toISOString())).eq('id', id)
        }
        if (!key) {
          await note({ success: false, error: 'Email is not set up on the server.' })
          return false
        }
        // v2.3521: the link lands on the app's page; the function's GET is what that page calls.
        const confirmUrl = `${Deno.env.get('APP_ORIGIN') ?? 'https://clicktooling.com'}/legal/confirm?t=${raw}`
        // v2.3512: one builder for the sender and Settings → What customers see (_shared/legalEmails.ts).
        const mail = buildLegalConfirmEmail({ companyName: PORTAL_COMPANY.name, email, confirmUrl })
        const res = await sendEmailViaResend(email, mail.subject, mail.text, mail.html, key, { from: COMPANY_EMAIL_FROM })
        await note(res)
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
        // v2.4662: turning emails back on is the one rotation of the stop link — a new salt, so a stop link
        // in an old (perhaps forwarded) email no longer pauses them. The dispatcher mints the new one.
        // Two writes: the resume never waits on the salt column.
        await admin.from('legal_firm_recipients').update({ paused_at: null, updated_at: nowIso }).eq('id', r.id)
        await admin.from('legal_firm_recipients').update({ unsubscribe_salt: crypto.randomUUID().replace(/-/g, ''), unsubscribe_token_hash: null }).eq('id', r.id)
        return jsonResponse({ ok: true })
      }
      // recipient_resend
      const sent = await sendConfirm(r.id, r.name, r.email)
      return jsonResponse({ ok: true, confirmationSent: sent })
    }

    if (!matterId) return jsonResponse({ error: 'Missing matter' }, 400)

    // select('*'): the settlement floor columns (#85 item 20) arrive with their migration; until then they read as no floor.
    const { data: matter } = await admin.from('legal_matters').select('*').eq('id', matterId).maybeSingle()
    const m = matter as { id: string; firm_id: string | null; stage: string; payer_name: string; closed_at: string | null; settlement_floor_amount?: unknown; settlement_floor_pct?: unknown } | null
    // #85 item 16: a working stage, or an end (settled …) the office has not closed yet.
    if (!m || m.firm_id !== link.firm_id || !legalMatterOnPortal(m)) return jsonResponse({ error: 'That matter is not with your firm.' }, 403)

    // #85 item 18 (d): one save per act. A retry or a double click carries the same key and gets the first entry back.
    const clientId = isLegalClientId(body.clientId) ? (body.clientId as string).toLowerCase() : null
    if (clientId) {
      const { data: dup } = await admin.from('legal_matter_entries').select('id').eq('matter_id', matterId).eq('meta->>clientId', clientId).limit(1).maybeSingle()
      if (dup) return jsonResponse({ ok: true, entryId: (dup as { id: string }).id, duplicate: true })
    }

    // #85 item 18 (e): the hourly limit is per matter, and the refusal names it and when it lifts.
    const since = new Date(Date.now() - 3_600_000).toISOString()
    const { data: recent, count } = await admin.from('legal_matter_entries').select('created_at', { count: 'exact' }).eq('matter_id', matterId).eq('via_portal', true).gte('created_at', since).order('created_at').limit(1)
    if ((count ?? 0) >= LEGAL_ACTS_PER_MATTER_PER_HOUR) {
      const oldest = ((recent ?? []) as Array<{ created_at: string }>)[0]?.created_at
      const retryAt = oldest ? new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: 'numeric', minute: '2-digit' }).format(new Date(new Date(oldest).getTime() + 3_600_000)) : null
      return jsonResponse({ error: legalRateLimitMessage(m.payer_name, retryAt) }, 429)
    }

    // #85 item 18 (c): the date the firm sets; today when it sends none.
    const today = todayYmdInAppTz()
    const typedOn = str(body.occurredOn, 10)
    if (typedOn) {
      const problem = legalActDateProblem(typedOn, today)
      if (problem) return jsonResponse({ error: problem }, 400)
    }
    const occurredOn = typedOn || today
    const note = str(body.note)
    let amount: number | null = null
    let entryBody = note
    const meta: Record<string, unknown> = {}
    let entryKind = kind
    let notice: string | null = null
    if (clientId) meta.clientId = clientId
    // #85 item 18 (b): who recorded it — a person on the firm's own list, never free text.
    const recordedById = str(body.recordedById, 64)
    if (recordedById) {
      const { data: who } = await admin.from('legal_firm_recipients').select('id, name').eq('id', recordedById).eq('firm_id', link.firm_id).is('removed_at', null).maybeSingle()
      // An id that names nobody on this firm's list is refused, never saved as "the firm".
      if (!who) return jsonResponse({ error: 'Pick who recorded this from the list.' }, 400)
      meta.recordedBy = { id: (who as { id: string }).id, name: (who as { name: string }).name }
    }

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
      // Every step the firm records (#85 item 16; the CHECK takes them since migration 20261006150000).
      const step = str(body.stage, 20)
      if (!isLegalFirmStep(step)) return jsonResponse({ error: 'Pick a step.' }, 400)
      const label = LEGAL_FIRM_STEP_WORDS[step]
      entryBody = note ? `${label} — ${note}` : label
      meta.stage = step
      const decision = firmStepDecision(m.stage, step)
      // #85 item 20: settlement authority as a threshold. Under the office's floor, the settled step is a settlement ask.
      const floor = step === 'settled' && decision !== 'ask' ? settlementFloorOf(m) : null
      const proposed = Number(body.amount)
      const hasAmount = Number.isFinite(proposed) && proposed > 0 && proposed <= MAX_AMOUNT
      if (floor && !hasAmount) return jsonResponse({ error: 'Enter the settlement amount. The office set a floor on this matter.' }, 400)
      if (step === 'settled' && hasAmount) {
        amount = Math.round(proposed * 100) / 100
        meta.settlementAmount = amount
      }
      let balance = 0
      // A percent floor needs the balance. When it cannot be read, or the matter has no jobs, the floor is
      // unknown: the settlement goes to the office as an ask, never through at $0 (item 20 review).
      let floorUnknown = false
      if (floor?.pct != null && amount != null) {
        const { data: links, error: linkErr } = await admin.from('legal_matter_jobs').select('job_id').eq('matter_id', matterId)
        const jobIds = ((links ?? []) as Array<{ job_id: string }>).map((l) => l.job_id)
        if (linkErr || !jobIds.length) floorUnknown = true
        else {
          const [jr, ir, pr] = await Promise.all([
            admin.from('jobs_ledger').select('id, revenue, payments_made').in('id', jobIds),
            admin.from('jobs_ledger_invoices').select('id, job_id, amount, status, sequence_order, billed_at, agreed_write_down_at, agreed_write_down_previous_amount').in('job_id', jobIds),
            admin.from('jobs_ledger_payments').select('job_id, invoice_id, amount, paid_on').in('job_id', jobIds),
          ])
          if (jr.error || ir.error || pr.error || !(jr.data ?? []).length) floorUnknown = true
          else balance = matterOpenBalance((jr.data ?? []) as Array<{ id: string }>, (ir.data ?? []) as Array<{ id: string; job_id: string }>, (pr.data ?? []) as Array<{ job_id: string }>)
        }
      }
      if (floor && amount != null && (floorUnknown || settlementBelowFloor(amount, floor, balance))) {
        const floorDollars = settlementFloorDollars(floor, balance) ?? 0
        const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        entryKind = 'question'
        entryBody = `Proposed settlement ${money(amount)}${note ? ` — ${note}` : ''}`
        meta.flavor = SETTLEMENT_ASK_FLAVOR
        meta.proposedAmount = amount
        meta.floor = floorDollars
        if (floor.pct != null) meta.floorPct = floor.pct
        delete meta.settlementAmount
        notice = floorUnknown
          ? `The office's floor could not be worked out just now, so ${money(amount)} went to the office as a settlement ask. The stage moves when they sign off.`
          : `${money(amount)} is below the office's floor of ${money(floorDollars)}. It went to the office as a settlement ask. The stage moves when they sign off.`
        if (floorUnknown) meta.floorUnknown = true
      } else if (decision === 'ask') {
        // Backward (judgment → demand, or anything after an end): recorded, the stage waits for the office.
        meta.proposed = true
        meta.from = m.stage
        notice = 'Recorded. That step would move the stage back, so the stage stays where it is until the office agrees.'
      } else if (decision === 'move') {
        const { error: upErr } = await admin.from('legal_matters').update({ stage: step, updated_at: new Date().toISOString() }).eq('id', matterId)
        if (upErr) return jsonResponse({ error: 'Could not record the step.' }, 500)
        if (step === 'settled') notice = 'Recorded. The matter stays here until the office closes it, so you can still record the payment and your last costs.'
      }
    } else if (kind === 'question') {
      if (!note) return jsonResponse({ error: 'Type your question.' }, 400)
    } else if (kind === 'answer') {
      // #41 PR 3: the firm answers an ask the office wrote (a `question` entry with via_portal = false) — words,
      // or a sign-off (signedOff true / false) with an optional note. The ask must be this matter's and still open.
      const askId = str(body.askId, 64)
      const signedOff = typeof body.signedOff === 'boolean' ? body.signedOff : null
      if (!askId) return jsonResponse({ error: 'Which ask is this an answer to?' }, 400)
      const { data: askRow } = await admin.from('legal_matter_entries').select('id, matter_id, kind, via_portal, acknowledged_at').eq('id', askId).maybeSingle()
      const ask = askRow as { id: string; matter_id: string; kind: string; via_portal: boolean; acknowledged_at: string | null } | null
      if (!ask || ask.matter_id !== matterId || ask.kind !== 'question' || ask.via_portal) return jsonResponse({ error: 'That ask is not on this matter.' }, 400)
      if (ask.acknowledged_at) return jsonResponse({ error: 'The office withdrew that ask.' }, 400)
      if (signedOff == null && !note) return jsonResponse({ error: 'Type your answer.' }, 400)
      meta.askId = askId
      if (signedOff != null) meta.signedOff = signedOff
      entryBody = note || (signedOff === true ? 'Signed off' : signedOff === false ? 'Not yet' : '')
    }

    const { data: inserted, error } = await admin
      .from('legal_matter_entries')
      .insert({ matter_id: matterId, kind: entryKind, amount, body: entryBody, occurred_on: occurredOn, meta, via_portal: true })
      .select('id')
      .single()
    if (error) return jsonResponse({ error: 'Could not save that.' }, 500)
    return jsonResponse({ ok: true, entryId: (inserted as { id: string }).id, ...(notice ? { notice } : {}) })
  } catch (e) {
    return jsonResponse(unexpectedErrorBody('submit-legal-portal', e), 500)
  }
})
