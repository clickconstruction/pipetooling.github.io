import { normalizeEstimateLineItemsFromJson } from './estimateLineItemNormalize'
import { isChangeOrderDocKind, parseEstimateChangeOrderFields } from './estimateChangeOrder'
import {
  computeEstimateDraftSteps,
  type EstimateDraftStepsResult,
} from './estimateDraftSteps'

/**
 * Pipeline refresh kernel (owner-approved prototype): decides which drafts are
 * empty debris (the clean-up sweep) and computes a list row's readiness from
 * the same step kernel the draft editor's rail uses.
 */

/** The list query selects `*`, so rows carry everything we need. */
export type EstimatePipelineRowLike = {
  status: string
  customer_id: string | null
  customer_email?: string | null
  title: string | null
  line_items_snapshot: unknown
  total_cents: number | null
  doc_kind?: string | null
  change_order_fields?: unknown
  terms_snapshot?: string | null
  customers?: { contact_info?: unknown } | null
}

const STUB_LABEL = 'custom service visit'

function lineIsMeaningful(l: { line_item: string; description: string; amount_cents: number }): boolean {
  const li = l.line_item.trim().toLowerCase()
  const desc = l.description.trim().toLowerCase()
  if (l.amount_cents !== 0) return true
  // The historical seed stub in either shape (v2.1843 note), and fully blank rows.
  if (li === STUB_LABEL && desc === '') return false
  if (li === '' && desc === STUB_LABEL) return false
  return li !== '' || desc !== ''
}

export function estimateDraftMeaningfulLineCount(raw: unknown, isCO: boolean): number {
  return normalizeEstimateLineItemsFromJson(raw, { allowNegative: isCO }).filter(lineIsMeaningful).length
}

/**
 * Empty debris: a draft with no customer, no title, no meaningful lines, no CO
 * narrative, and no terms — nothing anyone would miss.
 */
export function isEmptyEstimateDraft(row: EstimatePipelineRowLike): boolean {
  if (row.status !== 'draft') return false
  if (row.customer_id) return false
  if ((row.title ?? '').trim() !== '') return false
  const isCO = isChangeOrderDocKind(row.doc_kind)
  if (estimateDraftMeaningfulLineCount(row.line_items_snapshot, isCO) > 0) return false
  const co = parseEstimateChangeOrderFields(row.change_order_fields)
  if (co.description_of_change.trim() || co.reason_for_change.trim() || co.impact_on_schedule.trim()) return false
  if ((row.terms_snapshot ?? '').trim() !== '') return false
  return true
}

function customerEmailFromRow(row: EstimatePipelineRowLike): boolean {
  if ((row.customer_email ?? '').trim() !== '') return true
  const ci = row.customers?.contact_info
  if (ci && typeof ci === 'object' && !Array.isArray(ci)) {
    const email = (ci as Record<string, unknown>).email
    return typeof email === 'string' && email.trim() !== ''
  }
  if (typeof ci === 'string') {
    try {
      const parsed = JSON.parse(ci) as Record<string, unknown>
      return typeof parsed.email === 'string' && parsed.email.trim() !== ''
    } catch {
      return false
    }
  }
  return false
}

/**
 * Readiness for an unsent list row — same kernel as the editor's rail.
 * Notify defaults to 1 (the editor checks "Notify me" by default) and
 * attachments are treated as absent: the list can only understate readiness,
 * never overstate it, and the editor remains the source of truth.
 */
export function computeEstimateListReadiness(row: EstimatePipelineRowLike): EstimateDraftStepsResult {
  const isCO = isChangeOrderDocKind(row.doc_kind)
  const co = parseEstimateChangeOrderFields(row.change_order_fields)
  return computeEstimateDraftSteps({
    isCO,
    customerSelected: row.customer_id != null,
    customerEmailPresent: customerEmailFromRow(row),
    changeDescriptionFilled: co.description_of_change.trim() !== '',
    lineCount: estimateDraftMeaningfulLineCount(row.line_items_snapshot, isCO),
    totalCents: row.total_cents ?? 0,
    termsFilled: (row.terms_snapshot ?? '').trim() !== '',
    attachmentFilled: false,
    notifyCount: 1,
  })
}

/** "●●●○○" content split for rendering: done count vs remaining count. */
export function readinessDots(r: EstimateDraftStepsResult): { done: number; todo: number; ready: boolean; label: string } {
  const done = r.steps.filter((s) => s.status === 'done').length
  const todo = r.steps.length - done
  const attention = r.steps.filter((s) => s.status === 'attention')
  const ready = attention.length === 0
  return {
    done,
    todo,
    ready,
    label: ready ? 'ready to send' : r.sendGate.sentence.replace(/^\d+ steps? left: /, (m) => m.replace('steps left', 'left').replace('step left', 'left')),
  }
}

export type SentWaitLevel = 'ok' | 'warn' | 'overdue'
export type SentWaitInfo = { level: SentWaitLevel; label: string; days: number }

const DAY_MS = 86_400_000
/** Amber after a week of silence. */
const SENT_WARN_DAYS = 7

/**
 * Waiting-state for a Sent row (prototype: the section is a follow-up queue).
 * Overdue beats age: a CO whose "Response requested by" date has passed goes
 * red regardless of how recently it was sent. `nowMs` injected for tests.
 */
export function computeSentWait(
  row: Pick<EstimatePipelineRowLike, 'change_order_fields'> & { sent_at?: string | null },
  nowMs: number,
): SentWaitInfo | null {
  const sentMs = row.sent_at ? Date.parse(row.sent_at) : NaN
  if (!Number.isFinite(sentMs)) return null
  const days = Math.max(0, Math.floor((nowMs - sentMs) / DAY_MS))

  const rby = parseEstimateChangeOrderFields(row.change_order_fields).response_requested_by.trim()
  if (rby) {
    const dueEndMs = Date.parse(rby) + DAY_MS
    if (Number.isFinite(dueEndMs) && nowMs >= dueEndMs) {
      const overdueDays = Math.max(1, Math.floor((nowMs - dueEndMs) / DAY_MS) + 1)
      const [, m, d] = rby.split('-')
      const dueLabel = m && d ? `${Number(m)}/${Number(d)}` : rby
      return { level: 'overdue', days, label: `response requested by ${dueLabel} — ${overdueDays}d overdue` }
    }
  }

  if (days >= SENT_WARN_DAYS) return { level: 'warn', days, label: `sent ${days}d ago — nudge?` }
  return { level: 'ok', days, label: days === 0 ? 'sent today' : `sent ${days}d ago` }
}

export type FollowupRowLike = { status: string; doc_kind?: string | null; updated_at?: string | null }

export type FollowupBuckets<T> = { unsent: T[]; sent: T[]; declined: T[]; accepted: T[] }

function sortByUpdatedDesc<T extends FollowupRowLike>(list: T[]): T[] {
  return [...list].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
}

/**
 * Pipeline buckets: draft → Unsent; sent → Sent; declined → Declined (v2.2873 — it used
 * to ride in Sent, where `computeSentWait` kept it wearing "sent Nd ago — nudge?", J17-N2);
 * customer_accepted → Accepted; superseded omitted. Signed bid-room proposals (v2.2470)
 * are bid-side paperwork — Ledger only, never the estimates funnel (owner decision 1).
 */
export function splitFollowupRows<T extends FollowupRowLike>(source: T[]): FollowupBuckets<T> {
  const unsent: T[] = []
  const sent: T[] = []
  const declined: T[] = []
  const accepted: T[] = []
  for (const r of source) {
    if (isBidProposalDocKind(r.doc_kind)) continue
    switch (r.status) {
      case 'draft':
        unsent.push(r)
        break
      case 'sent':
        sent.push(r)
        break
      case 'declined':
        declined.push(r)
        break
      case 'customer_accepted':
        accepted.push(r)
        break
      default:
        break
    }
  }
  return {
    unsent: sortByUpdatedDesc(unsent),
    sent: sortByUpdatedDesc(sent),
    declined: sortByUpdatedDesc(declined),
    accepted: sortByUpdatedDesc(accepted),
  }
}

export type LedgerRowLike = {
  status: string
  doc_kind?: string | null
  total_cents: number | null
  job_ledger_id?: string | null
  acceptor_consented_at?: string | null
  updated_at?: string | null
}

export type LedgerTotals = {
  acceptedThisMonthCents: number
  outstandingSentCents: number
  acceptedUnlinkedCents: number
}

/** Month key (UTC) for "accepted this month" — day precision is plenty here. */
function monthKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`
}

/** The Ledger footer math, over the currently filtered rows. */
export function computeLedgerTotals(rows: LedgerRowLike[], nowMs: number): LedgerTotals {
  const nowMonth = monthKey(nowMs)
  let acceptedThisMonthCents = 0
  let outstandingSentCents = 0
  let acceptedUnlinkedCents = 0
  for (const r of rows) {
    const cents = r.total_cents ?? 0
    if (r.status === 'sent') outstandingSentCents += cents
    if (r.status === 'customer_accepted') {
      if (!r.job_ledger_id) acceptedUnlinkedCents += cents
      const at = r.acceptor_consented_at ? Date.parse(r.acceptor_consented_at) : NaN
      if (Number.isFinite(at) && monthKey(at) === nowMonth) acceptedThisMonthCents += cents
    }
  }
  return { acceptedThisMonthCents, outstandingSentCents, acceptedUnlinkedCents }
}

export type LedgerKindFilter = 'all' | 'estimate' | 'change_order' | 'bid_proposal'

/** Signed bid-room proposals (v2.2470) ride the estimates rails born-accepted. */
export function isBidProposalDocKind(docKind: string | null | undefined): boolean {
  return docKind === 'bid_proposal'
}

/** Ledger row filter: kind, closed-row toggle, and an updated-within window. */
export function ledgerRowPasses(
  r: LedgerRowLike,
  f: { kind: LedgerKindFilter; includeClosed: boolean; withinDays: number },
  nowMs: number,
): boolean {
  if (!f.includeClosed && (r.status === 'superseded' || r.status === 'declined')) return false
  if (f.kind === 'change_order' && !isChangeOrderDocKind(r.doc_kind)) return false
  if (f.kind === 'bid_proposal' && !isBidProposalDocKind(r.doc_kind)) return false
  if (f.kind === 'estimate' && (isChangeOrderDocKind(r.doc_kind) || isBidProposalDocKind(r.doc_kind))) return false
  if (f.withinDays > 0) {
    const u = r.updated_at ? Date.parse(r.updated_at) : NaN
    if (!Number.isFinite(u) || nowMs - u > f.withinDays * 86_400_000) return false
  }
  return true
}
