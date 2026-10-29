import { denverCalendarDayKey } from '../../utils/dateUtils'
import { TALLY_STALE_MIN_AGE_DAYS, isUnlinkedMercuryRowStaleForTallyStaffFollowUp, unlinkedMercuryRowCalendarAgeDays } from '../tallyStaleMinAgeDays'
import { mercuryPostedOnALaterDay, mercurySwipeAtIso } from '../mercurySwipeTime'
import { mercuryCategoryString } from '../mercuryOfficeLikeCategories'
import { tallyCategoryWords } from '../tally/tallySuggestionWords'
import { formatTallyCurrency, formatTallyPostedParts } from '../tally/formatTallyPosted'
import { buildEvenSortModeSplit, setSortModeSplitAmount, sortModeSplitRemainder, type SortModeSplitLine } from '../tally/sortModeSplit'
import { fillInRowKey, type FillInRowBase } from './fillIn'

/**
 * The purchases kind (v2.6071, punch list #178, D's PR 2): the rows behind the Needs you line
 * *N purchases need a job*, the viewer's own card charges with no job yet, over the line's age
 * floor. The rows are the Tally page's own read (`list_my_linked_mercury_transactions_for_tally`)
 * narrowed the way the line's count is (`count_unlinked_mercury_transactions_for_tally_stale`):
 * no job split, no invoice link, not marked payroll, past the org's date floor, posted more than
 * `TALLY_STALE_MIN_AGE_DAYS` ago. The card is the Sort screen's: the jobs on the viewer's clock
 * and schedule the day the card was swiped and the day each side, as chips; one chip takes the
 * whole charge, two or more split it evenly with the amounts editable; any other job by search.
 * Save writes what the Sort screen writes, `replace_mercury_job_splits_for_my_linked_card`, and
 * Undo clears the splits it set. Pure; `fillInPurchasesIo.ts` reads and writes.
 */
export type PurchaseSource = {
  mercury_transaction_id: string
  posted_at: string | null
  /** Signed dollars as Mercury stores them: a purchase is negative, a refund positive. */
  amount: number | string
  counterparty_name: string | null
  /** Mercury's memo. */
  note: string | null
  /** The holder's own memo on the Tally page. */
  tally_user_note: string | null
  mercury_account_nickname: string | null
  raw: unknown
  job_splits: unknown
  jobs_summary: string | null
  invoices_summary: string | null
}

export type PurchaseFillInRow = FillInRowBase & {
  kind: 'purchase'
  txId: string
  /** Signed dollars, the sign the RPC checks the splits against. */
  amount: number
  store: string
  /** When the card was swiped (Mercury's `createdAt`, else the posting); null when neither reads. */
  swipeAtIso: string | null
  postedAt: string | null
  /** The posting's company day, the deck's order. */
  postedDay: string
  /** Company days since it posted; what the line's floor counts. */
  ageDays: number | null
}

/** One tappable job on the card: the Sort screen's own shape. */
export type PurchaseJobOption = {
  id: string
  /** "JP942 · Spigots replaced", or "#650 · Maple Street remodel" from a search. */
  main: string
  address: string
}

export type PurchaseSourcesInput = {
  rows: readonly PurchaseSource[]
  /** The charges marked payroll (`mercury_tally_payroll_flags`); the page merges them the same way. Empty when the read is refused. */
  payrollFlagged: ReadonlySet<string> | readonly string[]
  /** The org's date floor (`job_tally_min_posted_ymd`); null is no floor. */
  floorYmd: string | null
  nowMs: number
  minAgeDays?: number
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n != null && Number.isFinite(n) ? n : 0
}

const money = (n: number): string => formatTallyCurrency(Math.abs(n))

const daysAgo = (n: number): string => (n === 0 ? 'today' : n === 1 ? '1 day ago' : `${n} days ago`)

/** A split on record: `job_splits` holds a job, as `tallyUniqueJobSplitEntries` reads it (kept out of here so this file stays pure). */
function hasJobSplit(jobSplits: unknown): boolean {
  return Array.isArray(jobSplits) && jobSplits.some((item) => item && typeof item === 'object' && typeof (item as { job_id?: unknown }).job_id === 'string')
}

/** Past the org's date floor on the posting's company day, as `mercuryRowPassesSortingStartDate` reads it. */
function passesFloor(postedAt: string, floorYmd: string): boolean {
  const ms = Date.parse(postedAt)
  return Number.isFinite(ms) && denverCalendarDayKey(ms) >= floorYmd.trim()
}

/** Resolved the way the Tally page's unlinked scope reads it: a job split, an invoice link, or a payroll mark. */
export function purchaseIsResolved(r: PurchaseSource, payrollFlagged: ReadonlySet<string>): boolean {
  return payrollFlagged.has(r.mercury_transaction_id) || hasJobSplit(r.job_splits) || !!r.jobs_summary?.trim() || !!r.invoices_summary?.trim()
}

export function purchaseKnows(r: PurchaseSource, nowMs: number): string[] {
  const out: string[] = []
  const swipe = mercurySwipeAtIso(r.raw, r.posted_at)
  const bought = swipe ? formatTallyPostedParts(swipe) : null
  const posted = formatTallyPostedParts(r.posted_at)
  const age = unlinkedMercuryRowCalendarAgeDays(r.posted_at, nowMs)
  if (bought) out.push(`Bought ${bought.weekday}, ${bought.date}.`)
  if (posted) out.push(`Posted ${posted.date}${age != null ? `, ${daysAgo(age)}` : ''}${bought && mercuryPostedOnALaterDay(r.raw, r.posted_at) ? ', after the swipe' : ''}.`)
  const category = mercuryCategoryString(r.raw && typeof r.raw === 'object' ? (r.raw as { mercuryCategory?: unknown }).mercuryCategory : null)
  if (category) out.push(`Mercury filed it under ${tallyCategoryWords(category)}.`)
  const memo = (r.tally_user_note ?? '').trim()
  if (memo) out.push(`Your memo: “${memo}”.`)
  const bank = (r.note ?? '').trim()
  if (bank && bank !== memo) out.push(`Mercury's memo: “${bank}”.`)
  const account = (r.mercury_account_nickname ?? '').trim()
  if (account) out.push(`On the ${account} account.`)
  return out
}

/** The oldest posting day first, the biggest charge among a day's, then by id. */
export function comparePurchaseRows(a: PurchaseFillInRow, b: PurchaseFillInRow): number {
  return a.postedDay.localeCompare(b.postedDay) || Math.abs(b.amount) - Math.abs(a.amount) || a.txId.localeCompare(b.txId)
}

const postedDayOf = (postedAt: string | null): string => {
  const ms = postedAt ? Date.parse(postedAt) : Number.NaN
  return Number.isFinite(ms) ? denverCalendarDayKey(ms) : ''
}

export function purchaseFillInRows(input: PurchaseSourcesInput): PurchaseFillInRow[] {
  const flagged = input.payrollFlagged instanceof Set ? (input.payrollFlagged as ReadonlySet<string>) : new Set(input.payrollFlagged as readonly string[])
  const minAge = input.minAgeDays ?? TALLY_STALE_MIN_AGE_DAYS
  return input.rows
    .filter((r) => !purchaseIsResolved(r, flagged))
    .filter((r) => r.posted_at != null && (input.floorYmd == null || passesFloor(r.posted_at, input.floorYmd)))
    .filter((r) => isUnlinkedMercuryRowStaleForTallyStaffFollowUp(r.posted_at, minAge, input.nowMs))
    .map((r): PurchaseFillInRow => {
      const amount = num(r.amount)
      const store = (r.counterparty_name ?? '').trim()
      const swipe = mercurySwipeAtIso(r.raw, r.posted_at)
      const day = formatTallyPostedParts(swipe ?? r.posted_at)
      const what = amount > 0 ? `${money(amount)} back from ${store || 'the card'}` : `${money(amount)} at ${store || 'a store'}`
      return {
        key: fillInRowKey('purchase', r.mercury_transaction_id),
        kind: 'purchase',
        severity: 'amber',
        title: `${what}${day ? ` · ${day.date}` : ''}`,
        knows: purchaseKnows(r, input.nowMs),
        doorHref: '/tally?tab=transactions',
        doorLabel: 'Open Job Parts Tally',
        txId: r.mercury_transaction_id,
        amount,
        store,
        swipeAtIso: swipe,
        postedAt: r.posted_at,
        postedDay: postedDayOf(r.posted_at),
        ageDays: unlinkedMercuryRowCalendarAgeDays(r.posted_at, input.nowMs),
      }
    })
    .sort(comparePurchaseRows)
}

/** A search row from `search_jobs_for_tally_mercury_assign`, as the Assign window labels it. */
export function purchaseJobOptionFromSearch(r: { id: string; hcp_number: string | null; job_name: string | null; job_address: string | null }): PurchaseJobOption {
  const main = `${(r.hcp_number ?? '').trim()} · ${(r.job_name ?? '').trim()}`.replace(/^ · | · $/g, '').trim()
  return { id: r.id, main: main || r.id.slice(0, 8), address: (r.job_address ?? '').trim() }
}

/** The jobs picked and how the charge splits across them; the labels ride along for the trail. */
export type PurchaseDecision = {
  lines: SortModeSplitLine[]
  jobs: Record<string, PurchaseJobOption>
}

export const EMPTY_PURCHASE_DECISION: PurchaseDecision = { lines: [], jobs: {} }

/** Tap a job: in with an even split, or out. The lines re-split evenly, as the Sort screen does. */
export function purchaseToggleJob(d: PurchaseDecision, total: number, job: PurchaseJobOption): PurchaseDecision {
  const picked = d.lines.some((l) => l.jobId === job.id)
  const ids = picked ? d.lines.filter((l) => l.jobId !== job.id).map((l) => l.jobId) : [...d.lines.map((l) => l.jobId), job.id]
  const jobs = { ...d.jobs }
  if (picked) delete jobs[job.id]
  else jobs[job.id] = job
  return { lines: buildEvenSortModeSplit(total, ids), jobs }
}

/** One line's amount typed; the last other line balances so the split still sums to the charge. */
export function purchaseSetAmount(d: PurchaseDecision, total: number, jobId: string, amount: number): PurchaseDecision {
  return { ...d, lines: setSortModeSplitAmount(d.lines, jobId, amount, total) }
}

export function purchaseRemainder(d: PurchaseDecision, total: number): number {
  return sortModeSplitRemainder(d.lines, total)
}

/** A job picked, and a split that adds up to the charge. */
export function purchaseDecisionReady(d: PurchaseDecision, total: number): boolean {
  return d.lines.length > 0 && purchaseRemainder(d, total) === 0
}

export type PurchaseWrites = {
  txId: string
  /** The RPC's rows: signed amounts summing to the charge. */
  rows: Array<{ job_id: string; amount: number }>
  /** Each row's job label, in row order, for the trail. */
  labels: string[]
}

export function purchaseWrites(row: PurchaseFillInRow, d: PurchaseDecision): PurchaseWrites | null {
  if (!purchaseDecisionReady(d, row.amount)) return null
  return {
    txId: row.txId,
    rows: d.lines.map((l) => ({ job_id: l.jobId, amount: l.amount })),
    labels: d.lines.map((l) => d.jobs[l.jobId]?.main ?? l.jobId.slice(0, 8)),
  }
}

/** The saved line under the deck, after the row's title: where the charge went. */
export function purchaseTrailWords(w: PurchaseWrites): string {
  if (w.rows.length === 1) return `on ${w.labels[0]} · the tally has it`
  const parts = w.rows.map((r, i) => `${money(r.amount)} to ${w.labels[i]}`)
  const joined = parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `split ${joined} · the tally has it`
}
