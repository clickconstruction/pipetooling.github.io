/**
 * Job Mode's top row, the day's row (the owner's pick, 2026-11-20). Pure. The reads are `topRowIo.ts` and the
 * row is `components/jobMode/JobModeTopRow.tsx`, drawn by `DashboardPinnedQuickRow` in the Job Mode return.
 *
 * The row is equal named squares. The two on the left belong to the job the day points at and change with the
 * day. The two on the right are the person's own and never move: Paint a map, then My spend.
 *
 * - A stop still owed, or on the way to one: Directions, Job details.
 * - Clocked onto a job and there: Photo, Job details, and On site when the job's site holds boxes.
 * - No job left today: This week's hours, Tomorrow.
 *
 * Job details keeps its place while there is a job, so only the first square swaps. The press record showed
 * the job's window as the door a field person opens most, a scroll down the card, and the two things the old
 * row held as the two opened least.
 */
import { directionsUrlForAddress } from '../directionsUrl'
import { paintPressJobLabel, paintable, type PaintPressJob, type PaintPressStop } from '../paintedMap/paintedMapPress'
import type { Leg } from './onMyWay'

/** The open clock: the job it is on (none for the office or a bid) and where the session is. `null` is not clocked in. */
export type TopRowClock = { job: PaintPressJob | null; leg: Leg } | null

/** The day as the row reads it. `visitedJobIds` are the jobs with a closed clock session today, the card's green checks. */
export type TopRowDay = { clock: TopRowClock; todayStops: ReadonlyArray<PaintPressStop>; visitedJobIds: ReadonlyArray<string> }

/** A day with nothing known: no job, so the row draws the person's own squares. */
export const TOP_ROW_NO_DAY: TopRowDay = { clock: null, todayStops: [], visitedJobIds: [] }

export type TopRowJobState =
  /** A stop on today's schedule not yet visited, and the person is not on a job. */
  | { kind: 'ahead'; job: PaintPressJob }
  /** Clocked onto the job, the drive begun, no arrival yet. */
  | { kind: 'on-the-way'; job: PaintPressJob }
  /** Clocked onto the job and there. A session with no stamps counts: a hand punch is made on site. */
  | { kind: 'on-site'; job: PaintPressJob }
  /** Nothing left today, or nothing scheduled. */
  | { kind: 'none' }

/** `07:30:00` as minutes since midnight. A time that is not one sorts last. */
function minutesOf(pgTime: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(pgTime ?? '')
  if (!m) return Number.POSITIVE_INFINITY
  return Number(m[1]) * 60 + Number(m[2])
}

/**
 * The job the row's left pair is for.
 *
 * - Clocked onto a job with a site of its own: that job, on the way or there.
 * - Otherwise the first of today's stops, in order of start, with no closed session today. A stop whose hour
 *   has passed still counts: it is owed a visit until somebody clocks onto it, as the card's amber flag says.
 * - Otherwise none. The office's job and a billing-only job are never the row's job.
 */
export function topRowJobState(day: TopRowDay): TopRowJobState {
  const clocked = day.clock?.job
  if (paintable(clocked)) return { kind: day.clock?.leg === 'on-the-way' ? 'on-the-way' : 'on-site', job: clocked }
  const visited = new Set(day.visitedJobIds)
  const owed = day.todayStops
    .filter((s) => paintable(s.job) && !visited.has(s.job.id))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => minutesOf(a.s.timeStart) - minutesOf(b.s.timeStart) || a.i - b.i)
  const first = owed[0]
  return first ? { kind: 'ahead', job: first.s.job } : { kind: 'none' }
}

export type TopRowSquareId = 'directions' | 'job-details' | 'photo' | 'on-site' | 'hours' | 'tomorrow' | 'paint' | 'spend'

/** The two that never move, in their order at the right end of the row. */
export const TOP_ROW_OWN: ReadonlyArray<TopRowSquareId> = ['paint', 'spend']

/**
 * The row's squares in order. `siteBoxes` is the live box count of the job's site, or null when not read: the
 * On site square draws only on a site that holds boxes, since all but one working job hold none. Directions
 * needs an address to route to, so a job with none draws without it.
 */
export function topRowSquares(state: TopRowJobState, siteBoxes: number | null = null): TopRowSquareId[] {
  if (state.kind === 'none') return ['hours', 'tomorrow', ...TOP_ROW_OWN]
  if (state.kind === 'on-site') return ['photo', 'job-details', ...(siteBoxes != null && siteBoxes > 0 ? (['on-site'] as const) : []), ...TOP_ROW_OWN]
  return [...(directionsUrlForAddress(state.job.address) ? (['directions'] as const) : []), 'job-details', ...TOP_ROW_OWN]
}

/** The squares' names, one or two short words each, as a first-timer would say them. */
export const TOP_ROW_WORDS = {
  directions: 'Directions',
  jobDetails: 'Job details',
  photo: 'Photo',
  onSite: 'On site',
  hours: 'This week',
  /** The hours square before the week is read, or when the read failed. */
  hoursUnread: 'My hours',
  tomorrow: 'Tomorrow',
  /** The tomorrow square before the schedule is read, or when the read failed. */
  tomorrowUnread: 'Schedule',
  spend: 'My spend',
} as const

/** `28.9 h`: the week's hours to one decimal, a whole number without it. `null` when not read. */
export function topRowHoursValue(workedHours: number | null | undefined): string | null {
  if (typeof workedHours !== 'number' || !Number.isFinite(workedHours) || workedHours < 0) return null
  const tenth = Math.round(workedHours * 10) / 10
  return `${Number.isInteger(tenth) ? tenth.toFixed(0) : tenth.toFixed(1)} h`
}

/** `2 jobs`, `1 job`, `No jobs`: tomorrow's stops as a count. `null` when not read. */
export function topRowTomorrowValue(stops: number | null | undefined): string | null {
  if (typeof stops !== 'number' || !Number.isFinite(stops) || stops < 0) return null
  if (stops === 0) return 'No jobs'
  return `${stops} job${stops === 1 ? '' : 's'}`
}

/** A count on a square's corner: the number, `99+` past that, nothing for none. */
export function topRowBadge(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null
  return count > 99 ? '99+' : String(Math.floor(count))
}

/** The job as a screen reader hears it after a square's name: `J2417 · Cedar Hollow 12`, or the job you are on. */
function jobWords(job: PaintPressJob): string {
  return paintPressJobLabel(job) ?? 'this job'
}

/** Each square's name for a screen reader: its visible words first, then what it opens. */
export const TOP_ROW_ARIA = {
  directions: (job: PaintPressJob) => `${TOP_ROW_WORDS.directions} to ${jobWords(job)}`,
  jobDetails: (job: PaintPressJob) => `${TOP_ROW_WORDS.jobDetails}, ${jobWords(job)}`,
  photo: (job: PaintPressJob) => `${TOP_ROW_WORDS.photo}: add one to ${jobWords(job)}`,
  onSite: (boxes: number) => `${TOP_ROW_WORDS.onSite}: ${boxes} box${boxes === 1 ? '' : 'es'} of materials on this site`,
  hours: (value: string | null) => (value ? `${TOP_ROW_WORDS.hours}: ${value} so far. Open your hours` : `${TOP_ROW_WORDS.hoursUnread}: open your hours`),
  tomorrow: (value: string | null) => (value ? `${TOP_ROW_WORDS.tomorrow}: ${value.toLowerCase()}. Open the schedule` : `${TOP_ROW_WORDS.tomorrowUnread}: open the schedule`),
  spend: (count: number | null) => (typeof count === 'number' && count > 0 ? `${TOP_ROW_WORDS.spend}: ${count} charge${count === 1 ? '' : 's'} to put on a job` : `${TOP_ROW_WORDS.spend}: your card charges`),
} as const

/** `ui_nav_clicks.control` for a press on one of the row's squares; the target is `#<square>`. */
export const TOP_ROW_CONTROL = 'job-mode-row'

/** Pure: the `target` of a press on a square. */
export function topRowTarget(square: TopRowSquareId): string {
  return `#${square}`
}

/** Where the On site square opens: the Tally's On site tab on the job. */
export function topRowOnSitePath(jobId: string): string {
  return `/tally?tab=on-site&job=${encodeURIComponent(jobId)}`
}
