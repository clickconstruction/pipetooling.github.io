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

/**
 * Fetch every registered queue count for a close week. Queue fetchers are
 * eligibility-probed and NEVER throw — a failed queue reports count null so
 * both surfaces can say "partial". Registry as of Phase 3a: bank transfers.
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

  return counts
}
