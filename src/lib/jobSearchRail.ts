import { formatDaysAgoShort } from './duplicateJobAddressGroups'

/**
 * The job-search money rail, one fixed shape per row (owner call, 2026-09-08):
 *
 *     [ note ]  [ status chip ]  [ amount ]
 *
 * Before this the rail was chip · $line-items · payment tag, so "Paid" (the
 * Pipeline stage) sat left of the number and "unpaid" (the payment table)
 * sat right of it, jobs with no line items showed no number at all, and
 * $0 service visits showed a bold $0. Now:
 *
 *   note   — only when it adds something the chip did not already say:
 *            Paid → the recency ("6 mo ago"); Billed with no payment → the
 *            age of the debt ("unpaid 47d", red once flagged for collections);
 *            a payment on a not-yet-Paid job → "paid 2 wk ago". Waiting /
 *            Working / Ready to Bill rows say nothing — "unpaid" on a job
 *            that was never billed is noise.
 *   chip   — the Pipeline stage, unchanged (jobPickerStatusChip at the row).
 *   amount — line-item total when there are line items, else the job's
 *            revenue; "$0" muted for a genuine no-charge visit; "—" muted when
 *            the job has no total anywhere. Every money-mode row gets one.
 *
 * Pure — the row renders it; the evidence fetch supplies the inputs.
 */

export type JobSearchRailNoteTone = 'green' | 'amber' | 'red'

export type JobSearchRailModel = {
  note: { label: string; tone: JobSearchRailNoteTone } | null
  amount: { label: string; muted: boolean }
}

export type JobSearchRailInput = {
  /** jobs_ledger.status (raw), null when unknown. */
  status: string | null
  lineCount: number
  lineRevenue: number
  /** jobs_ledger.revenue — the fallback total when there are no line items. */
  revenue: number | null
  /** Calendar days since the newest payment; null when none recorded. */
  lastPaidDaysAgo: number | null
  /** Calendar days since jobs_ledger.last_bill_date; null when never billed / unknown. */
  billedDaysAgo: number | null
  collectionsFlagged: boolean
}

function usd0(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export function buildJobSearchRail(i: JobSearchRailInput): JobSearchRailModel {
  const total = i.lineCount > 0 ? i.lineRevenue : i.revenue != null && Number.isFinite(i.revenue) ? i.revenue : null
  const amount =
    total == null ? { label: '—', muted: true } : Math.round(total) === 0 ? { label: '$0', muted: true } : { label: usd0(total), muted: false }

  const status = (i.status ?? '').trim()
  let note: JobSearchRailModel['note'] = null
  if (i.lastPaidDaysAgo !== null) {
    note =
      status === 'paid'
        ? { label: formatDaysAgoShort(i.lastPaidDaysAgo), tone: 'green' }
        : { label: `paid ${formatDaysAgoShort(i.lastPaidDaysAgo)}`, tone: 'green' }
  } else if ((status === 'billed' || i.collectionsFlagged) && (total ?? 0) > 0) {
    const age = i.billedDaysAgo !== null && i.billedDaysAgo > 0 ? ` ${i.billedDaysAgo}d` : ''
    note = { label: `unpaid${age}`, tone: i.collectionsFlagged ? 'red' : 'amber' }
  }
  return { note, amount }
}

/** Whole calendar days from a YYYY-MM-DD (or ISO) date to `now`; null when unparsable. */
export function daysSinceYmd(ymd: string | null | undefined, nowMs: number): number | null {
  if (!ymd) return null
  const t = Date.parse(ymd.length === 10 ? `${ymd}T12:00:00` : ymd)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
}
