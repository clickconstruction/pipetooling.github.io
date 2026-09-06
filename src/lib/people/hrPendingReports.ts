import { ageDays, compareOldestFirst } from '../ageState'

/**
 * Pending-report display helpers (v2.2235). Pure so the wording of "when this
 * happened vs. when it was written" is pinned by tests — the distinction is
 * the whole point of the queue: the HR entry is dated when it HAPPENED.
 */

export type HrReportWhen = { occurred_date: string; created_at: string; author_name: string }

function shortDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}`
}

/** "happened Aug 24 · written by Malachi, Aug 24" (author/written omitted when unknown). */
export function formatHrReportWhen(r: HrReportWhen): string {
  const happened = `happened ${shortDate(r.occurred_date)}`
  const writtenDay = shortDate(r.created_at.slice(0, 10))
  const who = r.author_name.trim()
  if (who === '') return `${happened} · written ${writtenDay}`
  return `${happened} · written by ${who}, ${writtenDay}`
}

// ─── Ordering + aging (journey-map Tier-2 #40 / C60, J32-F7) ───────────────
// The queue used to render newest-first, so the report that had waited 11 days
// sat under this morning's. Oldest-first, plus a min-age summary for the
// Needs-You card in the `HOURS_APPROVALS_MIN_AGE_DAYS` shape.


export function sortPendingReportsOldestFirst<T extends { created_at: string }>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort((a, b) => compareOldestFirst(a.created_at, b.created_at))
}

export type PendingReportAgingSummary = {
  /** Pending reports at least `minAgeDays` old. */
  count: number
  /** Every pending report. */
  total: number
  /** Whole days since the oldest pending report was written. */
  oldestAgeDays: number
}

/** Null when nothing pending has reached `minAgeDays` — a same-day queue stays quiet. */
export function summarizePendingReportAging(
  rows: ReadonlyArray<{ created_at: string | null }>,
  minAgeDays: number,
  now: Date | number = Date.now(),
): PendingReportAgingSummary | null {
  let count = 0
  let oldest = 0
  for (const r of rows) {
    const d = ageDays(r.created_at, now)
    if (d == null) continue
    if (d > oldest) oldest = d
    if (d >= minAgeDays) count++
  }
  if (count === 0) return null
  return { count, total: rows.length, oldestAgeDays: oldest }
}
