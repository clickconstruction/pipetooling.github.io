/**
 * GC mode — design spike: the superintendent's daily log (Building lane, owner 2026-10-04). One
 * log per working day on a job being built: the weather, who was on site and how many, what got
 * done, what held work up (the look-ahead's reasons), and who came by. It backs up the
 * look-ahead marks (who was on site that week) and says when a working day has no log.
 *
 * Import from `./gcModel`.
 */
import type { DailyLog, GcProject, LookAheadReason, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { daysBetween, mondayOf } from './gcBuildingSchedule'
import { shortDate, weekdayDate } from './gcWords'
// What moved to main (the real build) is re-exported from there, so there is one copy.
import { isWorkday } from '../gc/buildingLog'
export { isWorkday, onSite, onSiteWords } from '../gc/buildingLog'

/** How many working days back a missing log is flagged (the last week). My default. */
export const LOG_LOOKBACK_WORKDAYS = 5

/** The working days from `from` to `to`, both counted. */
export function workdaysBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkday(d)) out.push(d)
  return out
}

/** The trades that can be on site: the ones we hired with a signed statement of work, and our own crew. */
export function logTrades(project: GcProject): TradePackage[] {
  return project.packages.filter((k) => k.selfPerform || k.sow?.status === 'signed')
}

export function dailyLogOn(project: GcProject, date: string): DailyLog | null {
  return (project.dailyLogs ?? []).find((l) => l.date === date) ?? null
}

/**
 * Working days with no log, oldest first: the last LOG_LOOKBACK_WORKDAYS before today, not before
 * work started. Today is not late yet.
 */
export function missingLogs(project: GcProject, today: string): string[] {
  if (project.stage !== 'building' || !project.startedOn) return []
  const days: string[] = []
  for (let d = addDays(today, -1); days.length < LOG_LOOKBACK_WORKDAYS && d >= project.startedOn; d = addDays(d, -1)) {
    if (isWorkday(d)) days.unshift(d)
  }
  return days.filter((d) => !dailyLogOn(project, d))
}

/** The week's working days, Monday to Friday, each with its log. */
export function weekOfLogs(project: GcProject, today: string): { date: string; log: DailyLog | null }[] {
  const monday = mondayOf(today)
  return workdaysBetween(monday, addDays(monday, 4)).map((date) => ({ date, log: dailyLogOn(project, date) }))
}

/** The delays logged between two days, newest first. */
export function logDelays(project: GcProject, from: string, to: string): { date: string; packageId: string | null; reason: LookAheadReason; note: string }[] {
  return (project.dailyLogs ?? [])
    .filter((l) => l.date >= from && l.date <= to)
    .flatMap((l) => l.delays.map((d) => ({ date: l.date, ...d })))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** A new log for a day, started from the last one before it: the same crews and weather to change. */
export function newDailyLog(project: GcProject, date: string): Omit<DailyLog, 'writtenOn'> {
  const before = (project.dailyLogs ?? []).filter((l) => l.date < date).sort((a, b) => b.date.localeCompare(a.date))[0]
  return {
    date,
    sky: before?.sky === 'rain' || before?.sky === 'storm' ? 'cloudy' : (before?.sky ?? 'clear'),
    high: before?.high ?? 85,
    low: before?.low ?? 65,
    weatherStop: false,
    crews: before ? before.crews.map((c) => ({ ...c })) : [],
    done: '',
    delays: [],
    visitors: '',
  }
}

/** The missing days in a sentence: "No daily log for Wed Sep 30." */
export function missingLogsWords(days: string[]): string | null {
  if (days.length === 0) return null
  const names = days.map((d) => (days.length === 1 ? weekdayDate(d) : shortDate(d)))
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `No daily log for ${list}.`
}

/** Days since the last log, for the tab's header. Null: none yet. */
export function daysSinceLastLog(project: GcProject, today: string): number | null {
  const last = (project.dailyLogs ?? []).reduce<string | null>((m, l) => (m === null || l.date > m ? l.date : m), null)
  return last ? daysBetween(last, today) : null
}
