/**
 * GC mode, the real build, the schedule's PR 1b: the finish outlook, moved word for word from the GC mode prototype
 * (branch spike/gc-mode, `gcFinishOutlook.ts`).
 */
import { addDays } from '../building'
import { partnerById } from '../lookups'
import type { CrewCountNow } from './crewCounts'
import { crewCountsNow } from './crewCounts'
import { weatherLostDays } from './daysLost'
import type { ProjectedFinish } from './schedule'
import { daysBetween, mondayOf, projectedFinish, scheduleMeasures } from './schedule'
import type { GcProject, GcState } from '../types'
import { shortDate, weekdayDate } from '../words'

/** Weather days a month on the work weather stops, our rule until the log covers a month. My default. */
export const WEATHER_DAYS_A_MONTH = 2

/** The days the log must span before its own weather rate counts. */
export const LOG_MONTH_DAYS = 28

/** The daily log's last days that say who is on site now. */
export const CREW_NOW_DAYS = 7

/** A trade's own count for a week: what the outlook reads of G-142's `CrewCountNow`. */
export type CrewTold = Pick<CrewCountNow, 'packageId' | 'weekOf' | 'count'>

/** A trade with fewer a day now than so far. */
export interface CrewShort {
  packageId: string
  company: string
  trade: string
  /** People a day now, and so far on the log, rounded. */
  now: number
  soFar: number
  /** The Monday of the week the trade gave `now` for. Null: `now` is from the daily log. */
  said: string | null
  /** Days later the job finishes with this trade's crew alone, and the day. */
  days: number
  finish: string
  /** The earliest bar its crew stretches. */
  lineId: string
}

export interface FinishOutlook {
  /** Today's projection, unchanged: the measure's own line. */
  pace: ProjectedFinish
  /** With weather and crews. Never before `pace`. */
  finish: string
  /** Days later than the pace line. 0 or more. */
  days: number
  /** `days`: what weather adds on top of the crews, so the two sentences add up to the line. `trades`: the trades weather stopped that have work left. */
  weather: { rate: number; fromLog: boolean; trades: string[]; days: number }
  /** `days`: the finish with crews alone. `nobody`: companies with work under way and nobody on site this week. */
  crews: { short: CrewShort[]; nobody: string[]; days: number }
  words: { line: string; weather: string; crews: string }
}

const daysWords = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

const COUNT_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

const countWord = (n: number) => COUNT_WORDS[n] ?? String(n)

/** "roofing", but "HVAC". */
const tradeWord = (trade: string) => (trade === trade.toUpperCase() ? trade : trade.toLowerCase())

function andList(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** One piece of work left and the days each rule gives it. */
interface Stretch {
  lineId: string
  packageId: string
  /** Days more at the crew now. 0: its crew is not short. */
  crew: number
  /** Weather days on the work left, and on the work left at the crew now. */
  weather: number
  weatherAtCrew: number
}

/**
 * The projected finish with a weather allowance and the crews on site now, beside the pace line,
 * with why the two differ. Null: not a job being built, or no schedule. `told`: the trades' own
 * counts, the newest for each trade and week (G-142).
 */
export function finishOutlook(state: GcState, project: GcProject, told: CrewTold[] = crewCountsNow(project)): FinishOutlook | null {
  const schedule = project.schedule
  if (project.stage !== 'building' || !schedule || schedule.activities.length === 0) return null
  const today = state.today
  const pace = projectedFinish(project, today)
  if (!pace) return null
  const logs = (project.dailyLogs ?? []).filter((l) => l.date <= today).sort((a, b) => a.date.localeCompare(b.date))

  // Crews so far: the log's people a day on the days a trade was on site.
  const soFar = new Map<string, { workers: number; days: number }>()
  for (const l of logs) {
    for (const c of l.crews) {
      if (c.workers <= 0) continue
      const was = soFar.get(c.packageId) ?? { workers: 0, days: 0 }
      soFar.set(c.packageId, { workers: was.workers + c.workers, days: was.days + 1 })
    }
  }
  const items = scheduleMeasures(state, project).items.filter((i) => !i.activity.inspection && !i.activity.added && i.actual < 100)
  const underWay = new Set(items.filter((i) => i.activity.start <= today).map((i) => i.activity.packageId))
  // Crews now: the trade's count for the week the work falls in, else its crew this week, its count or its newest day on the log.
  // The log speaks for a trade with work under way: not on this week's log is nobody. One with only work ahead is not here yet.
  const thisMonday = mondayOf(today)
  const weekAgo = addDays(today, -CREW_NOW_DAYS)
  const thisWeek = logs.filter((l) => l.date > weekAgo).reverse()
  const crewNow = (packageId: string, weekOf: string): { count: number; said: string | null } | null => {
    const t = told.find((x) => x.packageId === packageId && x.weekOf === weekOf) ?? told.find((x) => x.packageId === packageId && x.weekOf === thisMonday)
    if (t) return { count: t.count, said: t.weekOf }
    if (thisWeek.length === 0 || !underWay.has(packageId)) return null
    const logged = thisWeek.map((l) => l.crews.find((c) => c.packageId === packageId && c.workers > 0)).find(Boolean)
    return { count: logged?.workers ?? 0, said: null }
  }

  // Weather: the trades the log has seen stopped (G-58), and the rate, the log's once it covers a month.
  const lost = weatherLostDays(project)
  const stopped = new Set(lost.map((d) => d.packageId))
  const first = logs[0]
  const last = logs[logs.length - 1]
  const span = first && last ? daysBetween(first.date, last.date) + 1 : 0
  const fromLog = span >= LOG_MONTH_DAYS
  const rate = fromLog ? Math.round((new Set(lost.map((d) => d.date)).size / span) * 30) : WEATHER_DAYS_A_MONTH

  const stretches: Stretch[] = []
  const short = new Map<string, { now: number; soFar: number; said: string | null; lineId: string; start: string }>()
  const nobody = new Set<string>()
  for (const item of items) {
    const a = item.activity
    const started = a.start <= today
    const length = daysBetween(a.start, a.finish) + 1
    // The work left as the projection reads it: the rest from today if under way, the whole of it if not.
    const left = started ? Math.max(1, Math.ceil((length * (100 - item.actual)) / 100)) : length
    const now = crewNow(a.packageId, started ? thisMonday : mondayOf(a.start))
    const so = soFar.get(a.packageId)
    const usual = so ? so.workers / so.days : null
    let crew = 0
    if (now?.count === 0) {
      if (underWay.has(a.packageId)) nobody.add(a.packageId)
    } else if (now && usual !== null && now.count < Math.round(usual)) {
      crew = Math.ceil((left * usual) / now.count) - left
      const was = short.get(a.packageId)
      if (!was || a.start < was.start) short.set(a.packageId, { now: now.count, soFar: Math.round(usual), said: now.said, lineId: a.lineId, start: a.start })
    }
    const outside = stopped.has(a.packageId)
    stretches.push({
      lineId: a.lineId,
      packageId: a.packageId,
      crew,
      weather: outside ? Math.round((left * rate) / 30) : 0,
      weatherAtCrew: outside ? Math.round(((left + crew) * rate) / 30) : 0,
    })
  }

  // The projection with the days more: by crews, by weather, or both; one trade's crew alone with `only`.
  const finishWith = (crews: boolean, weather: boolean, only?: string): string => {
    const more = new Map<string, number>()
    for (const st of stretches) {
      if (only !== undefined && st.packageId !== only) continue
      const days = (crews ? st.crew : 0) + (weather ? (crews ? st.weatherAtCrew : st.weather) : 0)
      if (days > 0) more.set(st.lineId, days)
    }
    return more.size === 0 ? pace.on : (projectedFinish(project, today, more)?.on ?? pace.on)
  }
  const later = (on: string) => Math.max(0, daysBetween(pace.on, on))
  const both = finishWith(true, true)
  const total = later(both)
  const crewDays = later(finishWith(true, false))
  // Weather's days on top of the crews': it falls on the longer work, and the two sentences add up to the line.
  const weatherDays = total - crewDays

  const companyOf = (packageId: string): { company: string; trade: string } => {
    const pkg = project.packages.find((k) => k.id === packageId)
    const partnerId = pkg && !pkg.selfPerform ? pkg.invites.find((i) => i.id === pkg.awardedInviteId)?.partnerId : undefined
    return { company: (partnerId ? partnerById(state, partnerId)?.company : undefined) ?? 'Our own crew', trade: pkg?.trade ?? 'its trade' }
  }
  const shorts: CrewShort[] = [...short].map(([packageId, c]) => {
    const alone = finishWith(true, false, packageId)
    return { packageId, ...companyOf(packageId), now: c.now, soFar: c.soFar, said: c.said, days: later(alone), finish: alone, lineId: c.lineId }
  })
  // The one that moves the finish most first, then in the schedule's order.
  shorts.sort((a, b) => b.days - a.days)
  const nobodyNames = [...nobody].map((id) => companyOf(id).company)

  // The words: the line, then why it differs, a sentence or two each.
  const line = total === 0 ? `With weather and crews: ${weekdayDate(pace.on)}, the same day.` : `With weather and crews: ${weekdayDate(both)}, ${daysWords(total)} later.`
  const outside = [...new Set(stretches.filter((st) => stopped.has(st.packageId)).map((st) => st.packageId))]
  const trades = outside.map((id) => tradeWord(companyOf(id).trade))
  const on = trades.length > 3 ? `${countWord(trades.length).toLowerCase()} trades` : andList(trades)
  const theirs = trades.length === 1 ? 'its' : 'their'
  const weatherWords =
    stopped.size === 0
      ? 'Weather adds no days: the log has no weather yet.'
      : trades.length === 0
        ? 'Weather adds no days: the work it stopped is done.'
        : fromLog && rate === 0
          ? 'Weather adds no days: the log has under one weather day a month.'
          : weatherDays === 0
            ? fromLog
              ? `Weather adds no days. The log's ${rate} a month on ${on} fits inside ${theirs} spare days.`
              : `Weather adds no days. Our rule, ${rate} a month on ${on}, fits inside ${theirs} spare days.`
            : fromLog
              ? `Weather adds ${daysWords(weatherDays)}: ${rate} a month from the log, on the work left of ${on}.`
              : `Weather adds ${daysWords(weatherDays)}: our rule, ${rate} a month, on the work left of ${on}.`
  const nobodyWords = nobodyNames.length > 0 ? ` ${andList(nobodyNames)} ${nobodyNames.length === 1 ? 'has' : 'have'} nobody on site this week.` : ''
  const worst = shorts[0]
  const crewWords = !worst
    ? nobodyNames.length > 0
      ? `Crews add no days.${nobodyWords}`
      : soFar.size === 0
        ? 'Crews add no days: the log has no crews yet.'
        : 'Crews add no days: no trade has fewer on site than so far.'
    : crewDays === 0
      ? `Crews add no days. ${countWord(shorts.length)} ${shorts.length === 1 ? 'trade has' : 'trades have'} fewer on site than so far, and ${shorts.length === 1 ? 'its' : 'their'} spare days cover it.${nobodyWords}`
      : `Crews add ${daysWords(crewDays)}: ${worst.company} ${worst.said ? `says ${worst.now} a day` : `has ${worst.now} on site`} against ${worst.soFar} so far.${shorts.length > 1 ? ` ${countWord(shorts.length - 1)} more ${shorts.length === 2 ? 'trade is' : 'trades are'} short too.` : ''}${nobodyWords}`

  return {
    pace,
    finish: total === 0 ? pace.on : both,
    days: total,
    weather: { rate, fromLog, trades, days: weatherDays },
    crews: { short: shorts, nobody: nobodyNames, days: crewDays },
    words: { line, weather: weatherWords, crews: crewWords },
  }
}

/** The crew a short trade has or said, in a sentence's middle: "1 on site this week", "1 a day the week of Oct 12". */
function crewNowWords(c: CrewShort, today: string): string {
  if (c.said === null) return `${c.now} on site this week`
  return c.said === mondayOf(today) ? `${c.now} a day this week` : `${c.now} a day the week of ${shortDate(c.said)}`
}

/**
 * The call list's reason for a short crew that moves the finish (G-57's pick 2), the same days the
 * outlook says: "They have 1 on site this week against 3 so far. At that, the job finishes 6 days
 * later, Fri Dec 18."
 */
export function shortCrewReason(c: CrewShort, today: string): string {
  return `${c.said === null ? 'They have' : 'They said'} ${crewNowWords(c, today)} against ${c.soFar} so far. At that, the job finishes ${daysWords(c.days)} later, ${weekdayDate(c.finish)}.`
}

/** The same in a message to the trade, after "Just checking on your crew on …": "You have 1 on site this week, against 3 a day so far". */
export function shortCrewDetail(c: CrewShort, today: string): string {
  return `${c.said === null ? 'You have' : 'You told us'} ${crewNowWords(c, today)}, against ${c.soFar} a day so far`
}
