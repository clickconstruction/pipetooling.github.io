/**
 * Moneyfill "weekly close" substrate (v2.1444 — WEEKLY_MONEY_PLAN.md Phase 3a).
 *
 * ONE implementation of the close-week queue counts, shared by two surfaces:
 * the Moneyfill page header (progress + jump chips) and the Weekly Money
 * Movement report's confidence footer — so the checklist and the report can
 * never disagree (plan invariant #5). Each queue PR registers its fetcher
 * here; surfaces render whatever the registry returns.
 *
 * Week = Mon–Sun Central, matching the report. The close week DEFAULTS to the
 * previous complete week (the week you close Monday morning).
 */
import { supabase } from './supabase'
import { chicagoYmdOf } from './gcStatementStandingCopies'
import { mondayOfWeekYmd } from './jobs/stagesWeeklyMovement'
import { addDaysYmd } from './emailSchedule/emailScheduleWeek'
import { parseNoncardAttributionQueueRows, type NoncardAttributionQueueRow } from './banking/noncardAttributionQueue'
import { mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard'
import { salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import type { Json } from '../types/database'

export type MoneyfillQueueKey =
  | 'bank-transfers'
  | 'card-charges'
  | 'deposits-unapplied'
  | 'time-no-job'
  | 'pending-approval'
  | 'supply-invoices'
  | 'no-pct-report'
  | 'no-job-total'
  | 'sub-sheets'

export type MoneyfillQueueCount = {
  key: MoneyfillQueueKey
  /** Short chip label ("Bank transfers"). */
  label: string
  /** Row/item count for the close week; null = fetch failed or not eligible. */
  count: number | null
  /** Unattributed dollars for the week when the queue is dollar-shaped. */
  dollars: number | null
}

/** Queues that exist so far — grows one entry per queue PR (E–I). */
export const MONEYFILL_QUEUE_LABELS: Record<MoneyfillQueueKey, string> = {
  'bank-transfers': 'Bank transfers',
  'card-charges': 'Card charges',
  'deposits-unapplied': 'Deposits',
  'time-no-job': 'Time w/o job',
  'pending-approval': 'Pending approval',
  'supply-invoices': 'Supply invoices',
  'no-pct-report': 'No % report',
  'no-job-total': 'No job total',
  'sub-sheets': 'Sub sheets',
}

/** Monday (YYYY-MM-DD, Central calendar) of the previous complete week. */
export function previousCompleteWeekMonday(now: Date = new Date()): string {
  return addDaysYmd(mondayOfWeekYmd(chicagoYmdOf(now)), -7)
}

/** "Aug 3 – 9" style label reused from the sibling reports would need the
 * weekLabel import at call sites; the close header uses it directly. */

export type WeekCloseSummary = {
  totalQueues: number
  queuesAtZero: number
  /** Sum of known unattributed dollars (absolute). */
  unattributedDollars: number
  /** True when any queue failed to load (summary is a floor, not a total). */
  partial: boolean
}

export function summarizeWeekClose(counts: MoneyfillQueueCount[]): WeekCloseSummary {
  let zero = 0
  let dollars = 0
  let partial = false
  for (const c of counts) {
    if (c.count == null) {
      partial = true
      continue
    }
    if (c.count === 0) zero += 1
    if (c.dollars != null) dollars += Math.abs(c.dollars)
  }
  return { totalQueues: counts.length, queuesAtZero: zero, unattributedDollars: dollars, partial }
}

/** One-line confidence copy for the report footer; null when nothing to say. */
export function buildWeekCloseConfidenceLine(counts: MoneyfillQueueCount[]): string | null {
  const parts: string[] = []
  for (const c of counts) {
    if (c.count == null || c.count === 0) continue
    if (c.dollars != null && c.dollars !== 0) {
      parts.push(
        `$${Math.abs(c.dollars).toLocaleString('en-US', { maximumFractionDigits: 0 })} in ${c.label.toLowerCase()} unattributed`,
      )
    } else {
      parts.push(`${c.count} ${c.label.toLowerCase()} open`)
    }
  }
  if (parts.length === 0) return null
  return parts.join(' · ')
}

/** Pure week filter for noncard bank-transfer rows (posted Central date in week). */
export function filterNoncardRowsToWeek(
  rows: NoncardAttributionQueueRow[],
  weekMondayYmd: string,
): NoncardAttributionQueueRow[] {
  const endYmd = addDaysYmd(weekMondayYmd, 7)
  return rows.filter((r) => {
    if (!r.posted_at) return false
    const ymd = chicagoYmdOf(new Date(r.posted_at))
    return ymd >= weekMondayYmd && ymd < endYmd
  })
}

export function noncardWeekQueueCount(
  rows: NoncardAttributionQueueRow[] | null,
  weekMondayYmd: string,
  eligible: boolean,
): MoneyfillQueueCount {
  if (!eligible || rows == null) {
    return { key: 'bank-transfers', label: MONEYFILL_QUEUE_LABELS['bank-transfers'], count: null, dollars: null }
  }
  const week = filterNoncardRowsToWeek(rows, weekMondayYmd)
  const dollars = week.reduce((s, r) => s + Math.abs(r.amount), 0)
  return { key: 'bank-transfers', label: MONEYFILL_QUEUE_LABELS['bank-transfers'], count: week.length, dollars }
}

export type UnsplitCardChargeRow = {
  txId: string
  postedAt: string | null
  counterparty: string | null
  /** Signed Mercury amount — negative = purchase. */
  amount: number
  debitCardId: string
}

/** Pure: keep card purchases (debit-card raw + negative amount) with no job allocations. */
export function unsplitCardChargesFromTxs(
  txs: Array<{ id: string; posted_at: string | null; counterparty_name: string | null; amount: number; raw: Json | null }>,
  allocatedTxIds: ReadonlySet<string>,
): UnsplitCardChargeRow[] {
  const out: UnsplitCardChargeRow[] = []
  for (const t of txs) {
    if (allocatedTxIds.has(t.id)) continue
    if (!(Number(t.amount) < 0)) continue
    const cardId = mercuryDebitCardIdFromRaw(t.raw)
    if (!cardId) continue
    out.push({ txId: t.id, postedAt: t.posted_at, counterparty: t.counterparty_name, amount: Number(t.amount), debitCardId: cardId })
  }
  return out
}

export function cardChargesQueueCount(rows: UnsplitCardChargeRow[] | null): MoneyfillQueueCount {
  if (rows == null) {
    return { key: 'card-charges', label: MONEYFILL_QUEUE_LABELS['card-charges'], count: null, dollars: null }
  }
  return {
    key: 'card-charges',
    label: MONEYFILL_QUEUE_LABELS['card-charges'],
    count: rows.length,
    dollars: rows.reduce((s, r) => s + Math.abs(r.amount), 0),
  }
}

/** Week UTC bounds for a Central Mon–Sun week (start inclusive, end exclusive). */
export function weekUtcBounds(weekMondayYmd: string): { startIso: string; endIso: string } | null {
  const start = salaryZonedWallClockToUtcMs(weekMondayYmd, 0, 0, 0, APP_CALENDAR_TZ)
  const end = salaryZonedWallClockToUtcMs(addDaysYmd(weekMondayYmd, 7), 0, 0, 0, APP_CALENDAR_TZ)
  if (start == null || end == null) return null
  return { startIso: new Date(start).toISOString(), endIso: new Date(end).toISOString() }
}

/**
 * Card purchases posted in the close week with no job allocations. Null on
 * error / ineligibility (mercury RLS is staff-scoped) — callers report partial.
 */
export async function fetchUnsplitCardChargesForWeek(weekMondayYmd: string): Promise<UnsplitCardChargeRow[] | null> {
  const bounds = weekUtcBounds(weekMondayYmd)
  if (!bounds) return null
  try {
    const txRes = await supabase
      .from('mercury_transactions')
      .select('id, posted_at, counterparty_name, amount, raw')
      .gte('posted_at', bounds.startIso)
      .lt('posted_at', bounds.endIso)
      .order('posted_at', { ascending: true })
    if (txRes.error) throw txRes.error
    const txs = (txRes.data ?? []) as Array<{ id: string; posted_at: string | null; counterparty_name: string | null; amount: number; raw: Json | null }>
    if (txs.length === 0) return []
    const allocRes = await supabase
      .from('mercury_transaction_job_allocations')
      .select('mercury_transaction_id')
      .in('mercury_transaction_id', txs.map((t) => t.id))
    if (allocRes.error) throw allocRes.error
    const allocated = new Set((allocRes.data ?? []).map((r) => String((r as { mercury_transaction_id: string }).mercury_transaction_id)))
    return unsplitCardChargesFromTxs(txs, allocated)
  } catch {
    return null
  }
}

/**
 * Fetch every registered queue count for a close week. Queue fetchers are
 * eligibility-probed and NEVER throw — a failed queue reports count null so
 * both surfaces can say "partial". Registry: bank transfers, card charges.
 */
export async function fetchWeekCloseCounts(weekMondayYmd: string): Promise<MoneyfillQueueCount[]> {
  const counts: MoneyfillQueueCount[] = []

  // bank-transfers — unattributed non-card money out, week-scoped client-side.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (supabase as any).rpc.bind(supabase)
    const res = await rpc('list_unattributed_noncard_mercury_transactions', { p_limit: 500 })
    if (res.error) throw res.error
    counts.push(noncardWeekQueueCount(parseNoncardAttributionQueueRows(res.data), weekMondayYmd, true))
  } catch {
    counts.push(noncardWeekQueueCount(null, weekMondayYmd, false))
  }

  // card-charges — card purchases posted in-week with no job allocations.
  counts.push(cardChargesQueueCount(await fetchUnsplitCardChargesForWeek(weekMondayYmd)))

  return counts
}
