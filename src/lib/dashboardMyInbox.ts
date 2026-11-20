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

/**
 * The card's one door, drawn at the right of the title's row (v2.8040). Until then Due Today and Overdue each
 * carried a "View all →" of their own, to `/checklist` and `/checklist?tab=review`. The Checklist page lands
 * both on the same tab for every role (Review for a role with the office tabs and Task Mode off, Today for
 * everyone else), so one door for the whole inbox opens everything the two did.
 */
export const MY_INBOX_DOOR = {
  to: '/checklist',
  label: 'View all →',
  aria: 'View all of your tasks in the Checklist',
} as const

export type MyInboxSectionKey = 'today' | 'overdue' | 'completed'

/** One section label inside the card: a quiet heading under the card's title, with its count in a pill. */
export type MyInboxSectionLabel = {
  key: MyInboxSectionKey
  label: string
  /** The pill's words beside the label, or `null` for no pill (nothing open, nothing unread). */
  count: string | null
  /** `late` is Overdue's red pill. */
  tone: 'plain' | 'late'
}

/**
 * What the card's sections read, in the order they are drawn. The title's row always reads "My Inbox" and the
 * door, whatever is inside: the title is the card's landmark and the dock's chip, so it never takes a section's
 * name (a day with nothing due and three tasks overdue would otherwise read "Due Today" over an Overdue list,
 * or change its title between refreshes). Every section names itself with a label of the same weight instead.
 *
 * A section that is not drawn has no label. Due Today and Overdue count what is still open, so a task ticked
 * off and still on screen leaves the count. Recently Completed counts what is unread.
 */
export function myInboxSectionLabels(input: {
  today: { shown: boolean; open: number }
  overdue: { shown: boolean; open: number }
  completed: { shown: boolean; unread: number }
}): MyInboxSectionLabel[] {
  const labels: MyInboxSectionLabel[] = []
  if (input.today.shown) {
    labels.push({ key: 'today', label: 'Due Today', count: input.today.open > 0 ? String(input.today.open) : null, tone: 'plain' })
  }
  if (input.overdue.shown) {
    labels.push({ key: 'overdue', label: 'Overdue', count: input.overdue.open > 0 ? String(input.overdue.open) : null, tone: 'late' })
  }
  if (input.completed.shown) {
    labels.push({
      key: 'completed',
      label: 'Recently Completed',
      count: input.completed.unread > 0 ? `${input.completed.unread} unread` : null,
      tone: 'plain',
    })
  }
  return labels
}
