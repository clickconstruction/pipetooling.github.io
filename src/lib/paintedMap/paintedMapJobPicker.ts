/**
 * Which job is it for? (punch list #392, step 4): the list a painter picks a job from when the app
 * does not know it. Pure. The reads are `paintedMapJobPickerIo.ts`, the sheet is
 * `components/paintedMap/PaintAMapJobPicker.tsx`.
 *
 * The owner's rule: every map is tied to a job, and picking the job is easy. So the picker leads
 * with the jobs the person is most likely standing on: today's stops, then the jobs they were
 * clocked onto lately. A search of every job comes after.
 *
 * A person may paint a map for a job they can open or are on the team of (`on_site_can_touch_job`).
 * The app's job search finds more than that, so a search hit a person may not paint on is listed
 * and says why, and cannot be pressed.
 */
import type { PaintedMapHome } from './paintedMapDoor'
import { paintPressJobLabel, type PaintPressJob, type PaintPressStop } from './paintedMapPress'

/** A job in the picker: the press's job, with the development it is a lot of. */
export type PickerJob = PaintPressJob & { developmentId?: string | null }

/** A job the person was clocked onto, and the last day they were (`2026-11-17`). */
export type PickerLately = { job: PickerJob; lastOn: string }

export type PickerRow = {
  job: PickerJob
  /** `J2417 · Cedar Hollow 12`. */
  label: string
  /** The address, under the label. */
  sub: string | null
  /** At the row's right: `9:30 AM`, `yesterday`, `Friday`, `Nov 12`, or `about 300 ft`. */
  tag: string | null
  /** Whether the person may paint a map for it. A row that is not cannot be pressed. */
  paintable: boolean
}

export type PickerSections = { today: PickerRow[]; lately: PickerRow[] }

/** How many jobs the Lately list holds. Past this a person searches. */
export const PICKER_LATELY_MAX = 6

export const PICKER_WORDS = {
  head: 'Which job is it for?',
  lead: 'Every painted map is on a job. Press the job and the map opens.',
  today: 'Today',
  lately: 'Lately',
  near: 'Near you',
  search: 'Or search every job',
  searchPlaceholder: 'Search by number, name or address',
  searching: 'Searching…',
  /** Under a job the person may not paint on. */
  notYours: 'You are not on this job, so you cannot paint a map for it.',
  /** No stop today and no clock lately: the search is the way. */
  none: 'No job on your schedule today, and none you clocked onto lately. Search for the job.',
  reading: 'Reading your jobs…',
  /** The lists could not be read. The search may still work, and the map can still be painted. */
  failed: 'Your jobs could not be read. There may be no signal here.',
  /** The one way onto no job that is left: a person with no signal must still be able to paint. */
  later: 'Paint now and pick the job later',
  laterNote: 'The map stays yours and the office’s until it is put on a job.',
  changeHead: 'Change the job',
  changeLead: 'Press the job the map is for.',
  moveHead: 'Move it to another job',
  moveLead: 'Press the job this map belongs on.',
} as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** A calendar day as a count of days, so two days can be told apart with no clock or time zone. */
function dayNumber(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '')
  if (!m) return null
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}

/** `today`, `yesterday`, `Friday` inside a week, then `Nov 12`. Empty for a day that is not one or is ahead. */
export function pickerLatelyWords(lastOn: string, todayYmd: string): string {
  const then = dayNumber(lastOn)
  const now = dayNumber(todayYmd)
  if (then == null || now == null || then > now) return ''
  const ago = now - then
  if (ago === 0) return 'today'
  if (ago === 1) return 'yesterday'
  const at = new Date(then * 86_400_000)
  if (ago < 7) return WEEKDAYS[at.getUTCDay()]!
  return `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`
}

/** `07:30:00` as `7:30 AM`. Empty for a time that is not one. */
export function pickerStopWords(pgTime: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(pgTime ?? '')
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

const rowOf = (job: PickerJob, tag: string | null, paintable: boolean): PickerRow => ({ job, label: paintPressJobLabel(job) ?? 'A job', sub: job.address?.trim() || null, tag: tag || null, paintable })

/**
 * The picker's two lists. Today's stops in order of start, each job once. Then the jobs clocked onto
 * lately, newest first, without the ones already under Today, held to `PICKER_LATELY_MAX`. A
 * billing-only job is in neither: it has no site. A job the person may not paint on is left out of
 * both, since these lists are offers and an offer that cannot be taken is noise.
 */
export function pickerSections(input: { todayStops: ReadonlyArray<PaintPressStop>; lately: ReadonlyArray<PickerLately>; todayYmd: string; paintable: ReadonlySet<string> }): PickerSections {
  const ok = (job: PickerJob) => !!job.id && !job.billingOnly && input.paintable.has(job.id)
  const seen = new Set<string>()
  const today: PickerRow[] = []
  const stops = [...input.todayStops].map((s, i) => ({ s, i })).sort((a, b) => (a.s.timeStart < b.s.timeStart ? -1 : a.s.timeStart > b.s.timeStart ? 1 : a.i - b.i))
  for (const { s } of stops) {
    if (!ok(s.job) || seen.has(s.job.id)) continue
    seen.add(s.job.id)
    today.push(rowOf(s.job, pickerStopWords(s.timeStart), true))
  }
  const lately: PickerRow[] = []
  const byDay = [...input.lately].sort((a, b) => (a.lastOn < b.lastOn ? 1 : a.lastOn > b.lastOn ? -1 : 0))
  for (const l of byDay) {
    if (lately.length >= PICKER_LATELY_MAX) break
    if (!ok(l.job) || seen.has(l.job.id)) continue
    seen.add(l.job.id)
    lately.push(rowOf(l.job, pickerLatelyWords(l.lastOn, input.todayYmd), true))
  }
  return { today, lately }
}

/** A search's hits as rows: every hit listed, the ones the person may not paint on marked. Billing-only jobs are left out. */
export function pickerSearchRows(hits: ReadonlyArray<PickerJob>, paintable: ReadonlySet<string>): PickerRow[] {
  return hits.filter((j) => !!j.id && !j.billingOnly).map((j) => rowOf(j, null, paintable.has(j.id)))
}

/** The ids a person may paint on: the jobs they can read under their own access, and the jobs whose team they are on. */
export function pickerPaintable(visibleIds: Iterable<string>, teamIds: Iterable<string>): Set<string> {
  return new Set([...visibleIds, ...teamIds])
}

/** What the start sheet opens on once a job is pressed. The job stays changeable: a press can be a slip. */
export function pickerHome(job: PickerJob): PaintedMapHome {
  return { jobId: job.id, developmentId: job.developmentId ?? null, label: paintPressJobLabel(job) ?? 'This job', developmentLabel: '', address: job.address?.trim() || null, center: null, canChangeJob: true }
}
