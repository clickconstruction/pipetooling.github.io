/**
 * Pure display helpers for the Dashboard Projects card (Assigned + Subscribed Stages).
 *
 * Extracted verbatim from `src/pages/Dashboard.tsx` module scope (extraction-series
 * refactor; no behavior change). `formatDatetime` is also used by the Dashboard's
 * subcontractor last-activity job-row helpers, so `Dashboard.tsx` imports it from here.
 */

/** "Wed, 7/16/26, 3:05 PM" style label; 'unknown' when the timestamp is missing. */
export function formatDatetime(iso: string | null): string {
  if (!iso) return 'unknown'
  const date = new Date(iso)
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
  const dateTime = date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  return `${weekday}, ${dateTime}`
}

/** Whole days since `startedAt` for still-open stages; null once ended, never started, or started in the future. */
export function daysOpen(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || endedAt) return null
  const start = new Date(startedAt)
  const end = new Date()
  const result = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return result < 0 ? null : result
}

/** Assignee label; flags names that don't match any known user (identity is by user NAME). */
export function personDisplay(name: string | null, userNames: Set<string>): string {
  if (!name || !name.trim()) {
    return 'Assigned to: unknown'
  }
  const trimmedName = name.trim()
  const isUser = userNames.has(trimmedName.toLowerCase())
  return isUser ? trimmedName : `${trimmedName} (not a user)`
}
