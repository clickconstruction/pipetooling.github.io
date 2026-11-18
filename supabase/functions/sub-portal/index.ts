import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PORTAL_COMPANY } from '../_shared/portalCompany.ts'
import { sampleStateFromToken } from '../_shared/customerSample.ts'
import { sampleSubPortalResponse } from '../_shared/customerSampleFixtures.ts'
import {
  attachSheetAgreements,
  buildSubDocuments,
  buildSubOffers,
  buildSubPaymentLines,
  buildSubPaymentTraceLines,
  buildSubSheets,
  buildSubTotals,
  nextPayRunYmd,
  addDaysYmd,
  type SubAgreementRow,
  type SubDocRow,
  type SubItemRow,
  type SubOfferRow,
  type SubPaymentEventRow,
  type SubPaymentRow,
  type SubSheetRow, cleanPortalAddress } from '../_shared/subPortalStatement.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { attachCustomerPaid, customerPaidDays, type TiedBillPaymentRow, type TiedBillRow } from '../_shared/subPortalCustomerPaid.ts'
import { publicViewDecision } from '../_shared/publicViewCounting.ts'
import { grantPlansLink } from '../_shared/viewGrant.ts'
import { internalFunctionCall } from '../_shared/internalFunctionCall.ts'
import {
  buildSubPortalPapers,
  planPortalAnswer,
  portalAnswers,
  portalPaperSet,
  portalPaymentKeyOf,
  PORTAL_WRONG_NOTES_A_DAY,
  type PapersAckRow,
  type PapersAssigneeRow,
  type PapersCreditRow,
  type PapersItemRow,
  type PapersPaymentRow,
  type PapersPersonRow,
  type PapersRegisterRow,
  type PapersSendingRow,
  type PapersSheetRow,
  type PapersUserRow,
  type SubPortalPapers,
  type SubPortalPapersRows,
} from '../_shared/subPortalPapers.ts'
import type { PaperCompany } from '../_shared/subPapers.ts'
import {
  blankShutPaymentMemos,
  blankShutSubPortalRows,
  commitmentJobId,
  jobsWaitingOnPerson,
  sheetJobMap,
  subPortalJobIds,
  type CommitmentTie,
  type SheetTie,
} from '../_shared/subPortalJobPapers.ts'

/**
 * Sub portal payload (sub-portal train): resolves a sub portal link token OR
 * a custom address slug and returns ONLY that person's Work & Pay statement —
 * sheets with line items, open balances and their stage (working →
 * walkthrough → customer_pay, v2.2767), the payment ledger (memos are
 * sub-visible unless hidden), open work offers, and paperwork STATUS (never
 * document contents). No auth: the link is the capability.
 *
 * The customer portal is the architectural template (customer-portal/index.ts)
 * — same token/slug resolution, same no-mint-on-demand rule for slugs, same
 * fire-and-forget view counting.
 *
 * Papers (punch list #371, step 1): the read also hands back `papers`, every sheet
 * that is the person's alone, paid ones too, as the papers' kernel reads a sheet,
 * with the answers they already gave. A number is read from the register and never
 * given here. A POST with the same token writes one of two answers to
 * `sub_paper_acks`: `got_it` on a payment, `something_wrong` on a statement or a
 * payment. Shaping and the rules live in `_shared/subPortalPapers.ts`.
 * A note that something is wrong also tells the office (v2.7609): a line in the
 * dispatch inbox and a push, as `submit-sub-portal` tells it of a sub's other notes.
 *
 * Papers before a job opens (step 6): a sub with no login has no row security
 * to hide a job from them, so this read is the lock. Every Pipeline job the
 * page shows something of is asked about once (`job_papers_for_person`). A job
 * with a paper the sub has not signed is shut: its address, name, scope lines,
 * notes, memos and plans link are held back, its number, days and money stay,
 * and `job_papers` lists it with its papers for the page's card. A job whose
 * papers cannot be read is held shut too. The rule and the blanking live in
 * `_shared/subPortalJobPapers.ts`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINK_INACTIVE_MSG = 'This link is no longer active. Please contact our office for a new one.'

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Papers (punch list #371) ─────────────────────────────────────────────────

const ISSUER_KEY = 'physical_invoice_issuer_v1'

// deno-lint-ignore no-explicit-any
type Admin = any

/**
 * Every row a filter matches, read a page at a time: a long history must not stop at the API's row cap, since a
 * payment left off would read as money still open. Ids go in parts so the address stays short. A refused read throws.
 */
async function readEvery<T>(admin: Admin, table: string, columns: string, order: readonly string[], filter: { column: string; in: readonly string[] } | { column: string; eq: string }): Promise<T[]> {
  const parts: Array<readonly string[] | null> = []
  if ('in' in filter) for (let i = 0; i < filter.in.length; i += 150) parts.push(filter.in.slice(i, i + 150))
  else parts.push(null)
  const out: T[] = []
  for (const part of parts) {
    for (let from = 0; from < 50000; from += 1000) {
      let q = admin.from(table).select(columns)
      q = part ? q.in(filter.column, part) : q.eq(filter.column, (filter as { eq: string }).eq)
      for (const column of order) q = q.order(column, { ascending: true })
      const { data, error } = await q.range(from, from + 999)
      if (error) throw new Error(`${table}: ${(error as { message?: string }).message ?? 'read refused'}`)
      const rows = (data ?? []) as T[]
      out.push(...rows)
      if (rows.length < 1000) break
    }
  }
  return out
}

/** The rows the papers are built from. Every read is the page's own and throws when refused, the answers aside. */
async function readPapersRows(admin: Admin, personId: string, laborJobIds: readonly string[]): Promise<SubPortalPapersRows> {
  const none = { personId, sheets: [], items: [], payments: [], assignees: [], people: [], users: [], jobNames: {}, sendings: [], credits: [], register: [], acks: [] as PapersAckRow[] }
  // What the sub answered is not a figure: a database the answers' migration has not reached reads as no answer yet.
  let acks: PapersAckRow[] = []
  try {
    acks = await readEvery<PapersAckRow>(admin, 'sub_paper_acks', 'id, kind, paper_id, labor_job_id, sending_id, payment_id, note, created_at', ['id'], { column: 'person_id', eq: personId })
  } catch (e) {
    console.error('sub-portal papers: answers not read', e)
  }
  if (laborJobIds.length === 0) return { ...none, acks }
  const sheets = await readEvery<PapersSheetRow>(admin, 'people_labor_jobs', 'id, assigned_to_name, address, job_number, job_ledger_id, job_date, created_at, labor_rate', ['id'], { column: 'id', in: laborJobIds })
  const items = await readEvery<PapersItemRow>(admin, 'people_labor_job_items', 'job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order', ['job_id', 'sequence_order', 'id'], { column: 'job_id', in: laborJobIds })
  const payments = await readEvery<PapersPaymentRow>(admin, 'people_labor_job_payments', 'id, job_id, amount, memo, payment_date, created_at, hidden_from_sub, method, method_ref, sending_id', ['id'], { column: 'job_id', in: laborJobIds })
  // Everyone named on those sheets: who else is on a sheet decides whether it is this person's alone.
  const assignees = await readEvery<PapersAssigneeRow>(admin, 'people_labor_job_assignees', 'labor_job_id, person_id', ['labor_job_id', 'person_id'], { column: 'labor_job_id', in: laborJobIds })
  const personIds = [...new Set(assignees.map((a) => a.person_id))]
  const people = personIds.length > 0 ? await readEvery<PapersPersonRow>(admin, 'people', 'id, name, kind, account_user_id', ['id'], { column: 'id', in: personIds }) : []
  const userIds = [...new Set(people.map((p) => p.account_user_id ?? '').filter(Boolean))]
  const users = userIds.length > 0 ? await readEvery<PapersUserRow>(admin, 'users', 'id, role', ['id'], { column: 'id', in: userIds }) : []
  const ledgerIds = [...new Set(sheets.map((s) => s.job_ledger_id ?? '').filter(Boolean))]
  const jobNames: Record<string, string> = {}
  if (ledgerIds.length > 0) {
    for (const j of await readEvery<{ id: string; job_name: string | null }>(admin, 'jobs_ledger', 'id, job_name', ['id'], { column: 'id', in: ledgerIds })) {
      const name = (j.job_name ?? '').trim()
      if (name) jobNames[j.id] = name
    }
  }
  const sendingIds = [...new Set(payments.map((p) => p.sending_id ?? '').filter(Boolean))]
  const sendings = sendingIds.length > 0 ? await readEvery<PapersSendingRow>(admin, 'sub_payment_sendings', 'id, number', ['id'], { column: 'id', in: sendingIds }) : []
  const paymentIds = payments.map((p) => p.id)
  const credits = paymentIds.length > 0 ? await readEvery<PapersCreditRow>(admin, 'sub_credit_entries', 'id, payment_id, amount', ['id'], { column: 'payment_id', in: paymentIds }) : []
  // The register is read, never written: a number shows only where the office has made the paper.
  const register = await readEvery<PapersRegisterRow>(admin, 'sub_papers', 'id, kind, number, revision, labor_job_id, sending_id, payment_id, issued_at, replaced_by, voided_at, fingerprint', ['id'], { column: 'person_id', eq: personId })
  return { personId, sheets, items, payments, assignees, people, users, jobNames, sendings, credits, register, acks }
}

/** The letterhead the office's papers print (Settings, the bill's own block), and the phone a sub is told to call. */
async function readPaperCompany(admin: Admin): Promise<{ company: PaperCompany; officePhone: string }> {
  let issuer: Record<string, unknown> | null = null
  try {
    const { data } = await admin.from('app_settings').select('value_text').eq('key', ISSUER_KEY).maybeSingle()
    const raw = (data as { value_text?: string | null } | null)?.value_text
    const parsed = raw ? JSON.parse(raw) : null
    issuer = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    issuer = null
  }
  const s = (k: string) => (issuer && typeof issuer[k] === 'string' ? (issuer[k] as string).trim() : '')
  const lines = [s('addressText').replace(/\n+/g, ', '), s('phone'), s('email')].filter(Boolean)
  return { company: { name: s('companyName') || PORTAL_COMPANY.name, lines }, officePhone: s('phone') || PORTAL_COMPANY.phone }
}

/**
 * A note that something is wrong is the one answer that asks the office to act (punch list #371, call 4), so the
 * office is told the way it hears a sub's other notes: a line in the dispatch inbox and a push, as `submit-sub-portal`
 * does. The answer is already saved by now, so a note that cannot be dropped is logged and nothing else fails.
 */
async function tellOfficeSomethingIsWrong(admin: Admin, link: { id?: string | null; created_by?: string | null }, person: { id: string; name: string }, what: string, row: { labor_job_id: string | null; sending_id: string | null; payment_id: string | null; note: string | null }, ackId: string | null): Promise<void> {
  try {
    // dispatch_requests.from_user_id is NOT NULL: the setting, else who made the link, else a dev. submit-sub-portal's chain.
    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', 'portal_requests_from_user_id').maybeSingle()
    const configured = ((setting as { value_text?: string | null } | null)?.value_text ?? '').trim()
    let fromUserId: string | null = /^[0-9a-f-]{36}$/.test(configured) ? configured : (link.created_by ?? null)
    if (!fromUserId) {
      const { data: dev } = await admin.from('users').select('id').eq('role', 'dev').limit(1).maybeSingle()
      fromUserId = (dev as { id?: string } | null)?.id ?? null
    }
    if (!fromUserId) return
    const note = (row.note ?? '').trim()
    const { data: inserted, error } = await admin
      .from('dispatch_requests')
      .insert({
        from_user_id: fromUserId,
        title: `${person.name} says something is wrong on ${what}: “${note.slice(0, 120)}”`,
        pending_payload: { source: 'sub_portal', subPortalLinkId: link.id ?? null, kind: 'sub_paper_wrong', personId: person.id, personName: person.name, about: what, laborJobId: row.labor_job_id, sendingId: row.sending_id, paymentId: row.payment_id, ackId, note },
      })
      .select('id')
      .single()
    if (error || !inserted) {
      console.error('sub-portal: the office was not told of a note', error)
      return
    }
    // The push, as an internal caller: a sub has no session, so the service key is the bearer.
    const call = internalFunctionCall(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'notify-dispatch-request', { dispatch_request_id: (inserted as { id: string }).id })
    const res = await fetch(call.url, call.init)
    if (!res.ok) console.error('notify-dispatch-request refused', res.status, await res.text().catch(() => ''))
  } catch (e) {
    console.error('sub-portal: the office was not told of a note', e)
  }
}

/** One answer from the sub's page: *Got it* on a payment, or *Something is wrong* on a statement or a payment. */
async function answerFromPage(req: Request, admin: Admin, link: { id?: string | null; created_by?: string | null }, person: { id: string; name: string }, body: Record<string, unknown>): Promise<Response> {
  // The office looking at a sub's page is not the sub: an answer is the sub's own word, kept as one.
  const who = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
  if (who.viewer !== 'outside') return jsonResponse({ error: 'This is the office looking at the page. Only the sub can answer, from their own link.' }, 403)
  const { data: junctionRows, error: junctionError } = await admin.from('people_labor_job_assignees').select('labor_job_id').eq('person_id', person.id)
  if (junctionError) throw junctionError
  const laborJobIds = [...new Set(((junctionRows ?? []) as Array<{ labor_job_id: string }>).map((r) => r.labor_job_id))]
  const rows = await readPapersRows(admin, person.id, laborJobIds)
  const { company } = await readPaperCompany(admin)
  const set = portalPaperSet(rows, { subName: person.name, company, now: new Date() })
  const plan = planPortalAnswer(body, rows, set)
  if (!plan.ok) return jsonResponse({ error: plan.error }, plan.status)
  const key = portalPaymentKeyOf(plan.row) || plan.row.labor_job_id || ''
  // A payment is marked received once. A second press changes nothing and reads the first day back.
  if (plan.row.kind === 'received' && plan.already) return jsonResponse({ ok: true, already: true, received: { [key]: plan.already } })
  if (plan.row.kind === 'something_wrong') {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: recent } = await admin.from('sub_paper_acks').select('id').eq('person_id', person.id).eq('kind', 'something_wrong').gte('created_at', since).limit(PORTAL_WRONG_NOTES_A_DAY + 1)
    if (((recent ?? []) as unknown[]).length >= PORTAL_WRONG_NOTES_A_DAY) return jsonResponse({ error: 'You have sent the office several notes today. Please call the office about anything more.' }, 429)
  }
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const { data: saved, error } = await admin
    .from('sub_paper_acks')
    .insert({ ...plan.row, said_by_name: person.name, said_from: fwd || req.headers.get('cf-connecting-ip') || null })
    .select('id, kind, paper_id, labor_job_id, sending_id, payment_id, note, created_at')
    .single()
  if (error) {
    // Two presses at the same moment: the table keeps one *received* per payment, and the second reads as done.
    if ((error as { code?: string }).code === '23505' && plan.row.kind === 'received') {
      return jsonResponse({ ok: true, already: true, received: portalAnswers([{ kind: 'received', paper_id: null, labor_job_id: null, sending_id: plan.row.sending_id, payment_id: plan.row.payment_id, note: null, created_at: new Date().toISOString() }]).received })
    }
    console.error('sub-portal answer not saved', error)
    return jsonResponse({ error: 'That could not be saved. Please try again, or call the office.' }, 500)
  }
  const said = portalAnswers([saved as PapersAckRow])
  if (plan.row.kind === 'something_wrong') await tellOfficeSomethingIsWrong(admin, link, person, plan.what, plan.row, (saved as { id?: string | null }).id ?? null)
  return plan.row.kind === 'received' ? jsonResponse({ ok: true, already: false, received: said.received }) : jsonResponse({ ok: true, wrong: said.wrong[0] ?? null })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = new URL(req.url)
    // An answer (punch list #371) is a POST. Its token rides in the body, never in the address.
    const isAnswer = req.method === 'POST'
    let answerBody: Record<string, unknown> = {}
    if (isAnswer) {
      const parsed = await req.json().catch(() => null)
      if (!parsed || typeof parsed !== 'object') return jsonResponse({ error: 'Nothing was sent.' }, 400)
      answerBody = parsed as Record<string, unknown>
    }
    const fromBody = (k: string) => (typeof answerBody[k] === 'string' ? (answerBody[k] as string) : null)
    const rawToken = (isAnswer ? fromBody('token') : url.searchParams.get('token'))?.trim()
    const rawSlug = (isAnswer ? fromBody('slug') : url.searchParams.get('slug'))?.trim().toLowerCase()
    const sample = sampleStateFromToken(rawToken)
    if (!sample && (!rawToken || rawToken.length < 16 || rawToken.length > 128) && !rawSlug) {
      return jsonResponse({ error: 'Missing token' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // What customers see (Settings dev tab): the sample token renders Sam's Plumbing's hard-coded
    // statement over the live pay-run settings — no sign-in. No person, no rows.
    if (sample && isAnswer) return jsonResponse({ error: 'This is a sample page. Nothing is sent from it.' }, 400)
    if (sample) {
      const { data: sampleSettings } = await admin.from('app_settings').select('key, value_text').in('key', ['sub_pay_run_day', 'sub_pay_explainer'])
      const m = new Map(((sampleSettings ?? []) as Array<{ key: string; value_text: string | null }>).map((r) => [r.key, r.value_text]))
      const day = (m.get('sub_pay_run_day') ?? '').trim() || null
      const today = todayYmdInAppTz()
      return jsonResponse(sampleSubPortalResponse(PORTAL_COMPANY, today, { day, nextRun: nextPayRunYmd(today, day), explainer: (m.get('sub_pay_explainer') ?? '').trim() || null }))
    }

    let link: { id?: string | null; person_id: string; revoked_at: string | null; token?: string | null; created_by?: string | null } | null = null

    if (rawToken) {
      link = (await admin
        .from('sub_portal_links')
        .select('id, person_id, revoked_at, token, created_by')
        .eq('token', rawToken)
        .maybeSingle()).data
      if (!link) {
        const tokenHash = await sha256Hex(rawToken)
        link = (await admin
          .from('sub_portal_links')
          .select('id, person_id, revoked_at, token, created_by')
          .eq('token_hash', tokenHash)
          .maybeSingle()).data
      }
      if (!link || link.revoked_at) {
        return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      }
    } else if (rawSlug) {
      if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(rawSlug)) {
        return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      }
      const { data: slugRow } = await admin
        .from('sub_portal_slugs')
        .select('person_id, slug, locked_at')
        .eq('slug', rawSlug)
        .maybeSingle()
      if (!slugRow) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      // No mint-on-demand — a turned-off portal stays off however addressed.
      link = (await admin
        .from('sub_portal_links')
        .select('id, person_id, revoked_at, token, created_by')
        .eq('person_id', slugRow.person_id)
        .is('revoked_at', null)
        .maybeSingle()).data
      if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)
      if (!slugRow.locked_at) {
        await admin
          .from('sub_portal_slugs')
          .update({ locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('person_id', slugRow.person_id)
          .is('locked_at', null)
        await admin
          .from('sub_portal_slug_events')
          .insert({ person_id: slugRow.person_id, event: 'locked', slug: slugRow.slug })
      }
    }
    if (!link) return jsonResponse({ error: LINK_INACTIVE_MSG }, 404)

    const { data: person } = await admin
      .from('people')
      .select('id, name, email')
      .eq('id', link.person_id)
      .maybeSingle()
    if (!person) return jsonResponse({ error: 'Not found' }, 404)
    const personName = ((person as { name: string | null }).name ?? '').trim() || 'Subcontractor'
    const personEmail = ((person as { email?: string | null }).email ?? '').trim() || null

    // An answer writes one row and reads nothing else of the page. It is not a view, so it is not counted as one.
    if (isAnswer) return await answerFromPage(req, admin, link, { id: link.person_id, name: personName }, answerBody)

    // View counting — fire-and-forget, the statement never fails on measurement. Office
    // previews (`?preview=1`) and verified staff sessions do not count (journey-map #37;
    // shared predicate in `_shared/publicViewCounting.ts`).
    // v2.2922 (visit trail): EVERY validated load is written, stamped with who it was —
    // outside (counts), staff (a signed-in teammate, with their user id) or preview. If the
    // viewer columns are not there yet (function deployed before the migration), fall back
    // to the pre-v2.2922 row for counted loads only, so outside opens are never lost.
    const viewDecision = await publicViewDecision(req, admin, Deno.env.get('SUPABASE_ANON_KEY'))
    const viaWord = rawToken ? 'token' : 'slug'
    void admin
      .from('public_page_views')
      .insert({ surface: 'sub_portal', entity_id: link.person_id, via: viaWord, viewer: viewDecision.viewer, viewer_user_id: viewDecision.staffUserId })
      .then(
        ({ error }: { error: unknown }) => {
          if (error && viewDecision.count) {
            void admin
              .from('public_page_views')
              .insert({ surface: 'sub_portal', entity_id: link.person_id, via: viaWord })
              .then(() => {}, () => {})
          }
        },
        () => {},
      )

    const todayYmd = todayYmdInAppTz()

    // Sheets: junction-first (people_labor_job_assignees keys on people.id —
    // rename-proof). Sheets the junction doesn't cover are legacy multi-name
    // rows; those stay office-only rather than risking another sub's money.
    const { data: junctionRows } = await admin
      .from('people_labor_job_assignees')
      .select('labor_job_id')
      .eq('person_id', link.person_id)
    const laborJobIds = [
      ...new Set(((junctionRows ?? []) as Array<{ labor_job_id: string }>).map((r) => r.labor_job_id)),
    ]

    let sheetRows: SubSheetRow[] = []
    let itemRows: SubItemRow[] = []
    let paymentRows: SubPaymentRow[] = []
    let paymentEventRows: SubPaymentEventRow[] = []
    if (laborJobIds.length > 0) {
      const { data: sheetsRaw } = await admin
        .from('people_labor_jobs')
        .select('id, address, job_number, job_ledger_id, job_date, labor_rate, stage, stage_changed_at, stage_source, payable_after, pay_hold_reason, progress_pct, progress_note, progress_at')
        .in('id', laborJobIds)
        .limit(500)
      sheetRows = (sheetsRaw ?? []) as SubSheetRow[]
      const { data: itemsRaw } = await admin
        .from('people_labor_job_items')
        .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount, sequence_order')
        .in('job_id', laborJobIds)
      itemRows = (itemsRaw ?? []) as SubItemRow[]
      const { data: paymentsRaw } = await admin
        .from('people_labor_job_payments')
        .select('job_id, amount, memo, payment_date, created_at, hidden_from_sub, sequence_order')
        .in('job_id', laborJobIds)
      paymentRows = (paymentsRaw ?? []) as SubPaymentRow[]
      // v2.3605: the trace — a payment moved off or removed from one of the sub's sheets.
      const { data: eventsRaw } = await admin
        .from('people_labor_job_payment_events')
        .select('kind, from_job_id, to_job_id, amount, created_at, restored_event_id, hidden_from_sub')
        .in('from_job_id', laborJobIds)
        .limit(500)
      paymentEventRows = (eventsRaw ?? []) as SubPaymentEventRow[]
    }

    // Plans online (v2.2922): the sheet's Pipeline job carries a plans link (Edit Job → Files &
    // Plans); its bid carries the CountTooling set. Job link first, bid as the fallback, else none.
    // v2.3071: the sheet's job is its job_ledger_id — no number matching. The same read
    // gives "Your days" the job's real number for office-set sheet days.
    const jobNumberById = new Map<string, string>()
    const linkedJobIds = [...new Set(sheetRows.map((s) => s.job_ledger_id ?? '').filter(Boolean))]
    if (linkedJobIds.length > 0) {
      const { data: jobsRaw } = await admin
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_plans_link, bid:bid_id(count_tooling_plans_link)')
        .in('id', linkedJobIds)
        .limit(500)
      const plansById = new Map<string, string>()
      for (const j of (jobsRaw ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_plans_link: string | null; bid: { count_tooling_plans_link: string | null } | { count_tooling_plans_link: string | null }[] | null }>) {
        const bid = Array.isArray(j.bid) ? j.bid[0] ?? null : j.bid
        const url = (j.job_plans_link ?? '').trim() || (bid?.count_tooling_plans_link ?? '').trim()
        if (url) plansById.set(j.id, url)
        const num = (j.hcp_number ?? '').trim() || (j.click_number ?? '').trim()
        if (num) jobNumberById.set(j.id, num)
      }
      for (const s of sheetRows) s.plans_url = (s.job_ledger_id ? plansById.get(s.job_ledger_id) : undefined) ?? null
      // Viewer grants (2026-09-06): a CountTooling view link gets a short-lived, signed grant
      // (`&g=`) that vouches for this sub, so CountTooling skips its email gate and logs the
      // visit under their name (_shared/viewGrant.ts; CountTooling verifies with the same
      // secret). Drive / PDF links pass through untouched; no secret = the bare link.
      const grantSecret = Deno.env.get('COUNTTOOLING_VIEW_GRANT_SECRET') ?? ''
      if (grantSecret) {
        for (const s of sheetRows) {
          if (s.plans_url) s.plans_url = await grantPlansLink(s.plans_url, { name: personName, email: personEmail, person: link.person_id }, grantSecret)
        }
      }
    }

    // Signed sheet work orders (v2.2789): "what you agreed to" on each sheet card.
    let agreementRows: SubAgreementRow[] = []
    if (laborJobIds.length > 0) {
      const { data: agreementsRaw } = await admin
        .from('step_commitments')
        .select('id, labor_job_id, amount, signed_at, accepted_at, signer_printed_name, offer_scope_snapshot, signer_acknowledgements, work_days, picked_start, picked_end, proposed_start, proposed_end, stage_window_id, change_requested_at, change_requested_note')
        .in('labor_job_id', laborJobIds)
        .is('step_id', null)
        .in('status', ['accepted', 'approved', 'settled'])
      agreementRows = (agreementsRaw ?? []) as Array<SubAgreementRow & { stage_window_id?: string | null }>
    }
    // Stage windows (v2.2928): the span a signed order's dates may move inside, and the span an open offer is picked against.
    const windowById = new Map<string, { window_start: string | null; window_end: string | null }>()
    const loadWindows = async (ids: string[]) => {
      const missing = [...new Set(ids)].filter((id) => id && !windowById.has(id))
      if (missing.length === 0) return
      const { data: winRaw } = await admin.from('job_stage_windows').select('id, window_start, window_end').in('id', missing)
      for (const w of (winRaw ?? []) as Array<{ id: string; window_start: string | null; window_end: string | null }>) windowById.set(w.id, { window_start: w.window_start, window_end: w.window_end })
    }
    await loadWindows(agreementRows.map((a) => (a as { stage_window_id?: string | null }).stage_window_id ?? '').filter(Boolean))
    for (const a of agreementRows as Array<SubAgreementRow & { stage_window_id?: string | null }>) {
      const w = a.stage_window_id ? windowById.get(a.stage_window_id) : null
      a.window_start = w?.window_start ?? null
      a.window_end = w?.window_end ?? null
    }
    // The customer paid (punch list #388, step 2): a sheet waiting on the customer is tied to one bill, and the page
    // says paid for that bill alone, once the office's record says it is paid in full. Read by itself and fail-soft:
    // a read that is refused or throws leaves the page as it was.
    let paidDays = new Map<string, string>()
    try {
      const waitingIds = sheetRows.filter((s) => s.stage === 'customer_pay').map((s) => s.id)
      if (waitingIds.length > 0) {
        const { data: tiesRaw, error: tiesErr } = await admin.from('people_labor_jobs').select('id, stage, draw_invoice_id').in('id', waitingIds)
        const ties = (tiesErr ? [] : (tiesRaw ?? [])) as Array<{ id: string; stage: string | null; draw_invoice_id: string | null }>
        const billIds = [...new Set(ties.map((t) => t.draw_invoice_id ?? '').filter(Boolean))]
        if (billIds.length > 0) {
          const [billsRes, paysRes] = await Promise.all([
            admin.from('jobs_ledger_invoices').select('id, status').in('id', billIds),
            admin.from('jobs_ledger_payments').select('invoice_id, paid_on').in('invoice_id', billIds).limit(1000),
          ])
          if (!billsRes.error && !paysRes.error) {
            paidDays = customerPaidDays(ties, (billsRes.data ?? []) as TiedBillRow[], (paysRes.data ?? []) as TiedBillPaymentRow[])
          }
        }
      }
    } catch {
      paidDays = new Map<string, string>()
    }
    const sheets = attachCustomerPaid(attachSheetAgreements(buildSubSheets(sheetRows, itemRows, paymentRows), agreementRows, todayYmd), paidDays)
    const totals = buildSubTotals(sheets)
    const openSheets = sheets.filter((s) => s.open > 0)
    const sheetsById = new Map(sheetRows.map((s) => [s.id, s]))
    const paymentTraces = buildSubPaymentTraceLines(paymentEventRows, sheetsById, addDaysYmd(todayYmd, -90))

    // Open offers with the step name for the card title.
    const { data: offersRaw } = await admin
      .from('step_commitments')
      .select('id, step_id, labor_job_id, job_id, amount, notes, offer_scope_snapshot, offer_expires_at, proposed_start, proposed_end, work_days, stage_window_id')
      .eq('person_id', link.person_id)
      .eq('status', 'offered')
      .limit(20)
    const offerRowsRaw = (offersRaw ?? []) as Array<SubOfferRow & { step_id: string | null; job_id?: string | null; stage_window_id?: string | null }>
    await loadWindows(offerRowsRaw.map((o) => o.stage_window_id ?? '').filter(Boolean))
    for (const o of offerRowsRaw) {
      const w = o.stage_window_id ? windowById.get(o.stage_window_id) : null
      o.window_start = w?.window_start ?? null
      o.window_end = w?.window_end ?? null
    }
    // Sheet work orders (v2.2789) have no step — their title comes from the snapshot's sheet label.
    const stepIds = [...new Set(offerRowsRaw.map((o) => o.step_id).filter((id): id is string => !!id))]
    const stepNames = new Map<string, string>()
    if (stepIds.length > 0) {
      const { data: steps } = await admin.from('project_workflow_steps').select('id, name').in('id', stepIds)
      for (const s of (steps ?? []) as Array<{ id: string; name: string | null }>) {
        if (s.name) stepNames.set(s.id, s.name)
      }
    }
    const offers = buildSubOffers(
      offerRowsRaw.map((o) => ({ ...o, step_name: o.step_id ? stepNames.get(o.step_id) ?? null : null })),
      todayYmd,
    )

    // Paperwork STATUS only — never contents. person_id first, trimmed-name
    // fallback for legacy rows (the person_contract_documents precedent).
    const { data: docsByIdRaw } = await admin
      .from('person_contract_documents')
      .select('id, document_name, doc_type, status, signed_at, expires_at, person_id, person_name')
      .eq('person_id', link.person_id)
    const { data: docsByNameRaw } = await admin
      .from('person_contract_documents')
      .select('id, document_name, doc_type, status, signed_at, expires_at, person_id, person_name')
      .is('person_id', null)
      .eq('person_name', personName)
    const docRowsById = new Map<string, SubDocRow>()
    for (const d of [
      ...((docsByIdRaw ?? []) as SubDocRow[]),
      ...((docsByNameRaw ?? []) as SubDocRow[]),
    ]) {
      docRowsById.set(d.id, d)
    }
    const documents = buildSubDocuments([...docRowsById.values()], todayYmd)

    // Pay-run settings (Settings → Sub portal · pay schedule).
    const { data: settingsRaw } = await admin
      .from('app_settings')
      .select('key, value_text')
      .in('key', ['sub_pay_run_day', 'sub_pay_explainer'])
    const settings = new Map(
      ((settingsRaw ?? []) as Array<{ key: string; value_text: string | null }>).map((r) => [r.key, r.value_text]),
    )
    const payRunDay = (settings.get('sub_pay_run_day') ?? '').trim() || null
    const payExplainer = (settings.get('sub_pay_explainer') ?? '').trim() || null

    const { data: slugRow } = await admin
      .from('sub_portal_slugs')
      .select('slug')
      .eq('person_id', link.person_id)
      .maybeSingle()
    const slug = ((slugRow as { slug?: string | null } | null)?.slug ?? '').trim() || null

    // Your days (v2.2930): dated work from every live signed order (their pick, else the
    // office's span), office-set sheets with a date that no order already covers, and days off.
    const bookings: Array<{ start: string; end: string; label: string; address: string | null; jobNumber: string | null; source: 'pick' | 'office'; commitmentId: string | null; note: string | null }> = []
    // Each booking's own job or sheet, in the bookings' order: the papers lock ties a booking to its Pipeline job by it.
    const bookingTies: Array<{ job_id: string | null; labor_job_id: string | null }> = []
    {
      const { data: liveRaw } = await admin
        .from('step_commitments')
        .select('id, labor_job_id, job_id, picked_start, picked_end, proposed_start, proposed_end, stage_window_id, job:job_id(hcp_number, job_address)')
        .eq('person_id', link.person_id)
        .in('status', ['accepted', 'approved'])
        .limit(100)
      const live = (liveRaw ?? []) as Array<{ id: string; labor_job_id: string | null; job_id: string | null; picked_start: string | null; picked_end: string | null; proposed_start: string | null; proposed_end: string | null; stage_window_id: string | null; job: { hcp_number: string | null; job_address: string | null } | { hcp_number: string | null; job_address: string | null }[] | null }>
      const stageNames = new Map<string, string>()
      const winIds = [...new Set(live.map((o) => o.stage_window_id).filter((id): id is string => !!id))]
      if (winIds.length > 0) {
        const { data: wins } = await admin.from('job_stage_windows').select('id, fixture:fixture_id(name)').in('id', winIds)
        for (const w of (wins ?? []) as Array<{ id: string; fixture: { name: string | null } | { name: string | null }[] | null }>) {
          const f = Array.isArray(w.fixture) ? w.fixture[0] ?? null : w.fixture
          if (f?.name) stageNames.set(w.id, f.name.trim())
        }
      }
      const coveredSheetIds = new Set<string>()
      for (const o of live) {
        const start = (o.picked_start ?? '').trim() || (o.proposed_start ?? '').trim()
        if (!start) continue
        const end = ((o.picked_start ? o.picked_end : o.proposed_end) ?? '').trim() || start
        if (end < todayYmd) continue
        const job = Array.isArray(o.job) ? o.job[0] ?? null : o.job
        const num = (job?.hcp_number ?? '').trim() || null
        const stage = o.stage_window_id ? stageNames.get(o.stage_window_id) ?? null : null
        bookings.push({ start, end, label: [stage, num ? `#${num}` : null].filter(Boolean).join(' · ') || 'Work order', address: cleanPortalAddress(job?.job_address), jobNumber: num, source: o.picked_start ? 'pick' : 'office', commitmentId: o.id, note: null })
        bookingTies.push({ job_id: o.job_id, labor_job_id: o.labor_job_id })
        if (o.job_id && num && !jobNumberById.has(o.job_id)) jobNumberById.set(o.job_id, num)
        if (o.labor_job_id) coveredSheetIds.add(o.labor_job_id)
      }
      for (const sh of sheetRows) {
        const d = (sh.job_date ?? '').trim()
        if (!d || d < todayYmd || coveredSheetIds.has(sh.id)) continue
        const num = (sh.job_ledger_id ? jobNumberById.get(sh.job_ledger_id) : undefined) ?? ((sh.job_number ?? '').trim() || null)
        bookings.push({ start: d, end: d, label: num ? `#${num}` : 'Sheet', address: cleanPortalAddress(sh.address), jobNumber: num, source: 'office', commitmentId: null, note: null })
        bookingTies.push({ job_id: sh.job_ledger_id ?? null, labor_job_id: null })
      }
    }
    const { data: offRaw } = await admin.from('person_availability').select('day').eq('person_id', link.person_id).eq('kind', 'off').gte('day', addDaysYmd(todayYmd, -7)).limit(200)
    const offDays = ((offRaw ?? []) as Array<{ day: string }>).map((r) => r.day).sort()

    // Papers (punch list #371): the Statements view's block. Its reads are its own, so a failure here leaves the page a
    // sub knows exactly as it was: `papers` is null and nothing else changes.
    let papers: SubPortalPapers | null = null
    let paperSheetTies: SheetTie[] = []
    try {
      const paperRows = await readPapersRows(admin, link.person_id, laborJobIds)
      paperSheetTies = paperRows.sheets.map((s) => ({ id: s.id, job_ledger_id: s.job_ledger_id }))
      const { company, officePhone } = await readPaperCompany(admin)
      papers = buildSubPortalPapers(paperRows, { subName: personName, company, officePhone, now: new Date() })
    } catch (e) {
      console.error('sub-portal papers not built', e)
      papers = null
    }

    // Papers before a job opens (step 6): this read is the lock for a person with no login. Every Pipeline job the page
    // shows something of is asked about once, and a job the sub still owes a paper on keeps its number, days and money
    // and nothing that says where it is or what the work is.
    const sheetTies: SheetTie[] = [...sheetRows.map((s) => ({ id: s.id, job_ledger_id: s.job_ledger_id ?? null })), ...paperSheetTies]
    const orderTies: CommitmentTie[] = [...offerRowsRaw.map((o) => ({ id: o.id, job_id: o.job_id ?? null, labor_job_id: o.labor_job_id ?? null })), ...bookingTies.map((b, i) => ({ id: `booking-${i}`, ...b }))]
    // A work order whose sheet the page did not read is tied through that sheet, in one look. A look that fails stops
    // the page: an order tied to no job would show.
    const knownSheets = new Set(sheetTies.map((s) => s.id))
    const straySheetIds = [...new Set(orderTies.filter((c) => !c.job_id && c.labor_job_id && !knownSheets.has(c.labor_job_id)).map((c) => c.labor_job_id as string))]
    if (straySheetIds.length > 0) sheetTies.push(...(await readEvery<SheetTie>(admin, 'people_labor_jobs', 'id, job_ledger_id', ['id'], { column: 'id', in: straySheetIds })))
    const sheetJob = sheetJobMap(sheetTies)
    const jobPapers = await jobsWaitingOnPerson(admin, link.person_id, subPortalJobIds(sheetTies, orderTies), Object.fromEntries(jobNumberById))
    const shutJobs = new Set(jobPapers.map((j) => j.job_id))
    const offerJob: Record<string, string | null> = {}
    for (const o of offerRowsRaw) offerJob[o.id] = commitmentJobId(o, sheetJob)
    const shown = blankShutSubPortalRows({ sheets: openSheets, offers, bookings, papers }, { sheets: sheetJob, offers: offerJob, bookings: bookingTies.map((b) => commitmentJobId(b, sheetJob)) }, shutJobs)
    // A shut job's payments keep their amounts and days; the memo, a note the office typed, is held back.
    const payments = buildSubPaymentLines(blankShutPaymentMemos(paymentRows, sheetJob, shutJobs), sheetsById, addDaysYmd(todayYmd, -90))

    return jsonResponse({
      company: PORTAL_COMPANY,
      subName: personName,
      preparedOn: todayYmd,
      sheets: shown.sheets,
      payments,
      paymentTraces,
      totals,
      offers: shown.offers,
      documents,
      payRun: {
        day: payRunDay,
        nextRun: nextPayRunYmd(todayYmd, payRunDay),
        explainer: payExplainer,
      },
      // The slug and the token are the same capability — lets a slug-opened
      // page submit forms and sign offers.
      requestToken: link.token ?? null,
      slug,
      days: { bookings: shown.bookings, offDays },
      papers: shown.papers,
      // The jobs that wait on this sub's signature, each with its number and its papers. Empty for most.
      job_papers: jobPapers,
    })
  } catch (e) {
    console.error('sub-portal error', e)
    return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500)
  }
})
