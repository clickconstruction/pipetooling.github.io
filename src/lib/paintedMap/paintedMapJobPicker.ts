/**
 * Which job is it for? (punch list #392, step 4): the list a painter picks a job from when the app
 * does not know it. Pure. The reads are `paintedMapJobPickerIo.ts`, the sheet is
 * `components/paintedMap/PaintAMapJobPicker.tsx`.
 *
 * The owner's rule: every map is tied to a job, and picking the job is easy. So the picker leads
 * with the jobs the person is most likely standing on: today's stops, then **Coming up**, then
 * **Your last jobs**.
 *
 * Coming up is the jobs on the person's schedule in the next two weeks, soonest first, up to four
 * (the owner's word of 2026-11-19). A way-in map is most use the day before the crew arrives.
 *
 * Your last jobs never runs short while the person has been on six (the owner's word of
 * 2026-11-19, after he opened the picker on an empty list). It is read four ways, each a sign the
 * person was on the job: they clocked onto it, it was on their schedule on a past day, they
 * changed it in the app, or they are on its team. Each sign has a day, the team's being the day
 * they joined it, and the list runs newest first by a job's newest sign. So a job the office put
 * the person on last week is above one they clocked onto in spring. A row is named by its best
 * sign: a clock says its day, a scheduled day says *scheduled* over it, a day they changed the job
 * says *changed* over it, and a job known by its team alone says *on the team*. A row that is not
 * a clock says how the app knows, since a job on a schedule does not prove the person went. The
 * changed jobs are the office's truest list: a person who takes payments all day is on few teams.
 *
 * The company's office job (People → Overhead) is where the office clocks its day. It is on the
 * office's schedule every day and is no job to paint a way in for, so no list offers it. The
 * search still finds it.
 *
 * When the app is told no job, the start sheet opens with no question on the next job on the
 * person's schedule inside a week, else on the last job they were at in the last two weeks
 * (`pickerGuess`), and **Change the job** opens this picker. The next job leads on the owner's
 * word of 2026-11-19 (call 16): a way in is most use the day before the crew arrives.
 *
 * A person may paint a map for a job they can open or are on the team of (`on_site_can_touch_job`).
 * The app's job search finds more than that, so a search hit a person may not paint on is listed
 * and says why, and cannot be pressed.
 */
import { normalizeAddressForGeocodeKey } from '../map/normalizeAddressForGeocode'
import { haversineMeters } from '../jobTravelEstimate'
import { aboutLengthWords } from './paintedMap'
import type { PaintedMapHome } from './paintedMapDoor'
import { paintPressJobLabel, type PaintPressJob, type PaintPressStop } from './paintedMapPress'

/** A job in the picker: the press's job, with the development it is a lot of. */
export type PickerJob = PaintPressJob & { developmentId?: string | null }

/** How the app knows a person was on a job: they clocked onto it, it was on their schedule on a past day, they changed it in the app, or they are on its team. */
export type PickerLastHow = 'clock' | 'schedule' | 'changed' | 'team'

/** The newest day a person was at a job, by a clock or the schedule. The start sheet's guess is made from these alone. */
export type PickerThere = { how: 'clock' | 'schedule'; day: string }

/**
 * One sign a person was on a job, and its day (`2026-11-17`). The team's day is the day they joined,
 * when it is known. Out of `pickerLastOrder` a mark is a job's name, and `there` is its newest
 * clock or scheduled day, which the name may not be.
 */
export type PickerMark = { jobId: string; how: PickerLastHow; day: string | null; there?: PickerThere | null }

/** A job the person was on, named by its best sign: how the app knows, and that sign's day. A list of these is in the order `pickerLastOrder` gave. */
export type PickerLast = { job: PickerJob; how: PickerLastHow; day: string | null; there?: PickerThere | null }

/** A job on the person's schedule on a day ahead, and when its first stop that day starts (`07:30:00`). */
export type PickerSoon = { job: PickerJob; day: string; timeStart?: string | null }

export type PickerRow = {
  job: PickerJob
  /** `J2417 · Cedar Hollow 12`. */
  label: string
  /** The address, under the label. */
  sub: string | null
  /** At the row's right: `9:30 AM`, `tomorrow`, `yesterday`, `Friday`, `Nov 12`, `on the team`, or `about 300 ft`. */
  tag: string | null
  /** Over the tag, when the day is not a clock's: `scheduled` or `changed`. */
  how?: string | null
  /** Under Your last jobs: how the app knows, and the day. */
  last?: { how: PickerLastHow; day: string | null }
  /** Under Coming up: the day it is on the schedule. */
  next?: { day: string }
  /** Whether the person may paint a map for it. A row that is not cannot be pressed. */
  paintable: boolean
}

export type PickerSections = {
  today: PickerRow[]
  /** Coming up: the jobs on the schedule in the days ahead, soonest first. */
  soon: PickerRow[]
  last: PickerRow[]
  /** The job the start sheet opens on with no question (`pickerGuess`), or none. */
  guess: PickerRow | null
}

/** How many jobs Your last jobs holds. Past this a person searches. */
export const PICKER_LAST_MAX = 6
/** How many of a person's last jobs are read whole. Some may fail the paint rule, so more are read than are listed. */
export const PICKER_LAST_READ = 24
/** How many days back the start sheet's guess looks. An older day is asked about, not opened on. */
export const PICKER_GUESS_DAYS = 14
/** How many days ahead it looks for the next job: inside a week, where a day is said as *tomorrow* or a weekday. */
export const PICKER_NEXT_DAYS = 7
/** How many jobs Coming up holds. */
export const PICKER_SOON_MAX = 4
/** How many days ahead Coming up looks. Past two weeks a schedule is a plan, not a day. */
export const PICKER_SOON_DAYS = 14

export const PICKER_WORDS = {
  head: 'Which job is it for?',
  lead: 'Every painted map is on a job. Press the job and the map opens.',
  today: 'Today',
  soon: 'Coming up',
  last: 'Your last jobs',
  near: 'Near you',
  /** The search box's name, and what a phone's box says when empty. */
  search: 'Search every job',
  /** What a desk's box says when empty: there is room for the three things it reads. */
  searchPlaceholder: 'Search every job by number, name or address',
  /** Over what a search found. */
  found: 'Every job',
  searching: 'Searching…',
  /** Over a day that is a scheduled day and not a clock's. */
  scheduled: 'scheduled',
  /** Over a day the person changed the job in the app. */
  changed: 'changed',
  /** At the right of a job the person is on the team of, with no day to say. */
  team: 'on the team',
  /** Under a job the person may not paint on. */
  notYours: 'You are not on this job, so you cannot paint a map for it.',
  /** Nobody has put the person on a job yet: the search is the way. */
  none: 'You have not been on a job yet. Search for the job above.',
  /** The same, on a device that gives a location. */
  noneNear: 'You have not been on a job yet. Search for the job, or press Near me.',
  reading: 'Reading your jobs…',
  /** The lists could not be read. The search may still work, and the map can still be painted. */
  failed: 'Your jobs could not be read. There may be no signal here.',
  /** The one way onto no job that is left: a person with no signal must still be able to paint. */
  later: 'Paint now and pick the job later',
  laterNote: 'The map stays yours and the office’s until it is put on a job.',
  /** Find the jobs near me (step 5): the press, what the phone will ask, and what the list can and cannot hold. */
  nearPress: 'Near me',
  nearNote: 'Near me asks where you are once, for this list.',
  nearFinding: 'Finding you…',
  nearOnly: 'Only jobs with an address the app has placed on the map are listed. Search finds the rest.',
  nearNone: 'No job the app has placed on the map is near you. Search for the job.',
  nearFailed: 'The jobs near you could not be read.',
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

/** `today`, `yesterday`, `Friday` inside a week, then `Nov 12`, and `Nov 12, 2025` in another year. Empty for a day that is not one or is ahead. */
export function pickerDayWords(day: string, todayYmd: string): string {
  const then = dayNumber(day)
  const now = dayNumber(todayYmd)
  if (then == null || now == null || then > now) return ''
  const ago = now - then
  if (ago === 0) return 'today'
  if (ago === 1) return 'yesterday'
  const at = new Date(then * 86_400_000)
  if (ago < 7) return WEEKDAYS[at.getUTCDay()]!
  const words = `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`
  return at.getUTCFullYear() === new Date(now * 86_400_000).getUTCFullYear() ? words : `${words}, ${at.getUTCFullYear()}`
}

/** A calendar day some days on: `2026-11-19` and 14 give `2026-12-03`. Empty for a day that is not one. */
export function pickerDayPlus(ymd: string, days: number): string {
  const n = dayNumber(ymd)
  return n == null ? '' : new Date((n + days) * 86_400_000).toISOString().slice(0, 10)
}

/** A day ahead: `tomorrow`, `Friday` inside a week, then `Nov 24`, and `Jan 4, 2027` in another year. Empty for a day that is not one or is not ahead. */
export function pickerSoonWords(day: string, todayYmd: string): string {
  const then = dayNumber(day)
  const now = dayNumber(todayYmd)
  if (then == null || now == null || then <= now) return ''
  const ahead = then - now
  if (ahead === 1) return 'tomorrow'
  const at = new Date(then * 86_400_000)
  if (ahead < 7) return WEEKDAYS[at.getUTCDay()]!
  const words = `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`
  return at.getUTCFullYear() === new Date(now * 86_400_000).getUTCFullYear() ? words : `${words}, ${at.getUTCFullYear()}`
}

/** `07:30:00` as `7:30 AM`. Empty for a time that is not one. */
export function pickerStopWords(pgTime: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(pgTime ?? '')
  if (!m) return ''
  const h = Number(m[1])
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** A job a list may offer: not a line on a bill, and not the company's office job. */
const offered = (job: PickerJob | null | undefined): job is PickerJob => !!job && !!job.id && !job.billingOnly && !job.office

const rowOf = (job: PickerJob, tag: string | null, paintable: boolean): PickerRow => ({ job, label: paintPressJobLabel(job) ?? 'A job', sub: job.address?.trim() || null, tag: tag || null, paintable })

const HOW_RANK: Record<PickerLastHow, number> = { clock: 0, schedule: 1, changed: 2, team: 3 }

/**
 * Each job once, in the order Your last jobs lists them.
 *
 * - **Placed by its newest sign.** A clock, a scheduled day, a day the person changed the job and
 *   the day they joined the team each count, so a job the office put them on last week is above
 *   one they clocked onto in spring. A job with no day at all comes last, in the order read.
 * - **Named by its best sign.** A clock, a scheduled day or a changed day beats the team. Of two
 *   such days the later wins, and on one day a clock beats the schedule, which beats a change. A
 *   job known by its team alone is named by the team, and keeps the day they joined for its place.
 * - **`there`** is the job's newest clock or scheduled day, kept beside the name. A job changed
 *   yesterday and clocked onto on Saturday is named by the change, and the start sheet's guess
 *   still needs the Saturday.
 *
 * A clock, a scheduled day or a changed day that is not a day is no sign at all.
 */
export function pickerLastOrder(marks: ReadonlyArray<PickerMark>): PickerMark[] {
  type Held = { jobId: string; how: PickerLastHow; day: string | null; at: number | null; newest: number | null; there: PickerThere | null; i: number }
  const held = new Map<string, Held>()
  marks.forEach((m, i) => {
    if (!m?.jobId) return
    const at = dayNumber(m.day ?? '')
    if (m.how !== 'team' && at == null) return
    const day = at == null ? null : m.day
    const there: PickerThere | null = (m.how === 'clock' || m.how === 'schedule') && day ? { how: m.how, day } : null
    const had = held.get(m.jobId)
    if (!had) {
      held.set(m.jobId, { jobId: m.jobId, how: m.how, day, at, newest: at, there, i })
      return
    }
    if (at != null && (had.newest == null || at > had.newest)) had.newest = at
    if (there && (!had.there || there.day > had.there.day || (there.day === had.there.day && HOW_RANK[there.how] < HOW_RANK[had.there.how]))) had.there = there
    // The name: a dated clock, schedule or change over the team, the later day, the stronger sign on one day.
    const dated = m.how !== 'team'
    const hadDated = had.how !== 'team'
    const wins = dated && (!hadDated || at! > had.at! || (at === had.at && HOW_RANK[m.how] < HOW_RANK[had.how]))
    if (wins) {
      had.how = m.how
      had.day = day
      had.at = at
    } else if (!dated && !hadDated && had.at == null && at != null) {
      // Two team rows for one job: the one with a day.
      had.day = day
      had.at = at
    }
  })
  return [...held.values()]
    .sort((a, b) => {
      if (a.newest != null && b.newest != null) return b.newest - a.newest || HOW_RANK[a.how] - HOW_RANK[b.how] || a.i - b.i
      if (a.newest != null) return -1
      if (b.newest != null) return 1
      return a.i - b.i
    })
    .map((h) => ({ jobId: h.jobId, how: h.how, day: h.day, ...(h.there ? { there: h.there } : {}) }))
}

/** One row of a read, as its job and its day on the company's calendar. A schedule row also says when it starts. */
export type PickerSign = { jobId: string | null; day: string | null; time?: string | null }

/**
 * What the reads say, sorted into what to read whole. `order` is the person's last jobs in the
 * list's own order, held to `PICKER_LAST_READ`, with the job the start sheet may open on added
 * when newer signs pushed it out. `soon` is each job on the schedule ahead, once, at its soonest
 * day and start, soonest first. A day on the schedule ahead of today is coming up, a day behind is a last
 * job, and today is the day's own read. Today's jobs and the company's office job are in neither.
 */
export function pickerPlan(read: {
  todayYmd: string
  officeJobId: string | null
  /** The jobs on today's schedule. */
  todayJobIds: ReadonlyArray<string>
  clocks: ReadonlyArray<PickerSign>
  /** The schedule, days ahead and days behind together. */
  blocks: ReadonlyArray<PickerSign>
  /** The changes the person made in the app. */
  changes: ReadonlyArray<PickerSign>
  /** The teams, each with the day the person joined it. */
  teams: ReadonlyArray<PickerSign>
}): { order: PickerMark[]; soon: Array<{ jobId: string; day: string; time: string | null }> } {
  const skip = new Set(read.todayJobIds)
  if (read.officeJobId) skip.add(read.officeJobId)
  const marks: PickerMark[] = []
  const soonest = new Map<string, { day: string; time: string | null }>()
  /** A day and a start as one word that sorts. A stop with no start sorts last in its day. */
  const when = (w: { day: string; time: string | null }) => `${w.day} ${w.time || '99'}`
  for (const r of read.clocks) if (r?.jobId) marks.push({ jobId: r.jobId, how: 'clock', day: r.day })
  for (const r of read.blocks) {
    if (!r?.jobId || !r.day || dayNumber(r.day) == null) continue
    if (r.day < read.todayYmd) marks.push({ jobId: r.jobId, how: 'schedule', day: r.day })
    else if (r.day > read.todayYmd && !skip.has(r.jobId)) {
      const now = { day: r.day, time: r.time ?? null }
      const had = soonest.get(r.jobId)
      if (!had || when(now) < when(had)) soonest.set(r.jobId, now)
    }
  }
  for (const r of read.changes) if (r?.jobId && r.day) marks.push({ jobId: r.jobId, how: 'changed', day: r.day })
  for (const r of read.teams) if (r?.jobId) marks.push({ jobId: r.jobId, how: 'team', day: r.day })
  const all = pickerLastOrder(marks).filter((m) => !skip.has(m.jobId))
  const order = all.slice(0, PICKER_LAST_READ)
  // The job the start sheet may open on is the one with the newest clock or scheduled day. It is read even when newer signs fill the list.
  const been = all.filter((m) => !!m.there).sort((a, b) => (a.there!.day < b.there!.day ? 1 : a.there!.day > b.there!.day ? -1 : 0))[0]
  if (been && !order.includes(been)) order.push(been)
  const soon = [...soonest].map(([jobId, w]) => ({ jobId, ...w })).sort((a, b) => (when(a) < when(b) ? -1 : when(a) > when(b) ? 1 : 0))
  return { order, soon }
}

/** A job's newest clock or scheduled day: `there` when the order kept it, else its name when that is one. */
function thereOf(l: Pick<PickerLast, 'how' | 'day' | 'there'>): PickerThere | null {
  if (l.there) return l.there
  return (l.how === 'clock' || l.how === 'schedule') && l.day ? { how: l.how, day: l.day } : null
}

/** A last job as a row: a clock says its day, a scheduled or changed day says so over it, the team says it is the team. */
function lastRowOf(l: PickerLast, todayYmd: string): PickerRow {
  const day = l.how !== 'team' && l.day ? pickerDayWords(l.day, todayYmd) : ''
  const row = rowOf(l.job, l.how === 'team' ? PICKER_WORDS.team : day, true)
  const over = l.how === 'schedule' ? PICKER_WORDS.scheduled : l.how === 'changed' ? PICKER_WORDS.changed : null
  return { ...row, how: day ? over : null, last: { how: l.how, day: l.day } }
}

/** The row the start sheet opens on: the job, named by its newest clock or scheduled day. */
function guessRowOf(l: PickerLast, there: PickerThere, todayYmd: string): PickerRow {
  return lastRowOf({ job: l.job, how: there.how, day: there.day }, todayYmd)
}

/**
 * The picker's three lists, and the job the start sheet may open on. Today's stops in order of
 * start, each job once. Then Coming up: the jobs on the schedule in the next `PICKER_SOON_DAYS`
 * days, soonest first and by start inside a day, each job once, without the ones under Today,
 * held to `PICKER_SOON_MAX`.
 * Then Your last jobs, in the order they are handed in (`pickerLastOrder`), each job once,
 * without the ones already above, held to `PICKER_LAST_MAX`. A billing-only job is in none: it has
 * no site. Nor is the company's office job. A job the person may not paint on is left out of all
 * three, since these lists are offers and an offer that cannot be taken is noise. A clock, a
 * scheduled day or a change ahead of today is no last day, so its job is left out too.
 *
 * The guess is the first job under Coming up when its day is inside `PICKER_NEXT_DAYS`: the next
 * job on the schedule, and the first stop of that day. With none, it is the job with the newest
 * clock or scheduled day, wherever it sits: down the list or named by a change made since. There
 * is none when a job is on today's schedule, since the person is then asked which. There is none from a change or the team alone,
 * which say nothing of when the person was there. And there is none from a day more than
 * `PICKER_GUESS_DAYS` back: an office person's last clock may be months old, and the jobs they
 * changed today are then the better list to be asked from.
 */
export function pickerSections(input: { todayStops: ReadonlyArray<PaintPressStop>; soon?: ReadonlyArray<PickerSoon>; last: ReadonlyArray<PickerLast>; todayYmd: string; paintable: ReadonlySet<string> }): PickerSections {
  const ok = (job: PickerJob) => offered(job) && input.paintable.has(job.id)
  const seen = new Set<string>()
  const today: PickerRow[] = []
  const stops = [...input.todayStops].map((s, i) => ({ s, i })).sort((a, b) => (a.s.timeStart < b.s.timeStart ? -1 : a.s.timeStart > b.s.timeStart ? 1 : a.i - b.i))
  for (const { s } of stops) {
    if (!ok(s.job) || seen.has(s.job.id)) continue
    seen.add(s.job.id)
    today.push(rowOf(s.job, pickerStopWords(s.timeStart), true))
  }
  const soon: PickerRow[] = []
  const soonEnd = pickerDayPlus(input.todayYmd, PICKER_SOON_DAYS)
  const whenOf = (s: PickerSoon) => `${s.day} ${s.timeStart || '99'}`
  const ahead = [...(input.soon ?? [])].map((s, i) => ({ s, i })).sort((a, b) => (whenOf(a.s) < whenOf(b.s) ? -1 : whenOf(a.s) > whenOf(b.s) ? 1 : a.i - b.i))
  for (const { s } of ahead) {
    if (soon.length >= PICKER_SOON_MAX) break
    if (!s?.job || !ok(s.job) || seen.has(s.job.id)) continue
    const words = s.day <= soonEnd ? pickerSoonWords(s.day, input.todayYmd) : ''
    if (!words) continue
    seen.add(s.job.id)
    soon.push({ ...rowOf(s.job, words, true), next: { day: s.day } })
  }
  const last: PickerRow[] = []
  const listed = new Set<string>()
  let best: { l: PickerLast; there: PickerThere } | null = null
  const guessFrom = pickerDayPlus(input.todayYmd, -PICKER_GUESS_DAYS)
  for (const l of input.last) {
    if (!l?.job || !ok(l.job) || listed.has(l.job.id)) continue
    listed.add(l.job.id)
    const there = thereOf(l)
    if (there && there.day <= input.todayYmd && there.day >= guessFrom && (!best || there.day > best.there.day || (there.day === best.there.day && HOW_RANK[there.how] < HOW_RANK[best.there.how]))) best = { l, there }
    if (seen.has(l.job.id)) continue
    if (l.how !== 'team' && (!l.day || l.day > input.todayYmd)) continue
    if (last.length < PICKER_LAST_MAX) last.push(lastRowOf(l, input.todayYmd))
  }
  if (today.length > 0) return { today, soon, last, guess: null }
  const next = soon[0]?.next && soon[0].next.day < pickerDayPlus(input.todayYmd, PICKER_NEXT_DAYS) ? soon[0] : null
  return { today, soon, last, guess: next ?? (best ? guessRowOf(best.l, best.there, input.todayYmd) : null) }
}

/**
 * The job the start sheet opens on when the app is told none: the next job on the person's
 * schedule inside a week, else the newest job they clocked onto or had on their schedule in the
 * last two weeks. None when a job is on today's schedule, and none from a change or the team
 * alone (`pickerSections`).
 */
export function pickerGuess(sections: PickerSections): PickerRow | null {
  return sections.guess
}

/** Under *For* on a sheet the app opened on a guess: `The next job on your schedule, tomorrow.` or `The last job you clocked onto, Friday.` */
export function pickerGuessWords(row: PickerRow, todayYmd: string): string {
  if (row.next) {
    const soon = pickerSoonWords(row.next.day, todayYmd)
    return soon ? `The next job on your schedule, ${soon}.` : 'The next job on your schedule.'
  }
  const day = row.last?.day ? pickerDayWords(row.last.day, todayYmd) : ''
  const lead = row.last?.how === 'schedule' ? 'The last job on your schedule' : 'The last job you clocked onto'
  return day ? `${lead}, ${day}.` : `${lead}.`
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

// ---------------------------------------------------------------- Find the jobs near me (step 5)

export type PickerPoint = { lat: number; lng: number }

/** An address the app has placed on the map (`address_geocodes`): its key and its point. */
export type PickerPlaced = { key: string; lat: number; lng: number }

/** How far the list looks, in metres: about five miles. Past that a job is not near. */
export const PICKER_NEAR_MAX_M = 8000
/** How many placed addresses are matched to jobs. */
export const PICKER_NEAR_ADDRESSES = 30
/** How many jobs the Near you list holds. */
export const PICKER_NEAR_MAX = 6

/** Why the phone gave no place, in words a person can act on. The search is always the way on. */
export const PICKER_NEAR_NO_FIX: Record<'none' | 'refused' | 'failed', string> = {
  none: 'This device gives no location. Search for the job.',
  refused: 'Location is off for this app. Allow it in the phone’s settings, or search for the job.',
  failed: 'Your phone could not find you. Try again outside, or search for the job.',
}

/** The same at a desk, where there is no phone to name. */
export const PICKER_NEAR_NO_FIX_DESK: Record<'none' | 'refused' | 'failed', string> = {
  none: PICKER_NEAR_NO_FIX.none,
  refused: 'Location is off for this app. Allow it in the browser’s settings, or search for the job.',
  failed: 'This computer could not find you. Search for the job.',
}

/** The square of ground the placed addresses are read from, a little wider than the list looks. */
export function pickerNearBox(me: PickerPoint): { latMin: number; latMax: number; lngMin: number; lngMax: number } {
  const dLat = (PICKER_NEAR_MAX_M * 1.1) / 111_320
  const dLng = dLat / Math.max(0.2, Math.cos((me.lat * Math.PI) / 180))
  return { latMin: me.lat - dLat, latMax: me.lat + dLat, lngMin: me.lng - dLng, lngMax: me.lng + dLng }
}

/** The placed addresses within reach, nearest first, held to `PICKER_NEAR_ADDRESSES`. An address said twice is kept once. */
export function pickerNearestPlaced(me: PickerPoint, placed: ReadonlyArray<PickerPlaced>): Array<{ key: string; meters: number }> {
  const seen = new Set<string>()
  const out: Array<{ key: string; meters: number }> = []
  for (const p of placed) {
    if (!p.key || seen.has(p.key) || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue
    seen.add(p.key)
    const meters = haversineMeters(me, p)
    if (meters <= PICKER_NEAR_MAX_M) out.push({ key: p.key, meters })
  }
  return out.sort((a, b) => a.meters - b.meters).slice(0, PICKER_NEAR_ADDRESSES)
}

/**
 * The Near you list: the jobs at those addresses, nearest first, each with how far, held to
 * `PICKER_NEAR_MAX`. It never picks for the person. A job is matched by its address as the app keys
 * it, so a job whose address the app has not placed is not here. Jobs at one address keep the order
 * they were read in, newest first.
 */
export function pickerNearRows(nearest: ReadonlyArray<{ key: string; meters: number }>, jobs: ReadonlyArray<PickerJob>, paintable: ReadonlySet<string>): PickerRow[] {
  const far = new Map(nearest.map((n) => [n.key, n.meters] as const))
  const rows: Array<{ row: PickerRow; meters: number; i: number }> = []
  jobs.forEach((job, i) => {
    if (!job.id || job.billingOnly || !paintable.has(job.id) || !job.address) return
    const meters = far.get(normalizeAddressForGeocodeKey(job.address))
    if (meters == null) return
    rows.push({ row: rowOf(job, aboutLengthWords(meters), true), meters, i })
  })
  return rows
    .sort((a, b) => a.meters - b.meters || a.i - b.i)
    .slice(0, PICKER_NEAR_MAX)
    .map((r) => r.row)
}

/**
 * The jobs filter that finds the jobs at those addresses: one clause an address, the address
 * matched whole with no regard to capitals. An address is quoted, so its commas stay its own, and a
 * character the filter would read as a wildcard is escaped or, for `*`, the address is left out.
 */
export function pickerNearJobsFilter(keys: ReadonlyArray<string>): string | null {
  const clauses = keys
    .filter((k) => !!k && !k.includes('*'))
    .map((k) => `job_address.ilike."${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[%_]/g, (c) => `\\${c}`)}"`)
  return clauses.length > 0 ? clauses.join(',') : null
}
