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
