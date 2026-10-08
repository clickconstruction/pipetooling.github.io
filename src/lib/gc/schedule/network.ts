/**
 * GC mode, the real build, G-130: the schedule's day math in one kernel. The days, the calendar, the
 * links, the spare days and the pushes, moved word for word from `schedule.ts` and `gantt.ts` (the
 * plan: to-dos/gc-mode/mockups/G-130.md on branch spike/gc-mode). The chart and the measures both read
 * it, so a stretch of days is counted one way. `schedule.ts` and `gantt.ts` re-export what moved, so
 * no reader's import changes. It imports neither of them.
 */
import { carriedAmount } from '../bids'
import { addDays, crewStages, sentBackOpen } from '../building'
import type { ScheduleActivity } from './types'
import type { GcProject, TradePackage } from '../types'
import { weekdayDate } from '../words'

// ---------------------------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------------------------

export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000
}

/** Days from `a` to `b`: 0 on the same day, negative when `b` comes first. */
export function daysBetween(a: string, b: string): number {
  return Math.round(dayNumber(b) - dayNumber(a))
}

export function isoOf(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------------------------
// The calendar: every day is worked, and the chart marks weekends and six holidays
// ---------------------------------------------------------------------------------------------

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

export function weekdayOf(on: string): number {
  const [y, m, d] = on.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

/** The nth weekday of a month (1 = first), or the last one with n = -1. Sunday is 0. */
function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = weekdayOf(iso(y, m, 1))
    return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7)
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const last = weekdayOf(iso(y, m, lastDay))
  return iso(y, m, lastDay - ((last - weekday + 7) % 7))
}

/**
 * The holidays the chart marks. They are working days like any other (the owner, 2026-10-05); the
 * mark is so work planned on one is seen. My list of six, not the owner's; change it here.
 */
export function holidaysOf(year: number): { on: string; name: string }[] {
  return [
    { on: iso(year, 1, 1), name: "New Year's Day" },
    { on: nthWeekday(year, 5, 1, -1), name: 'Memorial Day' },
    { on: iso(year, 7, 4), name: 'Independence Day' },
    { on: nthWeekday(year, 9, 1, 1), name: 'Labor Day' },
    { on: nthWeekday(year, 11, 4, 4), name: 'Thanksgiving' },
    { on: iso(year, 12, 25), name: 'Christmas Day' },
  ]
}

/** The holiday's name on a day, or null. */
export function holidayOn(on: string): string | null {
  return holidaysOf(Number(on.slice(0, 4))).find((h) => h.on === on)?.name ?? null
}

export function isWeekend(on: string): boolean {
  const d = weekdayOf(on)
  return d === 0 || d === 6
}

/** Every day is a working day (the owner, 2026-10-05: "anyone can work 365 days a year"). Kept as the one place that says so. */
export function isWorkingDay(_on: string): boolean {
  return true
}

/** Days from start to finish, both counted: every day is worked. Zero when finish is before start. */
export function workingDays(start: string, finish: string): number {
  return finish < start ? 0 : daysBetween(start, finish) + 1
}

/** The holidays inside a stretch of days, by name: work planned on one is worth a word. */
export function holidaysIn(start: string, finish: string): string[] {
  const names: string[] = []
  for (let d = start; d <= finish; d = addDays(d, 1)) {
    const name = holidayOn(d)
    if (name) names.push(name)
  }
  return names
}

// ---------------------------------------------------------------------------------------------
// The links: what waits on what, and the gap kept after it
// ---------------------------------------------------------------------------------------------

/**
 * The gap in days an activity keeps after one it waits on finishes (G-35). Zero when none. Below
 * zero, it starts that many days before that work finishes, the two side by side (G-82).
 */
export function lagOf(a: ScheduleActivity, afterId: string): number {
  return a.lag?.[afterId] ?? 0
}

/** True when making `lineId` wait on `afterId` would make a loop: `afterId` already waits on `lineId`, directly or down the line. */
export function wouldLoop(activities: ScheduleActivity[], lineId: string, afterId: string): boolean {
  if (lineId === afterId) return true
  const byId = new Map(activities.map((a) => [a.lineId, a]))
  const seen = new Set<string>()
  const reaches = (from: string): boolean => {
    if (from === lineId) return true
    if (seen.has(from)) return false
    seen.add(from)
    return (byId.get(from)?.after ?? []).some(reaches)
  }
  return reaches(afterId)
}

/** The activities in an order where each comes after what it waits on. A loop falls back to the drawn order. */
export function waitOrder(activities: ScheduleActivity[]): ScheduleActivity[] {
  const byId = new Map(activities.map((a) => [a.lineId, a]))
  const order: ScheduleActivity[] = []
  const placed = new Set<string>()
  const place = (a: ScheduleActivity, seen: Set<string>) => {
    if (placed.has(a.lineId) || seen.has(a.lineId)) return
    seen.add(a.lineId)
    for (const id of a.after) {
      const before = byId.get(id)
      if (before) place(before, seen)
    }
    placed.add(a.lineId)
    order.push(a)
  }
  for (const a of activities) place(a, new Set())
  return order
}

// ---------------------------------------------------------------------------------------------
// Spare days
// ---------------------------------------------------------------------------------------------

/**
 * Spare days for each activity on the current plan: how long it could slip before it moves the
 * job's last finish. Zero is the critical path. An activity starts on its planned day or the day
 * after everything it waits on finishes, whichever is later.
 */
export function scheduleFloat(activities: ScheduleActivity[]): Map<string, number> {
  const duration = (a: ScheduleActivity) => daysBetween(a.start, a.finish) + 1
  const order = waitOrder(activities)
  const earlyFinish = new Map<string, number>()
  for (const a of order) {
    const waits = a.after.flatMap((id) => {
      const n = earlyFinish.get(id)
      return n === undefined ? [] : [n + 1 + lagOf(a, id)]
    })
    const start = Math.max(dayNumber(a.start), ...waits)
    earlyFinish.set(a.lineId, start + duration(a) - 1)
  }
  const end = Math.max(...earlyFinish.values())
  const lateFinish = new Map<string, number>()
  for (const a of [...order].reverse()) {
    const next = activities.filter((x) => x.after.includes(a.lineId))
    const lateStarts = next.map((x) => (lateFinish.get(x.lineId) ?? end) - duration(x) + 1 - lagOf(x, a.lineId))
    lateFinish.set(a.lineId, lateStarts.length > 0 ? Math.min(...lateStarts) - 1 : end)
  }
  return new Map(activities.map((a) => [a.lineId, Math.round((lateFinish.get(a.lineId) ?? end) - (earlyFinish.get(a.lineId) ?? end))]))
}

// ---------------------------------------------------------------------------------------------
// Pushes
// ---------------------------------------------------------------------------------------------

/**
 * A line's name, worth and percent done, whether a hired trade's or our own crew's stage. Before a
 * trade has a statement of work (while buying out), its scope lines stand in, each an even share
 * of the number we carry. A schedule-of-values line keeps its scope line's id, so the two match.
 */
export function lineOf(pkg: TradePackage, lineId: string): { label: string; worth: number; actual: number } | null {
  const self = pkg.selfPerform
  if (self) {
    const stage = crewStages(pkg).find((st) => st.lineId === lineId)
    if (!stage) return null
    return { label: stage.label, worth: (self.value * stage.weight) / 100, actual: self.pctByLine?.[lineId] ?? self.pctDone ?? 0 }
  }
  const sow = pkg.sow
  if (!sow) {
    const item = pkg.scope.find((l) => l.id === lineId)
    if (!item) return null
    return { label: item.label, worth: (carriedAmount(pkg) ?? pkg.budget) / Math.max(1, pkg.scope.length), actual: 0 }
  }
  const line = sow.sov.find((l) => l.id === lineId)
  if (!line) return null
  const weSee = sentBackOpen(sow)?.lines.find((l) => l.sovId === lineId)?.weSee
  return { label: line.label, worth: line.amount, actual: weSee ?? line.pctReported }
}

/** "HVAC · Test and balance", or an inspection by its own name. */
function activityLabel(project: GcProject, a: ScheduleActivity): string {
  if (a.inspection) return a.inspection.label
  if (a.added) return a.added.label
  const pkg = project.packages.find((k) => k.id === a.packageId)
  const line = pkg ? lineOf(pkg, a.lineId) : null
  return pkg && line ? `${pkg.trade} · ${line.label}` : a.lineId
}

/** Done: an inspection passed, or a line reported 100%. */
function activityDone(project: GcProject, a: ScheduleActivity): boolean {
  if (a.inspection) return Boolean(a.inspection.passedOn)
  if (a.added) return Boolean(a.added.doneOn)
  const pkg = project.packages.find((k) => k.id === a.packageId)
  return ((pkg && lineOf(pkg, a.lineId)?.actual) ?? 0) >= 100
}

export interface PushedAfter {
  activities: ScheduleActivity[]
  /** What moved out, in the drawn order, with its new dates. */
  moved: { lineId: string; label: string; start: string; finish: string; days: number }[]
}

/**
 * New dates on one activity push what comes after it (the owner, 2026-10-04): each activity that
 * waits on it, directly or down the line, starts the day after what it waits on finishes, keeping
 * its length. Nothing moves earlier, work already done stays put, and the rest of the plan is left
 * as drawn.
 */
export function pushAfter(project: GcProject, activities: ScheduleActivity[], lineId: string): PushedAfter {
  const downstream = new Set<string>()
  const add = (id: string) => {
    for (const a of activities) {
      if (a.after.includes(id) && a.lineId !== lineId && !downstream.has(a.lineId)) {
        downstream.add(a.lineId)
        add(a.lineId)
      }
    }
  }
  add(lineId)
  if (downstream.size === 0) return { activities, moved: [] }
  const now = new Map(activities.map((a) => [a.lineId, a]))
  for (const a of waitOrder(activities)) {
    if (!downstream.has(a.lineId) || activityDone(project, a)) continue
    // The day after the last of what it waits on finishes, plus any gap it keeps (G-35).
    const latest = Math.max(...a.after.map((id) => dayNumber(now.get(id)?.finish ?? a.start) + lagOf(a, id)))
    if (latest < dayNumber(a.start)) continue
    const shift = latest + 1 - dayNumber(a.start)
    now.set(a.lineId, { ...a, start: addDays(a.start, shift), finish: addDays(a.finish, shift) })
  }
  const next = activities.map((a) => now.get(a.lineId) ?? a)
  const moved = next.flatMap((a, i) => {
    const days = daysBetween(activities[i]?.start ?? a.start, a.start)
    return days > 0 ? [{ lineId: a.lineId, label: activityLabel(project, a), start: a.start, finish: a.finish, days }] : []
  })
  return { activities: next, moved }
}

/** "Final inspection moves to Fri Dec 18 to Sat Dec 19." · "3 activities after it move out, the last to finish Sat Dec 19." Empty: nothing moved. */
export function pushedAfterWords(moved: PushedAfter['moved']): string {
  const [one] = moved
  if (!one) return ''
  if (moved.length === 1) return `${one.label} moves to ${weekdayDate(one.start)} to ${weekdayDate(one.finish)}.`
  const last = moved.reduce((m, x) => (x.finish > m ? x.finish : m), '')
  return `${moved.length} activities after it move out, the last to finish ${weekdayDate(last)}.`
}
