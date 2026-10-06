/**
 * GC mode design spike: the daily log and the chart disagree, the Gantt's Phase 4 (G-60; the
 * mock-up and plan are `to-dos/gc-mode/mockups/G-60.md`). The log says who was on site each day,
 * by trade; the chart says whose work runs. This week, on the days with a log, they can tell two
 * different stories:
 *
 * - **On site, no bar**: a trade's crew is on site on a day none of its bars runs. One day is
 *   enough: a crew on site is a fact. Most often a bar started early, or the trade came back.
 * - **Not on site**: a trade's bars that are not done run on LOG_ABSENT_DAYS or more logged
 *   weekdays, and its crew is on none of them. A day the log says the weather stopped the site,
 *   the job or that trade does not count (G-58's weather), and a held bar is explained by its hold.
 *
 * It reads the week the way the walk does (`onSiteWords`: Monday to today), so a row here and the
 * walk's fact for the same bar name the same days. Our own crew counts like any trade; inspections
 * and added activities have no crew in the log, so they never do.
 *
 * Its own file, out of the barrel: it reads the daily log, the schedule and the chart's holds.
 */
import type { DailyLog, GcProject, GcState, TradePackage } from './gcTypes'
import { mondayOf, scheduleItems, type ScheduleItem } from './gcBuildingSchedule'
import { isWorkday } from './gcBuildingLog'
import { partnerById } from './gcLookups'
import { weekdayDate } from './gcWords'
import type { GanttHold } from './gcGantt'

/** Logged weekdays a trade's running bars go without its crew before the chart says so. One day off is ordinary. */
export const LOG_ABSENT_DAYS = 2

export type LogChartKind = 'absent' | 'noBar'

export interface LogChartBar {
  lineId: string
  /** The bar's own name: "TPO membrane". */
  name: string
  start: string
  finish: string
}

/** One trade whose week on the daily log and on the chart do not agree. */
export interface LogChartGap {
  kind: LogChartKind
  pkg: TradePackage
  /** "Summit Roofing", or "Our own crew". */
  company: string
  /** The company to open. Null: our own crew. */
  partnerId: string | null
  /** absent: the logged weekdays its bars ran without it. noBar: the days it was on site with none of its bars running. */
  days: string[]
  /** absent: the logged weekdays the weather stopped it, which do not count. */
  weatherDays: string[]
  /** noBar: its worker-days on those days. */
  workerDays: number
  /** absent: its bars running those days, not done and not held. */
  running: LogChartBar[]
  /** noBar: its next bar not started, for "It started early". */
  next: LogChartBar | null
  /** noBar: its last bar, when all of its work finished before these days. */
  last: LogChartBar | null
  /** The card's sentences. */
  words: string
  /** What to do, in a sentence or two. */
  todo: string
  /** absent: the log's own reasons for the days away. Unset: it gave none, so the company is asked (the counts, G-60's reason on Follow up). */
  said?: string[]
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAY[new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()] ?? iso
}

/** "a, b and c". A name with its own "and" gets a comma before the last: "Panels and feeders, and Lighting". */
function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  const glue = words.some((w) => w.includes(' and ')) ? ', and ' : ' and '
  return `${words.slice(0, -1).join(', ')}${glue}${words[words.length - 1]}`
}

/** "Mon, Tue and Thu": one week, so the weekday's name is the day. */
function dayList(days: string[]): string {
  return listWords(days.map(dayName))
}

/** A bar runs on a day inside its planned dates, past its finish while it is not done, or inside its real dates (G-55). The morning list (G-118) reads it too. */
export function runsOn(item: ScheduleItem, day: string): boolean {
  const a = item.activity
  const done = item.actual >= 100
  if (a.start <= day && (day <= a.finish || !done)) return true
  return Boolean(a.actualStart && a.actualStart <= day && (a.actualFinish ? day <= a.actualFinish : !done || day <= a.finish))
}

/** The log says the weather stopped the site, the job or this trade that day: G-58's weather, read for a crew that never came too. */
function weatherHeld(log: DailyLog, packageId: string): boolean {
  return log.weatherStop || log.delays.some((d) => d.reason === 'weather' && (d.packageId === null || d.packageId === packageId))
}

function workersOn(log: DailyLog, packageId: string): number {
  return log.crews.find((c) => c.packageId === packageId)?.workers ?? 0
}

function barOf(item: ScheduleItem): LogChartBar {
  return { lineId: item.activity.lineId, name: item.label, start: item.activity.start, finish: item.activity.finish }
}

function whoOf(state: GcState, pkg: TradePackage): { company: string; partnerId: string | null } {
  if (pkg.selfPerform) return { company: 'Our own crew', partnerId: null }
  const partnerId = pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId ?? null
  return { company: (partnerId ? partnerById(state, partnerId)?.company : undefined) ?? pkg.trade, partnerId }
}

/** The trade's days on site with none of its bars running, with what it has before and after. */
function onSiteNoBar(pkg: TradePackage, bars: ScheduleItem[], logs: DailyLog[]): Pick<LogChartGap, 'days' | 'workerDays' | 'next' | 'last'> | null {
  const days: string[] = []
  let workerDays = 0
  for (const log of logs) {
    const workers = workersOn(log, pkg.id)
    if (workers <= 0 || bars.some((b) => runsOn(b, log.date))) continue
    days.push(log.date)
    workerDays += workers
  }
  const first = days[0]
  if (!first) return null
  // Its next bar that has not started: the one a crew on site early is most likely on.
  const next = bars.filter((b) => b.actual < 100 && b.activity.start > first && (!b.activity.actualStart || b.activity.actualStart > first)).sort((a, b) => a.activity.start.localeCompare(b.activity.start))[0]
  const last = next ? undefined : bars.filter((b) => b.activity.finish < first).sort((a, b) => b.activity.finish.localeCompare(a.activity.finish))[0]
  return { days, workerDays, next: next ? barOf(next) : null, last: last ? barOf(last) : null }
}

/** The trade's logged weekdays its running bars went without it, or null once it was on site any of them. */
function notOnSite(pkg: TradePackage, bars: ScheduleItem[], logs: DailyLog[], holds: Map<string, GanttHold>): { days: string[]; weatherDays: string[]; running: ScheduleItem[]; said: string[] } | null {
  const open = bars.filter((b) => b.actual < 100 && !holds.has(b.activity.lineId))
  const days: string[] = []
  const weatherDays: string[] = []
  const running = new Set<ScheduleItem>()
  const said: string[] = []
  for (const log of logs) {
    if (!isWorkday(log.date)) continue
    const runningThatDay = open.filter((b) => runsOn(b, log.date))
    if (runningThatDay.length === 0) continue
    if (workersOn(log, pkg.id) > 0) return null
    if (weatherHeld(log, pkg.id)) {
      weatherDays.push(log.date)
      continue
    }
    days.push(log.date)
    for (const b of runningThatDay) running.add(b)
    for (const d of log.delays) {
      if (d.packageId !== pkg.id || !d.note.trim()) continue
      const words = `The log says ${d.reason}: ${d.note.trim().replace(/[.!?]?$/, '.')}`
      if (!said.includes(words)) said.push(words)
    }
  }
  return days.length >= LOG_ABSENT_DAYS ? { days, weatherDays, running: open.filter((b) => running.has(b)), said } : null
}

/**
 * This week's disagreements between the daily log and the chart: the trades not on site first,
 * then the ones on site with no bar, each in the order of the job's trades. Empty while buying out,
 * with no schedule, or when the two agree. `holds`: the chart's holds, so a held bar is explained.
 */
export function logChartGaps(state: GcState, project: GcProject, holds: Map<string, GanttHold> = new Map()): LogChartGap[] {
  if (project.stage !== 'building' || !project.startedOn || !project.schedule) return []
  const today = state.today
  const from = mondayOf(today)
  const logs = (project.dailyLogs ?? []).filter((l) => l.date >= from && l.date <= today).sort((a, b) => a.date.localeCompare(b.date))
  if (logs.length === 0) return []
  const items = scheduleItems(state, project)
  const absent: LogChartGap[] = []
  const noBar: LogChartGap[] = []
  for (const pkg of project.packages) {
    const bars = items.filter((it) => it.pkg?.id === pkg.id && !it.activity.inspection && !it.activity.added)
    const { company, partnerId } = whoOf(state, pkg)
    const ours = Boolean(pkg.selfPerform)
    const gone = notOnSite(pkg, bars, logs, holds)
    if (gone) {
      const names = listWords(gone.running.map((b) => b.label))
      absent.push({
        kind: 'absent',
        pkg,
        company,
        partnerId,
        days: gone.days,
        weatherDays: gone.weatherDays,
        workerDays: 0,
        running: gone.running.map(barOf),
        next: null,
        last: null,
        words: [
          `${company} was not on site ${dayList(gone.days)}.`,
          `The chart has ${names} running those days.`,
          ...(gone.weatherDays.length > 0 ? [`The log says the weather stopped work ${dayList(gone.weatherDays)}.`] : []),
          ...gone.said,
        ].join(' '),
        todo: gone.said.length > 0 ? "Move the bar, and give the log's reason." : 'Ask when the crew comes back. If the work slipped, move the bar and say why.',
        ...(gone.said.length > 0 ? { said: gone.said } : {}),
      })
    }
    const here = onSiteNoBar(pkg, bars, logs)
    if (here) {
      const n = here.days.length
      const after = here.next
        ? `${here.next.name} starts ${weekdayDate(here.next.start)}.`
        : here.last
          ? `${ours ? 'Our' : 'Their'} last bar, ${here.last.name}, finished ${weekdayDate(here.last.finish)}.`
          : `None of ${ours ? 'our' : 'their'} work is on the chart.`
      noBar.push({
        kind: 'noBar',
        pkg,
        company,
        partnerId,
        ...here,
        weatherDays: [],
        running: [],
        words: [`${company} was on site ${dayList(here.days)}, ${here.workerDays} worker-${here.workerDays === 1 ? 'day' : 'days'}.`, `Nothing of ${ours ? 'ours' : 'theirs'} runs on the chart ${n === 1 ? 'that day' : 'those days'}.`, after].join(' '),
        todo: here.next
          ? 'If it started early, keep its real start. If not, fix the log.'
          : here.last
            ? 'If it is punch work, nothing changes. If the work is new, add it with Add an activity.'
            : 'Draw their work on the chart, or fix the log.',
      })
    }
  }
  return [...absent, ...noBar]
}

/**
 * The chart's side of it, by bar: the note beside it and its hover card's line. A trade not on
 * site: each of its running bars. A trade on site with no bar: its next bar, when one is coming.
 */
export function logChartNotes(gaps: LogChartGap[]): Map<string, { note: string; words: string }> {
  const notes = new Map<string, { note: string; words: string }>()
  for (const g of gaps) {
    const ours = Boolean(g.pkg.selfPerform)
    if (g.kind === 'absent') for (const b of g.running) notes.set(b.lineId, { note: 'not on site this week', words: `Nobody from ${ours ? 'our own crew' : g.company} on the daily log ${dayList(g.days)}.` })
    else if (g.next) notes.set(g.next.lineId, { note: 'on site this week, before this starts', words: `The daily log has ${ours ? 'our own crew' : 'them'} on site ${dayList(g.days)}, before this starts.` })
  }
  return notes
}
