/**
 * GC mode, the real build, the Building lane's U3a-ii: the superintendent's daily log as its rows hold
 * it (`gc_daily_logs` with `gc_daily_log_crews` and `gc_daily_log_delays`, migration
 * 20261008030000), read back as the prototype's `DailyLog`, so the kernels in ./buildingLog.ts read it
 * unchanged. And the other way: a log from the window as `gc_save_daily_log` takes it (migration
 * 20261009120000), cleaned the way the prototype's `saveDailyLog` cleaned it. Building's U8 lays our own
 * crew's clock-ins into the logs (`withCrewClockIns`, `gc_crew_on_site`, migration 20261010063000).
 */
import type { Database } from '../../types/database'
import { addDays } from './building'
import type { LookAheadReason } from './schedule/types'
import type { DailyLog, GcProject, GcState, WeatherSky } from './types'

type Tables = Database['public']['Tables']
export type DailyLogCrewRow = Tables['gc_daily_log_crews']['Row']
export type DailyLogDelayRow = Tables['gc_daily_log_delays']['Row']
/** A day's log with its crews and delays, as `loadGcDailyLogs` reads them in one select. */
export type DailyLogRow = Tables['gc_daily_logs']['Row'] & {
  gc_daily_log_crews: DailyLogCrewRow[]
  gc_daily_log_delays: DailyLogDelayRow[]
}

const SKIES: readonly WeatherSky[] = ['clear', 'cloudy', 'rain', 'storm', 'wind']
const REASONS: readonly LookAheadReason[] = ['weather', 'trade before', 'materials', 'crew', 'other']

function known<T extends string>(value: string, allowed: readonly T[], what: string): T {
  if ((allowed as readonly string[]).includes(value)) return value as T
  throw new Error(`A daily log's ${what} reads "${value}", which the app does not know.`)
}

/**
 * One day's log as the kernels read it. Its delays come in the order they were written. Its crews
 * come in the job's order of trades when the job is given, since the table keeps no order of its own.
 */
export function dailyLogFromRow(row: DailyLogRow, project?: Pick<GcProject, 'packages'>): DailyLog {
  const order = new Map((project?.packages ?? []).map((k, i) => [k.id, i]))
  const place = (packageId: string) => order.get(packageId) ?? order.size
  return {
    date: row.log_date,
    sky: known(row.sky, SKIES, 'sky'),
    high: row.high,
    low: row.low,
    weatherStop: row.weather_stop,
    crews: [...row.gc_daily_log_crews].sort((a, b) => place(a.package_id) - place(b.package_id)).map((c) => ({ packageId: c.package_id, workers: c.workers })),
    done: row.done,
    delays: [...row.gc_daily_log_delays]
      .sort((a, b) => a.position - b.position)
      .map((d) => ({ packageId: d.package_id, reason: known(d.reason, REASONS, 'reason'), note: d.note })),
    visitors: row.visitors,
    writtenOn: row.written_on,
  }
}

/** The board's projects with their daily logs laid over them, oldest day first (`boardProjectFromView` maps the rest). */
export function withDailyLogs(state: GcState, rows: DailyLogRow[]): GcState {
  return {
    ...state,
    projects: state.projects.map((project) => ({
      ...project,
      dailyLogs: rows
        .filter((row) => row.project_id === project.id)
        .map((row) => dailyLogFromRow(row, project))
        .sort((a, b) => a.date.localeCompare(b.date)),
    })),
  }
}

/** What `gc_save_daily_log` reads: the prototype's log, with the job and the writer's own day. */
export interface DailyLogPayload {
  projectId: string
  /** The day the log is for, YYYY-MM-DD. */
  date: string
  /** The writer's company day, YYYY-MM-DD. Later than `date`: caught up after the day. */
  today: string
  sky: WeatherSky
  high: number
  low: number
  weatherStop: boolean
  crews: { packageId: string; workers: number }[]
  done: string
  delays: { packageId: string | null; reason: LookAheadReason; note: string }[]
  visitors: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * A log from the window as the press takes it. The words lose every space and line break at their
 * ends, as the prototype's trim did; the press's own btrim takes spaces only. The degrees and counts
 * are rounded, and a trade with nobody on site is left off. Each day must read YYYY-MM-DD, since the
 * press takes anything Postgres can read as a date. A refusal here is thrown in words.
 */
export function dailyLogPayload(projectId: string, log: Omit<DailyLog, 'writtenOn'>, today: string): DailyLogPayload {
  if (!DAY.test(log.date)) throw new Error(`The log's day reads "${log.date}". Pick the day again.`)
  if (!DAY.test(today)) throw new Error(`Today reads "${today}". Reload the page and write the log again.`)
  if (!Number.isFinite(log.high) || !Number.isFinite(log.low)) throw new Error('Type the day’s high and low in degrees.')
  return {
    projectId,
    date: log.date,
    today,
    sky: log.sky,
    high: Math.round(log.high),
    low: Math.round(log.low),
    weatherStop: log.weatherStop,
    crews: log.crews.map((c) => ({ packageId: c.packageId, workers: Math.round(c.workers) })).filter((c) => c.workers > 0),
    done: log.done.trim(),
    delays: log.delays.map((d) => ({ packageId: d.packageId, reason: d.reason, note: d.note.trim() })),
    visitors: log.visitors.trim(),
  }
}

// ---------------------------------------------------------------------------------------------
// Our own crew's head count from its clock-ins (Building's U8; to-dos/gc-mode/mockups/building-u8.md)
// ---------------------------------------------------------------------------------------------

/** One row of `gc_crew_on_site`: how many of our people clocked in on a trade's Pipeline job that day. */
export type CrewOnSiteRow = Database['public']['Functions']['gc_crew_on_site']['Returns'][number]

/** The count for our crew's trade on a day, or null when nobody clocked in. */
export function crewOnSiteOn(rows: readonly CrewOnSiteRow[], packageId: string, date: string): number | null {
  const row = rows.find((r) => r.package_id === packageId && r.work_date === date)
  return row && row.people > 0 ? row.people : null
}

/**
 * A log with our crew's clock-ins laid in: each trade our own crew does with a count that day has it as its
 * workers, in place of a typed count, or added when the log had none, the crews kept in the job's order of
 * trades. A log with no count that day comes back as it was, the same object.
 */
export function logWithClockIns<T extends Pick<DailyLog, 'date' | 'crews'>>(log: T, project: Pick<GcProject, 'packages'>, rows: readonly CrewOnSiteRow[]): T {
  const counted = new Map<string, number>()
  for (const k of project.packages) {
    const people = k.selfPerform ? crewOnSiteOn(rows, k.id, log.date) : null
    if (people !== null) counted.set(k.id, people)
  }
  if (counted.size === 0) return log
  const order = new Map(project.packages.map((k, i) => [k.id, i]))
  const place = (packageId: string) => order.get(packageId) ?? order.size
  const crews = [...log.crews.filter((c) => !counted.has(c.packageId)), ...[...counted].map(([packageId, workers]) => ({ packageId, workers }))].sort(
    (a, b) => place(a.packageId) - place(b.packageId),
  )
  return { ...log, crews }
}

/**
 * The board's logs with our crew's clock-ins laid in, composed right after `withDailyLogs` wherever the logs
 * are laid over the board, so the log window and the chart read one count. Clock-ins win only on a day that
 * has a log and a count: a day with no count keeps its typed one, and clock-ins make no log of their own.
 */
export function withCrewClockIns(state: GcState, rows: readonly CrewOnSiteRow[]): GcState {
  if (rows.length === 0) return state
  return {
    ...state,
    projects: state.projects.map((project) => {
      const logs = project.dailyLogs
      if (!logs || logs.length === 0) return project
      const laid = logs.map((log) => logWithClockIns(log, project, rows))
      return laid.some((log, i) => log !== logs[i]) ? { ...project, dailyLogs: laid } : project
    }),
  }
}

/** The crews a save sends: our crew's row is left off on a day that has a count, so the count is read and never stored. */
export function crewsToSave(crews: DailyLog['crews'], rows: readonly CrewOnSiteRow[], date: string): DailyLog['crews'] {
  return crews.filter((c) => crewOnSiteOn(rows, c.packageId, date) === null)
}

/** The days `gc_crew_on_site` counts in one call. */
export const CREW_COUNT_PAGE_DAYS = 92

/** The pages of days from one day to another, oldest first, at most `CREW_COUNT_PAGE_DAYS` each. Empty when `to` is before `from`. */
export function crewCountPages(from: string, to: string): { from: string; to: string }[] {
  const pages: { from: string; to: string }[] = []
  for (let start = from; start <= to; start = addDays(start, CREW_COUNT_PAGE_DAYS)) {
    const end = addDays(start, CREW_COUNT_PAGE_DAYS - 1)
    pages.push({ from: start, to: end < to ? end : to })
  }
  return pages
}

/** Our crew's clock-ins as the log window reads them: the counts, and each linked trade's Pipeline job (its number, or null when unknown). */
export interface OurCrewOnLog {
  rows: CrewOnSiteRow[]
  /** A trade our own crew does, by its id, to its job's number. A trade not here is not linked yet. */
  jobs: Record<string, string | null>
}

/** Where our crew's count on the log comes from, in one note under the crews. */
export function ourCrewNote(packageId: string, ourCrew: OurCrewOnLog, date: string): string {
  if (!(packageId in ourCrew.jobs)) return 'Our crew’s count is typed here until Draws names its Pipeline job.'
  const label = ourCrew.jobs[packageId]
  const job = label ? `Pipeline job ${label}` : 'its Pipeline job'
  return crewOnSiteOn(ourCrew.rows, packageId, date) !== null
    ? `Our crew’s count is who clocked in on ${job} that day. It changes only in the Pipeline.`
    : `Nobody clocked in on ${job} that day. Type the count if they were here.`
}
