/**
 * Pure helpers for the Dashboard "My Inbox" card (extraction-series refactor;
 * no behavior change). The Overdue list annotates each item with a
 * "T-minus/T-plus days until due" tag computed from the instance's
 * scheduled_date.
 */

/**
 * Whole days between the start of `today` (local) and the scheduled date
 * (parsed as local Y-M-D). Positive = due in the future, negative = overdue.
 * `today` defaults to `new Date()` to preserve the original call-site
 * semantics; tests pass it explicitly for determinism.
 */
export function getDaysUntilDue(scheduledDateStr: string, today: Date = new Date()): number {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const parts = scheduledDateStr.split('-').map(Number)
  const scheduled = new Date(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)
  return Math.round((scheduled.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000))
}

/** `T-n` counting down to the due date (including `T-0` on the day), `T+n` once overdue. */
export function formatTDays(diff: number): string {
  if (diff >= 0) return `T-${diff}`
  return `T+${Math.abs(diff)}`
}
