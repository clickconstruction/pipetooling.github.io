/**
 * Pure helpers for the mobile History day-ledger (the phone-first replacement
 * for the compliance grid on narrow screens): reverse-chronological day
 * groups, per-row status chips, and the summary stats strip.
 *
 * All date math works on plain `YYYY-MM-DD` strings (the shape of
 * checklist_instances.scheduled_date) so the kernel stays timezone-inert;
 * callers supply "today" already localized.
 */

import type { ChecklistCardEvent } from './checklistCardEvents'

export type LedgerInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  completed_by_user_id: string | null
  checklist_items?: { title: string; links?: string[] | null; due_date?: string | null } | null
}

export type LedgerDay = {
  date: string
  rows: LedgerInstance[]
  doneCount: number
  dueCount: number
}

/** Newest day first; rows keep their input order within a day. */
export function groupByDayDesc(instances: LedgerInstance[]): LedgerDay[] {
  const byDate = new Map<string, LedgerInstance[]>()
  for (const inst of instances) {
    const list = byDate.get(inst.scheduled_date)
    if (list) list.push(inst)
    else byDate.set(inst.scheduled_date, [inst])
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]) => ({
      date,
      rows,
      doneCount: rows.filter((r) => !!r.completed_at).length,
      dueCount: rows.length,
    }))
}

export type LedgerChip =
  | { kind: 'done'; completedAt: string }
  | { kind: 'done_by_other'; byUserId: string | null; completedAt: string }
  | { kind: 'reopened' }
  | { kind: 'missed' }
  | { kind: 'open' }

/**
 * Status chip for one row. A past-day incomplete row whose last transition is
 * `reopened` reads "Reopened" (it came back, it wasn't ignored); other past
 * incompletes are "Missed"; today-or-future incompletes are "Open".
 */
export function ledgerChip(
  inst: LedgerInstance,
  selectedUserId: string,
  todayStr: string,
  events: ChecklistCardEvent[],
): LedgerChip {
  if (inst.completed_at) {
    if (inst.completed_by_user_id && inst.completed_by_user_id !== selectedUserId) {
      return { kind: 'done_by_other', byUserId: inst.completed_by_user_id, completedAt: inst.completed_at }
    }
    return { kind: 'done', completedAt: inst.completed_at }
  }
  if (inst.scheduled_date >= todayStr) return { kind: 'open' }
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (!e) continue
    if (e.event_type === 'reopened') return { kind: 'reopened' }
    if (e.event_type === 'completed') break
  }
  return { kind: 'missed' }
}

export type LedgerStats = {
  /** Completion % over due-and-elapsed days in the current week (Sun–today); null when nothing was due. */
  weekPct: number | null
  /** Consecutive all-done days walking back from today (days with nothing due are skipped; an unfinished today doesn't break it). */
  streakDays: number
  /** Past-day incomplete rows in the loaded range. */
  missedCount: number
}

export function ledgerStats(days: LedgerDay[], todayStr: string, weekStartStr: string): LedgerStats {
  let weekDue = 0
  let weekDone = 0
  let missedCount = 0
  for (const day of days) {
    if (day.date < todayStr) missedCount += day.dueCount - day.doneCount
    if (day.date >= weekStartStr && day.date <= todayStr) {
      weekDue += day.dueCount
      weekDone += day.doneCount
    }
  }
  let streakDays = 0
  for (const day of days) {
    if (day.date > todayStr) continue
    const allDone = day.doneCount === day.dueCount
    if (day.date === todayStr) {
      if (allDone && day.dueCount > 0) streakDays++
      // an unfinished today never breaks the streak — the day isn't over
      continue
    }
    if (day.dueCount === 0) continue
    if (allDone) streakDays++
    else break
  }
  return {
    weekPct: weekDue > 0 ? Math.round((weekDone / weekDue) * 100) : null,
    streakDays,
    missedCount,
  }
}

/** "Today, Aug 19" / "Yesterday, Aug 18" / "Mon, Aug 17" day-group heading. */
export function ledgerDayLabel(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  const md = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  if (dateStr === todayStr) return `Today, ${md}`
  const t = new Date(todayStr + 'T00:00:00')
  if (!isNaN(t.getTime()) && t.getTime() - d.getTime() === 86_400_000) return `Yesterday, ${md}`
  return `${d.toLocaleDateString([], { weekday: 'short' })}, ${md}`
}

/** Sunday on-or-before the given date, as YYYY-MM-DD (company weeks start Sunday). */
export function weekStartSunday(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00')
  if (isNaN(d.getTime())) return todayStr
  d.setDate(d.getDate() - d.getDay())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------
// Outstanding (v2.1864): overdue tasks that still need doing, shown at the
// bottom of the Today tab. A missed instance qualifies when the work itself is
// still wanted — one-off tasks (repeat_type 'once') and anything the office
// flagged show_until_completed. Missed instances of recurring tasks do NOT
// qualify (yesterday's "clean office" isn't actionable; today's instance is)
// — those remain History's record and the review queue's business.
// ---------------------------------------------------------------------------

export type OutstandingQualifier = {
  repeat_type?: string | null
  show_until_completed?: boolean | null
}

export function qualifiesOutstanding(item: OutstandingQualifier | null | undefined): boolean {
  if (!item) return false
  return item.repeat_type === 'once' || !!item.show_until_completed
}

/** "due Thu, Jul 30 · 20 days ago" (— "due today" never appears; Outstanding is strictly past-due). */
export function overdueAgeLabel(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const t = new Date(todayStr + 'T00:00:00')
  if (isNaN(d.getTime()) || isNaN(t.getTime())) return `due ${dateStr}`
  const due = `due ${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}`
  const days = Math.round((t.getTime() - d.getTime()) / 86_400_000)
  if (days <= 0) return due
  return `${due} · ${days === 1 ? '1 day' : `${days} days`} ago`
}

/**
 * Sort for the Outstanding list (v2.2351): most overdue first — effective
 * due date (due_date ?? scheduled_date) ascending, so the longest-late work
 * tops the list and in-window tasks (due in the future) sink to the bottom.
 * Before due dates this was newest-first; oldest-first is the triage order.
 */
export function sortOutstanding<T extends { scheduled_date: string; checklist_items?: { due_date?: string | null } | null }>(rows: T[]): T[] {
  const key = (r: T) => r.checklist_items?.due_date || r.scheduled_date
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)))
}

/**
 * History-as-record (v2.1864): day groups containing ONLY completed rows —
 * misses live on Today's Outstanding (when they qualify) or just age out.
 * Days where nothing was completed disappear. Stats still come from the full
 * instance set via ledgerStats; only the rendered rows are filtered.
 */
export function completedDayGroups(instances: LedgerInstance[]): LedgerDay[] {
  return groupByDayDesc(instances.filter((i) => !!i.completed_at))
}
