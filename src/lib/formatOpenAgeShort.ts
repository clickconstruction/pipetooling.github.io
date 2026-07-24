/**
 * Compact two-unit job-open age, e.g. `2m 3w` (2 months, 3 weeks), `3w 2d`,
 * `1y 2m`, `5d`. Used on the Dashboard Ready to Bill cards' "Open <age>" line.
 *
 * Shows the highest non-zero unit plus the immediately-lower unit when that is
 * also non-zero (so `1m 0w` collapses to `1m`, never a bare zero). Units:
 * y(ear)/m(onth, 30d)/w(eek, 7d)/d(ay) — abbreviations chosen by the user; note
 * `m` here means MONTHS (this line never shows minutes). Sub-day ages render as
 * `today`. Blank/invalid ISO → `—`.
 *
 * Month/week/day sizes mirror `formatTimeSince` (30-day months, 7-day weeks) so
 * the value never drifts from the older single-unit rendering.
 */
export function formatOpenAgeShort(iso: string | null | undefined, now: Date = new Date()): string {
  const t = (iso ?? '').trim()
  if (!t) return '—'
  const then = new Date(t).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = now.getTime() - then
  let days = Math.floor(diffMs / 86400000)
  if (days < 0) days = 0
  const years = Math.floor(days / 365)
  days -= years * 365
  const months = Math.floor(days / 30)
  days -= months * 30
  const weeks = Math.floor(days / 7)
  days -= weeks * 7

  const units: Array<[number, string]> = [
    [years, 'y'],
    [months, 'm'],
    [weeks, 'w'],
    [days, 'd'],
  ]
  const firstIdx = units.findIndex(([v]) => v > 0)
  if (firstIdx === -1) return 'today'
  const parts = [`${units[firstIdx]![0]}${units[firstIdx]![1]}`]
  const next = units[firstIdx + 1]
  if (next && next[0] > 0) parts.push(`${next[0]}${next[1]}`)
  return parts.join(' ')
}
