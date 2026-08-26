/**
 * Due-date kernel for one-off checklist tasks (v2.2351, Tier 2 of the
 * start/due design). One rule everywhere: the EFFECTIVE due date is
 * `due_date ?? scheduled/start date`, so a task without a due date behaves
 * exactly as before this feature existed — appearing and turning late on
 * the same day. All comparisons are YMD string compares in the company
 * calendar (no UTC parses).
 */

/** The date a task turns late: its due date when set, else the day it appeared. */
export function effectiveDueDate(dueDate: string | null | undefined, scheduledDate: string): string {
  return dueDate || scheduledDate
}

function dayLabel(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00')
  if (isNaN(d.getTime())) return ymd
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = new Date(fromYmd + 'T00:00:00')
  const b = new Date(toYmd + 'T00:00:00')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Chip for a task card with an explicit due date: "due Fri, Sep 4" inside
 * the window, "due today" on the day, "N days late" past it. '' when the
 * item has no due date — the caller falls back to its existing chips, so
 * legacy tasks render untouched.
 */
export function dueChipLabel(dueDate: string | null | undefined, todayStr: string): string {
  if (!dueDate) return ''
  const late = daysBetween(dueDate, todayStr)
  if (late == null) return ''
  if (late < 0) return `due ${dayLabel(dueDate)}`
  if (late === 0) return 'due today'
  return late === 1 ? '1 day late' : `${late} days late`
}

/**
 * "done 2 days late" annotation for History/Review (empty when on time or
 * no due date). `completedAt` is an ISO timestamp; its company-calendar day
 * is compared to the due date, so finishing at 11 PM on the due day is on
 * time.
 */
export function doneLateLabel(completedAt: string | null | undefined, dueDate: string | null | undefined): string {
  if (!completedAt || !dueDate) return ''
  const done = new Date(completedAt)
  if (isNaN(done.getTime())) return ''
  // Manual YMD — toLocaleDateString('en-CA') is not YYYY-MM-DD on every ICU build.
  const doneYmd = `${done.getFullYear()}-${String(done.getMonth() + 1).padStart(2, '0')}-${String(done.getDate()).padStart(2, '0')}`
  const late = daysBetween(dueDate, doneYmd)
  if (late == null || late <= 0) return ''
  return late === 1 ? 'done 1 day late' : `done ${late} days late`
}
