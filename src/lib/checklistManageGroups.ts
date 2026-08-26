/**
 * Pure helpers for the Manage tab's task library: repeat-rule chips and the
 * open-age signal for one-off tasks. Grouping itself (one-offs open /
 * repeating / completed) predates this kernel and stays in the tab.
 */

const DAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type ManageChipItem = {
  show_until_completed?: boolean | null
  repeat_type?: string | null
  repeat_days_of_week?: number[] | null
  repeat_days_after?: number | null
}

/** "until completed" / "Every day" / "Mon Wed Fri" / "7 days after done" / "once". */
export function repeatChipLabel(item: ManageChipItem): string {
  if (item.show_until_completed) return 'until completed'
  if (item.repeat_type === 'day_of_week') {
    const days = [...new Set(item.repeat_days_of_week ?? [])].filter((d) => d >= 0 && d <= 6).sort()
    if (days.length === 0) return 'weekly'
    if (days.length === 7) return 'Every day'
    return days.map((d) => DAY_ABBREV[d]).join(' ')
  }
  if (item.repeat_type === 'days_after_completion') {
    const n = item.repeat_days_after ?? 0
    return n === 1 ? '1 day after done' : `${n} days after done`
  }
  return 'once'
}

/**
 * "open 150 days" chip for one-offs; "starts Mon, Aug 31" when the task's
 * date hasn't arrived yet (v2.2346 — before this, every future date collapsed
 * into "open today" and scheduled work wore the overdue chip); '' when
 * nothing is open.
 */
export function openAgeLabel(oldestIncompleteDate: string | undefined, todayStr: string): string {
  if (!oldestIncompleteDate) return ''
  const t = new Date(todayStr + 'T00:00:00')
  const d = new Date(oldestIncompleteDate + 'T00:00:00')
  if (isNaN(t.getTime()) || isNaN(d.getTime())) return ''
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000)
  if (days < 0) {
    const future = new Date(oldestIncompleteDate + 'T12:00:00')
    return `starts ${future.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
  }
  if (days === 0) return 'open today'
  return `open ${days === 1 ? '1 day' : `${days} days`}`
}

/** True when the one-off's earliest open occurrence is still in the future — the Manage "Scheduled" section test (v2.2346). */
export function isScheduledAhead(oldestIncompleteDate: string | undefined, todayStr: string): boolean {
  return !!oldestIncompleteDate && oldestIncompleteDate > todayStr
}

/** "next Mon, Aug 24" chip for repeating rows; "next today" → "due today"; '' when nothing upcoming. */
export function nextOccurrenceLabel(nextOpenDate: string | undefined, todayStr: string): string {
  if (!nextOpenDate) return ''
  if (nextOpenDate === todayStr) return 'due today'
  const d = new Date(nextOpenDate + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  return `next ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
}
