/**
 * My Team approvals kernels (v2.2076, mockup A): the crew-lead section leads
 * with the approval decision, so these turn raw hour buckets into the compact
 * labels the cards need — the week pager label, the per-person summary
 * sentence, the pending roll-up for "Approve all", and the long-day flag that
 * keeps a 14.5-hour session from being rubber-stamped.
 */

/** A single clock session longer than this reads as "check before approving". */
export const LONG_SESSION_HOURS = 12

export function isLongSession(hours: number): boolean {
  return hours > LONG_SESSION_HOURS
}

/** "46.4h" — one decimal, trailing .0 trimmed ("8h", not "8.0h"). */
export function formatHoursShort(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}h`
}

/** Count + summed hours for the Approve-all button and the card header. */
export function pendingRollup(sessionHours: number[]): { count: number; totalHours: number } {
  const sum = sessionHours.reduce((acc, h) => acc + h, 0)
  return {
    count: sessionHours.length,
    totalHours: Math.round(sum * 100) / 100,
  }
}

function monthDay(ymd: string): { month: string; day: number } {
  const d = new Date(`${ymd}T12:00:00`)
  return { month: d.toLocaleDateString('en-US', { month: 'short' }), day: d.getDate() }
}

/**
 * Week-pager label: "This week · Aug 16–22" when today falls inside the range,
 * otherwise just the range ("Aug 9–15", "Aug 30 – Sep 5" across months).
 */
export function formatTeamWeekLabel(startYmd: string, endYmd: string, todayYmd: string): string {
  const s = monthDay(startYmd)
  const e = monthDay(endYmd)
  const range = s.month === e.month ? `${s.month} ${s.day}–${e.day}` : `${s.month} ${s.day} – ${e.month} ${e.day}`
  const inRange = todayYmd >= startYmd && todayYmd <= endYmd
  return inRange ? `This week · ${range}` : range
}

export type PersonWeekHours = {
  total: number
  active: number
  pending: number
  approved: number
  manual: number
}

/**
 * The one-line story under a person's name — replaces the seven-column table
 * that clipped off-screen at phone widths. Leads with the total, then only the
 * buckets that are non-zero; the all-pending case gets the direct form because
 * that's the "your move" state the section exists for.
 */
export function personWeekSummaryLine(h: PersonWeekHours): string {
  const nearlyZero = (n: number) => Math.round(n * 10) === 0
  if (nearlyZero(h.total) && nearlyZero(h.active)) return 'No hours this week yet'
  const total = formatHoursShort(h.total)
  if (!nearlyZero(h.pending) && nearlyZero(h.approved) && nearlyZero(h.manual) && nearlyZero(h.active)) {
    return `${total} this week — all waiting on you`
  }
  const parts: string[] = []
  if (!nearlyZero(h.approved)) parts.push(`${formatHoursShort(h.approved)} approved`)
  if (!nearlyZero(h.pending)) parts.push(`${formatHoursShort(h.pending)} pending`)
  if (!nearlyZero(h.manual)) parts.push(`${formatHoursShort(h.manual)} manual`)
  if (!nearlyZero(h.active)) parts.push(`${formatHoursShort(h.active)} on the clock now`)
  return parts.length > 0 ? `${total} this week — ${parts.join(' · ')}` : `${total} this week`
}
