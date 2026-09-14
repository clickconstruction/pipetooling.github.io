/**
 * Crews on the day (v2.3399): the optional layer on the Pipeline map. The
 * clock sessions of one day — today, or the As-of day — say which pinned jobs
 * had someone on site; those pins wear a violet ring and the rail says how
 * many people were out on how many jobs. Off unless this device turned it on.
 * Pure: session rows in, the per-job crew and the line out.
 */
import type { JobsMapPin } from './jobsMap'

/** The ring a pin wears when a crew clocked in there that day — violet, apart from every section color and the Collections red. */
export const JOBS_MAP_CREW_RING_COLOR = '#8b5cf6'

export type JobsMapCrewSessionRow = { user_id: string | null; job_ledger_id: string | null }

export type JobsMapCrewDay = {
  ymd: string
  /** job id → distinct people who clocked in there that day. */
  peopleByJob: ReadonlyMap<string, ReadonlySet<string>>
  /** Distinct people with a session on any job that day. */
  peopleCount: number
}

/** Fold a day's sessions into people per job (a person on two jobs counts once in `peopleCount`). */
export function summarizeCrewSessions(ymd: string, rows: readonly JobsMapCrewSessionRow[]): JobsMapCrewDay {
  const peopleByJob = new Map<string, Set<string>>()
  const people = new Set<string>()
  for (const r of rows) {
    if (!r.job_ledger_id || !r.user_id) continue
    ;(peopleByJob.get(r.job_ledger_id) ?? peopleByJob.set(r.job_ledger_id, new Set()).get(r.job_ledger_id)!).add(r.user_id)
    people.add(r.user_id)
  }
  return { ymd, peopleByJob, peopleCount: people.size }
}

/** People on this pin's job that day; 0 when none. */
export function crewOnPin(day: JobsMapCrewDay | null, pin: Pick<JobsMapPin, 'id'>): number {
  return day?.peopleByJob.get(pin.id)?.size ?? 0
}

/** `Crews on Mon Jun 15: 5 people on 4 jobs` · `Crews today: nobody clocked in` — over the jobs the map is showing. */
export function jobsMapCrewLine(day: JobsMapCrewDay | null, pins: readonly Pick<JobsMapPin, 'id'>[], dayLabel: string): string | null {
  if (!day) return null
  const jobs = pins.filter((p) => crewOnPin(day, p) > 0).length
  const people = new Set<string>()
  for (const p of pins) for (const u of day.peopleByJob.get(p.id) ?? []) people.add(u)
  if (people.size === 0) return `Crews ${dayLabel}: nobody clocked in on these jobs`
  return `Crews ${dayLabel}: ${people.size} ${people.size === 1 ? 'person' : 'people'} on ${jobs} ${jobs === 1 ? 'job' : 'jobs'}`
}

/** The popup line: `2 people clocked in here that day` · `1 person clocked in here today`. */
export function crewPopupLine(count: number, today: boolean): string | null {
  if (count <= 0) return null
  return `${count} ${count === 1 ? 'person' : 'people'} clocked in here ${today ? 'today' : 'that day'}`
}

const CREWS_KEY = 'pipetooling_jobs_map_crews'

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** The layer is off unless this device turned it on. */
export function readJobsMapCrewsOn(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(CREWS_KEY) === '1'
  } catch {
    return false
  }
}

export function writeJobsMapCrewsOn(on: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return
    if (on) storage.setItem(CREWS_KEY, '1')
    else storage.removeItem(CREWS_KEY)
  } catch {
    /* private mode / quota — the toggle just doesn't persist */
  }
}
