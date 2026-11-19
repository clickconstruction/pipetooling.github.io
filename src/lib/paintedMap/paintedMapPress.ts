/**
 * Paint a map from the Dashboard (punch list #392, steps 1 and 2): which job the press lands on, and
 * the words that say so. Pure. The reads are `paintedMapPressIo.ts`, and the press is
 * `components/paintedMap/PaintAMapPress.tsx` on the Dashboard's top row.
 *
 * The owner's two rules: the press is always there, clocked in or not, and every map is tied to a
 * job with the job easy to pick. So the press lands on a job with no question when the app knows
 * it: the job the person is clocked onto, else the stop that is under way or next on today's
 * schedule. When it knows neither, the start sheet opens on the person's last job, or asks
 * (`pickerGuess` in `paintedMapJobPicker.ts`).
 *
 * A clock on the office, on a bid or on a billing-only job is not a job to paint a map for: the
 * person is at a desk, or the job is a line on a bill with no site of its own. The company's office
 * job (People → Overhead) is the same: it is on the office's schedule every day, and the press
 * never lands on it.
 */
import type { PaintedMapHome } from './paintedMapDoor'

/** A job as the press reads it. */
export type PaintPressJob = {
  id: string
  /** The job's number as the app shows it, such as `J2417`. */
  number: string | null
  name: string | null
  address: string | null
  /** A job that is only a line on a bill. Never landed on. */
  billingOnly?: boolean | null
  /** The company's office job, where the office clocks its day. Never landed on, and no list offers it. */
  office?: boolean | null
}

/** The person's open clock: the job it is on, or none for the office or a bid. `null` is not clocked in. */
export type PaintPressClock = { job: PaintPressJob | null } | null

/** One stop on today's schedule, its times as the table keeps them (`07:30:00`). */
export type PaintPressStop = { job: PaintPressJob; timeStart: string; timeEnd: string }

export type PaintPressLanding =
  /** The app knows the job: the start sheet opens on it. */
  | { kind: 'job'; job: PaintPressJob; why: 'clocked' | 'schedule' }
  /** It does not: the person picks. */
  | { kind: 'pick' }

/** `07:30:00` as minutes since midnight. A time that is not one sorts last. */
function minutesOf(pgTime: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(pgTime ?? '')
  if (!m) return Number.POSITIVE_INFINITY
  return Number(m[1]) * 60 + Number(m[2])
}

const paintable = (job: PaintPressJob | null | undefined): job is PaintPressJob => !!job && !!job.id && !job.billingOnly && !job.office

/**
 * The job the press lands on.
 *
 * - Clocked onto a job: that job, whatever the schedule says. The person is standing on it.
 * - Otherwise the first of today's stops that has not ended, in order of start. A stop under way
 *   counts: its end is still ahead.
 * - Every stop over: the last one. A map painted at the end of the day is most often for the
 *   site just left.
 * - No stop: the person picks.
 *
 * `nowMinutes` is minutes since midnight on the company's calendar.
 */
export function paintPressLanding(input: { clock: PaintPressClock; todayStops: ReadonlyArray<PaintPressStop>; nowMinutes: number }): PaintPressLanding {
  const clocked = input.clock?.job
  if (paintable(clocked)) return { kind: 'job', job: clocked, why: 'clocked' }
  const stops = input.todayStops
    .filter((s) => paintable(s.job))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => minutesOf(a.s.timeStart) - minutesOf(b.s.timeStart) || minutesOf(a.s.timeEnd) - minutesOf(b.s.timeEnd) || a.i - b.i)
    .map((x) => x.s)
  if (stops.length === 0) return { kind: 'pick' }
  const ahead = stops.find((s) => minutesOf(s.timeEnd) > input.nowMinutes)
  const stop = ahead ?? stops[stops.length - 1]!
  return { kind: 'job', job: stop.job, why: 'schedule' }
}

/** `J2417 · Cedar Hollow 12`, the way the start sheet names a job. `null` for a job with neither. */
export function paintPressJobLabel(job: Pick<PaintPressJob, 'number' | 'name'>): string | null {
  const words = [job.number?.trim(), job.name?.trim()].filter(Boolean).join(' · ')
  return words || null
}

export const PAINT_PRESS_WORDS = {
  press: 'Paint a map',
  /** The second line when the day names no job: the sheet opens on the person's last job, or asks. */
  pick: 'On your last job, or one you pick',
  /** The second line while the day is being read. It says nothing that could turn out wrong. */
  reading: 'The way in, drawn or walked',
  /** The press's name for a screen reader, with where the map will land. */
  aria: (line: string | null) => (line ? `Paint a map. ${line}` : 'Paint a map'),
} as const

/** The second line under the press: `On J2417 · Cedar Hollow 12`, or that the person picks. */
export function paintPressLine(landing: PaintPressLanding): string {
  if (landing.kind === 'pick') return PAINT_PRESS_WORDS.pick
  const label = paintPressJobLabel(landing.job)
  return label ? `On ${label}` : 'On the job you are on'
}

/**
 * What the start sheet opens on. A landed job can still be changed there, since the app's pick is a
 * guess once the person is not clocked onto it. With no job the sheet opens as the header's search
 * opens it, with **Pick the job it is for**.
 */
export function paintPressHome(landing: PaintPressLanding): PaintedMapHome {
  if (landing.kind === 'pick') return { jobId: null, developmentId: null, label: '', developmentLabel: '', address: null, center: null }
  return { jobId: landing.job.id, developmentId: null, label: paintPressJobLabel(landing.job) ?? 'This job', developmentLabel: '', address: landing.job.address?.trim() || null, center: null, canChangeJob: true }
}

/** The three shapes the press takes on the Dashboard's top row. */
export type PaintPressShape =
  /** Job Mode: wide, beside the Tally square, with the second line. */
  | 'wide'
  /** The office's phone: a quiet link beside Job report and Tally. */
  | 'link'
  /** A desk, and a leader's phone: a square after Job Report. */
  | 'square'

/** Which shape a row draws, from the two facts the row already has. */
export function paintPressShape(row: { hasClockSlot: boolean; quietSquares: boolean }): PaintPressShape {
  if (!row.hasClockSlot) return 'wide'
  return row.quietSquares ? 'link' : 'square'
}
