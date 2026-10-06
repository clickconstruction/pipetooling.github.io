/**
 * GC mode design spike: the schedule as a Gantt, Phase 1 (the owner, 2026-10-05: "start with phase
 * 1 … make this look great and be very informative"; `to-dos/gc-mode/GANTT_PLAN.md`, features
 * numbered in `GANTT_FEATURES.md`). What the chart draws, worked out here so the screen only draws:
 * the working calendar, each bar's standing, the groups, the filters, the links and the time axis.
 *
 * The calendar is the owner's (2026-10-05): "holidays and weekends do not have to be taken off,
 * anyone can work 365 days a year." So every day is a working day and a bar's length is its
 * calendar days. A weekend and a holiday are only marked on the chart, so a date reads at a glance
 * and nobody is surprised to find work planned on Thanksgiving.
 *
 * Its own file, out of the barrel: it reads the schedule and New Project's stages.
 */
import { addDays } from './gcBuilding'
import { daysBetween, type MilestoneRow, type ScheduleItem } from './gcBuildingSchedule'
import { SCHEDULE_STAGES, lineStage } from './gcNewProject'

// ---------------------------------------------------------------------------------------------
// The working calendar
// ---------------------------------------------------------------------------------------------

function iso(y: number, m: number, d: number): string {
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10)
}

function weekdayOf(on: string): number {
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
// Each bar's standing
// ---------------------------------------------------------------------------------------------

/** What holds an activity: a submittal not approved, a question not answered, or something the work waits on from outside (a delivery, a decision, a permit, the utility; G-73 to G-75). `paperwork`: the trade's papers are not in before it starts (G-77, `gcNotReady.ts`). */
export interface GanttHold {
  kind: 'submittal' | 'rfi' | 'delivery' | 'decision' | 'permit' | 'utility' | 'paperwork'
  /** "submittal 07 62 00-01", "RFI-003", "Rooftop units, expected Oct 20, 8 days after this starts". */
  words: string
  late: boolean
}

export type GanttStatus = 'done' | 'failed' | 'late' | 'held' | 'behind' | 'ahead' | 'onTrack' | 'notStarted'

export interface GanttBar {
  item: ScheduleItem
  id: string
  /** Spare days on the current plan. Zero: on the chain that sets the finish. */
  spare: number
  /** No spare days and not done. */
  critical: boolean
  /** Few spare days and not done (TIGHT_SPARE_DAYS or fewer): a slip of a week moves the finish. Critical bars are tight too. */
  tight: boolean
  status: GanttStatus
  /** Said in the pill beside the name: "done", "3 days late", "held", "behind", "12 spare days". */
  statusWords: string
  tone: 'green' | 'red' | 'amber' | 'blue' | 'grey'
  /** Days past its finish with work left. Zero when not late. */
  daysLate: number
  hold: GanttHold | null
  /** Days it is planned to take: every day is worked. */
  workDays: number
  /** Holidays its days run over, by name. */
  holidays: string[]
  /** Its dates are not the ones in the plan at Start. */
  moved: boolean
  /** It is under way or starts within three weeks of today. */
  soon: boolean
  /** Days a signed change order adds to this work that are not on its dates yet (G-76), drawn as a tail. Null: none. */
  coTail: { days: number; words: string } | null
}

const SOON_DAYS = 21
/** A bar with this many spare days or fewer is tight: drawn and counted with the ones that have none. */
export const TIGHT_SPARE_DAYS = 5
/** Points of percent behind the plan before a bar says so: under it, a bar is on track. */
export const BEHIND_POINTS = 5

/** One bar per activity, with where it stands today. `building` off (buying out): nothing is late or behind yet. */
export function ganttBars(items: ScheduleItem[], float: Map<string, number>, holds: Map<string, GanttHold>, today: string, building: boolean, tails?: Map<string, { days: number; words: string }>): GanttBar[] {
  return items.map((item) => {
    const a = item.activity
    const spare = float.get(a.lineId) ?? 0
    const done = item.actual >= 100
    const hold = done ? null : (holds.get(a.lineId) ?? null)
    const daysLate = building && !done && a.finish < today ? daysBetween(a.finish, today) : 0
    const started = a.start <= today
    const gap = Math.round(item.plannedToday - item.actual)
    // An inspection or an added activity has no percent to read against the plan: it is done, or not.
    const noReport = Boolean(a.inspection || a.added)
    const behind = building && !done && started && !noReport && gap >= BEHIND_POINTS
    const ahead = building && !done && !noReport && item.actual - item.plannedToday >= BEHIND_POINTS
    // An inspection that failed and has not passed since: the day it is seen again is its new day.
    const fails = a.inspection && !a.inspection.passedOn ? (a.inspection.failed ?? []) : []
    const lastFail = fails[fails.length - 1]
    const status: GanttStatus = done ? 'done' : lastFail ? 'failed' : daysLate > 0 ? 'late' : hold ? 'held' : behind ? 'behind' : ahead ? 'ahead' : started && building ? 'onTrack' : 'notStarted'
    const critical = spare === 0 && !done
    const tight = spare <= TIGHT_SPARE_DAYS && !done
    const spareWords = critical ? 'no spare days' : `${spare} spare ${spare === 1 ? 'day' : 'days'}`
    const words: Record<GanttStatus, string> = {
      done: a.inspection ? 'passed' : 'done',
      failed: 'failed',
      late: `${daysLate} ${daysLate === 1 ? 'day' : 'days'} late`,
      held: 'held',
      behind: a.finish === today ? 'due today' : 'behind',
      ahead: 'ahead',
      onTrack: spareWords,
      notStarted: spareWords,
    }
    const tones: Record<GanttStatus, GanttBar['tone']> = { done: 'green', failed: 'red', late: 'red', held: 'amber', behind: 'amber', ahead: 'green', onTrack: 'grey', notStarted: 'grey' }
    return {
      item,
      id: a.lineId,
      spare,
      critical,
      tight,
      status,
      statusWords: words[status],
      tone: (status === 'onTrack' || status === 'notStarted') && tight ? 'red' : tones[status],
      daysLate,
      hold,
      workDays: workingDays(a.start, a.finish),
      holidays: done ? [] : holidaysIn(a.start, a.finish),
      moved: item.baseline.start !== a.start || item.baseline.finish !== a.finish,
      soon: !done && a.start <= addDays(today, SOON_DAYS) && a.finish >= today,
      coTail: done ? null : (tails?.get(a.lineId) ?? null),
    }
  })
}

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

export interface GanttFilters {
  /** Few or no spare days (TIGHT_SPARE_DAYS or fewer). */
  critical: boolean
  /** Past its finish, behind where the plan has it today, or an inspection that failed. */
  late: boolean
  held: boolean
  /** Under way or starting inside three weeks. */
  soon: boolean
  /** Not where the plan at Start had it. */
  moved: boolean
}

export const NO_FILTERS: GanttFilters = { critical: false, late: false, held: false, soon: false, moved: false }

const FILTER_TEST: Record<keyof GanttFilters, (b: GanttBar) => boolean> = {
  critical: (b) => b.tight,
  late: (b) => b.status === 'late' || b.status === 'behind' || b.status === 'failed',
  held: (b) => b.hold !== null,
  soon: (b) => b.soon,
  moved: (b) => b.moved && b.status !== 'done',
}

/** How many bars each filter would show: the numbers on the filter pills, which are the chart's summary. */
export function ganttCounts(bars: GanttBar[]): Record<keyof GanttFilters, number> {
  const count = (key: keyof GanttFilters) => bars.filter(FILTER_TEST[key]).length
  return { critical: count('critical'), late: count('late'), held: count('held'), soon: count('soon'), moved: count('moved') }
}

/** The bars that pass every filter turned on. None on: all of them. */
export function ganttFilter(bars: GanttBar[], filters: GanttFilters): GanttBar[] {
  const on = (Object.keys(FILTER_TEST) as (keyof GanttFilters)[]).filter((k) => filters[k])
  return on.length === 0 ? bars : bars.filter((b) => on.every((k) => FILTER_TEST[k](b)))
}

// ---------------------------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------------------------

export type GanttGroupBy = 'trade' | 'stage' | 'company'

export interface GanttGroup {
  key: string
  title: string
  /** Said after the title, quieter: the company of a trade, the trades of a stage or company. */
  sub: string
  bars: GanttBar[]
  /** The group as one bar: its first start, last finish, and percent done weighted by what each line is worth. */
  start: string
  finish: string
  pct: number
  late: number
  critical: number
  held: number
}

const INSPECTIONS_KEY = 'inspections'
/** Added activities (G-38) group together under the job's own name; by stage they sit where their dates fall. */
const ADDED_KEY = 'added'

function summarize(key: string, title: string, sub: string, bars: GanttBar[]): GanttGroup {
  const worth = bars.reduce((sum, b) => sum + b.item.worth, 0)
  const pct = worth > 0 ? bars.reduce((sum, b) => sum + b.item.worth * Math.min(100, b.item.actual), 0) / worth : bars.reduce((sum, b) => sum + Math.min(100, b.item.actual), 0) / Math.max(1, bars.length)
  return {
    key,
    title,
    sub,
    bars,
    start: bars.reduce((a, b) => (b.item.activity.start < a ? b.item.activity.start : a), bars[0]?.item.activity.start ?? ''),
    finish: bars.reduce((a, b) => (b.item.activity.finish > a ? b.item.activity.finish : a), bars[0]?.item.activity.finish ?? ''),
    pct,
    late: bars.filter(FILTER_TEST.late).length,
    critical: bars.filter((b) => b.tight).length,
    held: bars.filter((b) => b.hold !== null).length,
  }
}

function uniq(words: string[]): string[] {
  return [...new Set(words)]
}

/**
 * The bars in groups. By trade: the order the schedule draws them, the company after the trade's
 * name. By stage: the stages of the job in order, inspections last. By company: the company with
 * the most late work first, the list to work the phone from.
 */
export function ganttGroups(bars: GanttBar[], by: GanttGroupBy): GanttGroup[] {
  const keyOf = (b: GanttBar): string => {
    if (by === 'trade') return b.item.pkg?.id ?? (b.item.activity.added ? ADDED_KEY : INSPECTIONS_KEY)
    if (by === 'company') return b.item.company
    return b.item.activity.inspection ? INSPECTIONS_KEY : b.item.activity.added ? ADDED_KEY : lineStage(b.item.trade, b.item.label)
  }
  const order: string[] = []
  const byKey = new Map<string, GanttBar[]>()
  for (const b of bars) {
    const key = keyOf(b)
    if (!byKey.has(key)) {
      byKey.set(key, [])
      order.push(key)
    }
    byKey.get(key)?.push(b)
  }
  const groups = order.map((key) => {
    const list = byKey.get(key) ?? []
    const head = list[0]?.item
    const trades = uniq(list.map((b) => b.item.trade)).join(', ')
    if (by === 'trade') return summarize(key, head?.trade ?? '', key === ADDED_KEY ? uniq(list.map((b) => b.item.company)).join(', ') : (head?.company ?? ''), list)
    if (by === 'company') return summarize(key, key, trades === key ? '' : trades, list)
    const stage = SCHEDULE_STAGES.find((s) => s.key === key)
    return summarize(key, key === INSPECTIONS_KEY ? 'Inspections' : key === ADDED_KEY ? (head?.trade ?? key) : (stage?.label ?? key), trades, list)
  })
  if (by === 'stage') {
    // The added ones sit among the stages where their first start falls.
    const added = groups.find((g) => g.key === ADDED_KEY)
    const stageAt = (key: string) => SCHEDULE_STAGES.findIndex((s) => s.key === key)
    const addedAt = added ? (groups.filter((g) => g.key !== ADDED_KEY && g.key !== INSPECTIONS_KEY && g.start > added.start).map((g) => stageAt(g.key)).sort((a, b) => a - b)[0] ?? 998) - 0.5 : 0
    const at = (key: string) => (key === INSPECTIONS_KEY ? 999 : key === ADDED_KEY ? addedAt : stageAt(key))
    return groups.sort((a, b) => at(a.key) - at(b.key))
  }
  if (by === 'company') return groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.late - a.g.late || a.i - b.i).map((x) => x.g)
  return groups
}

/**
 * The chart as a list for a phone (G-19): the stages of the job, the one running today first, then
 * the ones ahead in order, then the ones done. A stage with every bar done opens folded.
 */
export function ganttListGroups(bars: GanttBar[], today: string): { group: GanttGroup; open: boolean; now: boolean }[] {
  const groups = ganttGroups(bars, 'stage')
  const rank = (g: GanttGroup) => (g.start <= today && g.finish >= today ? 0 : g.start > today ? 1 : 2)
  return groups
    .map((group, i) => ({ group, i }))
    .sort((a, b) => rank(a.group) - rank(b.group) || (rank(a.group) === 2 ? b.group.finish.localeCompare(a.group.finish) : a.i - b.i))
    .map(({ group }) => ({ group, now: rank(group) === 0, open: !group.bars.every((b) => b.status === 'done') }))
}

/** One row of the chart laid out: a group's header or a bar, with where it sits from the top. */
export type GanttRowEntry = { kind: 'group'; key: string; y: number; height: number } | { kind: 'bar'; key: string; y: number; height: number; groupKey: string }

/**
 * Which rows to draw when only the rows in view are drawn (G-135): the entries whose span crosses
 * the window, with some overscan so a slow scroll never shows a gap. Group headers always draw.
 */
export function rowsInView(entries: GanttRowEntry[], top: number, height: number, overscan = 400): Set<string> {
  const from = top - overscan
  const to = top + height + overscan
  return new Set(entries.filter((e) => e.kind === 'group' || (e.y + e.height >= from && e.y <= to)).map((e) => e.key))
}

// ---------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------

export interface GanttLink {
  from: string
  to: string
  /** Both ends are tight: the link is part of the chain that sets the finish. */
  critical: boolean
}

/** A line from each activity to the ones that wait on it, among the bars given. */
export function ganttLinks(bars: GanttBar[]): GanttLink[] {
  const byId = new Map(bars.map((b) => [b.id, b]))
  return bars.flatMap((to) =>
    to.item.activity.after.flatMap((fromId) => {
      const from = byId.get(fromId)
      return from ? [{ from: from.id, to: to.id, critical: from.spare <= TIGHT_SPARE_DAYS && to.tight }] : []
    }),
  )
}

/** The names of what an activity waits on, and of what waits on it, among every bar. */
export function ganttNeighbors(bars: GanttBar[], id: string): { waitsOn: string[]; holdsUp: string[] } {
  const byId = new Map(bars.map((b) => [b.id, b]))
  const name = (b: GanttBar) => (b.item.activity.inspection ? b.item.label : `${b.item.label} (${b.item.trade})`)
  const me = byId.get(id)
  return {
    waitsOn: (me?.item.activity.after ?? []).flatMap((a) => (byId.get(a) ? [name(byId.get(a) as GanttBar)] : [])),
    holdsUp: bars.filter((b) => b.item.activity.after.includes(id)).map(name),
  }
}

/**
 * The line of a link as an SVG path: out of the right end of the work before, down or up, into the
 * left end of the work after, with an arrow head. When the work after starts before the work
 * before ends, the line leaves the row first so it does not run through the bars.
 */
export function linkPath(x2: number, y1: number, x1: number, y2: number, rowGap: number): string {
  const head = ` l-4 -3 m4 3 l-4 3`
  const out = x2 + 6
  if (x1 - 6 >= out) return `M${x2} ${y1} H${out} V${y2} H${x1}${head}`
  const lane = y1 + (y2 >= y1 ? rowGap / 2 : -rowGap / 2)
  return `M${x2} ${y1} H${out} V${lane} H${x1 - 8} V${y2} H${x1}${head}`
}

// ---------------------------------------------------------------------------------------------
// The time axis
// ---------------------------------------------------------------------------------------------

export type GanttZoom = 'days' | 'weeks' | 'months'

/** How wide a day draws at each zoom. */
export const ZOOM_PX: Record<GanttZoom, number> = { days: 24, weeks: 9, months: 4 }

export interface GanttAxis {
  first: string
  days: number
  /** The months across the top: where each starts, in days from the first day, and how many days of it show. */
  months: { label: string; at: number; days: number }[]
  /** The marks under the months: every day, every Monday, or the 1st and 15th. */
  ticks: { label: string; at: number; strong: boolean }[]
  /** Days marked on the chart: a weekend or a holiday. Both are worked; the mark is only to read the dates by. */
  marked: { at: number; weekend: boolean; holiday: string | null }[]
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** From a week before the first date to two weeks after the last, starting on a Monday. */
export function ganttAxis(bars: GanttBar[], milestones: MilestoneRow[], today: string, zoom: GanttZoom): GanttAxis {
  const dates = bars.flatMap((b) => [b.item.activity.start, b.item.activity.finish, b.item.baseline.start, b.item.baseline.finish]).concat(milestones.map((m) => m.due), [today])
  const min = dates.reduce((a, b) => (a < b ? a : b))
  const max = dates.reduce((a, b) => (a > b ? a : b))
  let first = addDays(min, -5)
  while (weekdayOf(first) !== 1) first = addDays(first, -1)
  const last = addDays(max, 14)
  const days = daysBetween(first, last) + 1
  const months: GanttAxis['months'] = []
  const ticks: GanttAxis['ticks'] = []
  const marked: GanttAxis['marked'] = []
  for (let i = 0; i < days; i++) {
    const on = addDays(first, i)
    const dom = Number(on.slice(8))
    if (i === 0 || dom === 1) months.push({ label: `${MONTH_NAMES[Number(on.slice(5, 7)) - 1] ?? ''} ${on.slice(0, 4)}`, at: i, days: 0 })
    const month = months[months.length - 1]
    if (month) month.days += 1
    const monday = weekdayOf(on) === 1
    if (zoom === 'days') ticks.push({ label: String(dom), at: i, strong: monday })
    else if (zoom === 'weeks' && monday) ticks.push({ label: String(dom), at: i, strong: false })
    else if (zoom === 'months' && (dom === 1 || dom === 15)) ticks.push({ label: String(dom), at: i, strong: dom === 1 })
    const holiday = holidayOn(on)
    if (holiday || isWeekend(on)) marked.push({ at: i, weekend: isWeekend(on), holiday })
  }
  return { first, days, months, ticks, marked }
}
