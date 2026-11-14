import { workMonthLabel } from './forecastWorkMonths'

// In a file of its own so a kernel that only words a notice's months does not pull the notice draft behind it, and the
// edge copy can carry that kernel. `lienNoticeDraft.ts` re-exports it, so every caller's import stands.

/** "June, July and August 2026" — the months a notice names, for the reference strip and the cover note. */
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

function fullMonthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key)
  if (!m) return workMonthLabel(key)
  return `${FULL_MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

export function describeNoticeMonths(months: ReadonlyArray<string>): string {
  const sorted = months.slice().sort()
  if (sorted.length === 0) return ''
  const years = new Set(sorted.map((m) => m.slice(0, 4)))
  const names = sorted.map((m) => (years.size === 1 ? fullMonthLabel(m).replace(/ \d{4}$/, '') : fullMonthLabel(m)))
  const joined = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return years.size === 1 ? `${joined} ${sorted[0]!.slice(0, 4)}` : joined
}
