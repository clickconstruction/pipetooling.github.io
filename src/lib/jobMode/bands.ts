/**
 * Job Mode in three bands (design spike, 2026-11-20; to-dos/crew-lead-dashboard).
 *
 * A crew lead on a long job opened a page built for a day of several stops: the job under a third of a screen
 * of other things, no word on who was with him or what had changed, and the things asked of him in six places.
 * The bands page keeps every piece of that page and gives each one a place: **My job** (the card and its
 * tools), **Around me** (his crew, the latest on the job, his week, the company's day), **Waiting on me** (one
 * list with one count), and **Everything else** (the rest, each a line that opens in place).
 *
 * This file is the rule and every word of the two new bands. Pure: rows in, words out.
 */
import { bucketForEvent, type JobActivityEvent } from '../jobActivityEvent'
import type { ReportOwedLine, SupervisedDaysPayload } from '../people/supervisedDays'

export const BANDS_WORDS = {
  myJob: 'My job',
  aroundMe: 'Around me',
  waiting: 'Waiting on me',
  waitingClear: 'Nothing waiting on you.',
  everythingElse: 'Everything else',
  latest: 'Latest on this job',
  noLatest: 'Nothing new written on this job yet.',
  week: 'My week',
  company: 'The company today',
  fullDashboard: 'Show full dashboard',
} as const

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** Read at noon UTC of the day itself, so no device zone moves it. */
const dayIndex = (ymd: string): number => new Date(`${ymd}T12:00:00Z`).getUTCDay()

export function ymdPlus(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** *Rosa*, *Rosa and Kim*, *Rosa, Kim and Lee*. First names as the roster holds them. */
export function namesWords(names: ReadonlyArray<string>): string {
  const n = names.map((s) => s.trim()).filter(Boolean)
  if (n.length <= 1) return n[0] ?? ''
  return `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

// ---- Around me: the crew ---------------------------------------------------------------------------

export type CrewToday = {
  /** Everybody scheduled on the job today but the person. */
  names: string[]
  /** Those of them on the clock on this job now, with the time they clocked in. */
  here: Array<{ name: string; since: string }>
}

/** Who shares the job today, from the supervised week the Dashboard's My crew already reads. */
export function crewToday(payload: SupervisedDaysPayload | null, jobId: string | null, todayYmd: string, myUserId: string): CrewToday {
  if (!payload || !jobId) return { names: [], here: [] }
  const day = payload.job_days.find((d) => d.job_id === jobId && d.work_date === todayYmd)
  const crew = (day?.crew ?? []).filter((c) => c.user_id !== myUserId)
  const names = crew.map((c) => (c.name ?? '').trim()).filter(Boolean)
  const ids = new Set(crew.map((c) => c.user_id))
  const here: CrewToday['here'] = []
  for (const s of payload.sessions) {
    if (s.work_date !== todayYmd || s.job_id !== jobId || s.clocked_out_at || !ids.has(s.user_id)) continue
    const name = (s.name ?? '').trim()
    if (name && !here.some((h) => h.name === name)) here.push({ name, since: s.clocked_in_at })
  }
  return { names, here }
}

/** *With Rosa today.* Null when nobody shares the job. */
export function crewSentence(crew: CrewToday): string | null {
  return crew.names.length > 0 ? `With ${namesWords(crew.names)} today.` : null
}

/** *Rosa clocked in at 6:23 AM.* One sentence a person. `hm` writes the time in the company's zone. */
export function crewHereSentences(crew: CrewToday, hm: (iso: string) => string): string[] {
  return crew.here.map((h) => `${h.name} clocked in at ${hm(h.since)}.`)
}

// ---- Around me: the latest on the job --------------------------------------------------------------

export type LatestLine = { key: string; who: string | null; words: string; age: string }

/** *today*, *yesterday*, *3 days ago*. Whole days between two instants. */
export function ageWords(iso: string, nowMs: number): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const days = Math.floor((nowMs - t) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/**
 * The newest lines of the job's own feed with the clock left out: a punch is not news, and on a long job the
 * punches bury what the office wrote. Money lines stay out too. Newest first.
 */
export function latestJobLines(events: ReadonlyArray<JobActivityEvent>, nowMs: number, max = 2): LatestLine[] {
  return events
    .filter((e) => !e.financial && bucketForEvent(e.type) !== 'crew' && e.summary.trim())
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, max)
    .map((e) => ({ key: e.dedupeKey, who: e.actorName, words: e.summary.trim(), age: ageWords(e.occurredAt, nowMs) }))
}

// ---- Around me: the week ---------------------------------------------------------------------------

export type WeekBlock = { workDate: string; jobId: string | null; label: string }
export type WeekDay = { ymd: string; weekday: string; isToday: boolean; labels: string[] }

/** Seven days from today, each with the short labels of the jobs on it. */
export function weekStrip(blocks: ReadonlyArray<WeekBlock>, todayYmd: string, days = 7): WeekDay[] {
  const out: WeekDay[] = []
  for (let i = 0; i < days; i++) {
    const ymd = ymdPlus(todayYmd, i)
    const labels: string[] = []
    for (const b of blocks) if (b.workDate === ymd && b.label && !labels.includes(b.label)) labels.push(b.label)
    out.push({ ymd, weekday: WEEKDAYS[dayIndex(ymd)] ?? '', isToday: i === 0, labels })
  }
  return out
}

/** *4 days on the schedule, 1 job.* The strip's one line. */
export function weekSentence(strip: ReadonlyArray<WeekDay>): string {
  const on = strip.filter((d) => d.labels.length > 0)
  if (on.length === 0) return 'Nothing on your schedule for the next 7 days.'
  const jobs = new Set(on.flatMap((d) => d.labels))
  return `${on.length} ${on.length === 1 ? 'day' : 'days'} on the schedule, ${jobs.size} ${jobs.size === 1 ? 'job' : 'jobs'}.`
}

// ---- Waiting on me ---------------------------------------------------------------------------------

export type WaitingKey = 'reports' | 'rate' | 'cards' | 'truck' | 'training'
export type WaitingRow = {
  key: WaitingKey
  title: string
  note: string
  action: string
  /** How much of the count this row is. */
  count: number
}

export type WaitingInput = {
  /** Job-days this person led with no report, newest first (`buildSupervisedView`). */
  reportsOwed: ReadonlyArray<ReportOwedLine>
  /** People still to rate this month. */
  toRate: number
  /** The month the rating is for, as words (*November*). */
  rateMonth: string
  /** Card charges not yet on a job. Null while unread. */
  cardCharges: number | null
  /** The vehicle whose mileage is asked for. */
  truck: { vehicle: string; age: string | null } | null
  /** Required courses still to do. */
  coursesOwed: number
  /** Hours the person worked this week on a job that owes a report, by job (Your record's own figure). */
  hoursByJob?: Readonly<Record<string, number>>
}

const dayWord = (ymd: string): string => WEEKDAYS_LONG[dayIndex(ymd)] ?? ymd

/** The report the row's press writes: the newest day that is over, else today's. */
export function reportToWrite(reportsOwed: ReadonlyArray<ReportOwedLine>): ReportOwedLine | null {
  return reportsOwed.find((r) => !r.isToday) ?? reportsOwed[0] ?? null
}

/**
 * The one list. Every row says what is asked, what it is about and the press that answers it. The order is
 * the order of his day: the report first, then his crew, his card, his truck and his course.
 */
export function buildWaitingRows(input: WaitingInput): WaitingRow[] {
  const rows: WaitingRow[] = []
  const past = input.reportsOwed.filter((r) => !r.isToday)
  const first = reportToWrite(input.reportsOwed)
  if (first) {
    const withWords = first.crewNames.length > 0 ? ` with ${namesWords(first.crewNames)}` : ''
    const h = input.hoursByJob?.[first.jobId]
    const hoursWords = typeof h === 'number' && h > 0 ? ` You worked it ${h < 10 ? h.toFixed(1) : Math.round(h)} h this week.` : ''
    if (past.length === 0) {
      rows.push({ key: 'reports', title: "Today's report", note: `${first.label}${withWords}. Write it when the day is done.${hoursWords}`, action: 'Write it', count: 1 })
    } else {
      const more = past.length > 1 ? ` ${past.length - 1} more ${past.length - 1 === 1 ? 'day is' : 'days are'} under My crew.` : ''
      rows.push({
        key: 'reports',
        title: `${past.length} ${past.length === 1 ? 'day' : 'days'} with no report`,
        note: `${dayWord(first.workDate)} on ${first.label}${withWords}.${hoursWords}${more}`,
        action: 'Write it',
        count: past.length,
      })
    }
  }
  if (input.toRate > 0) {
    rows.push({ key: 'rate', title: 'Rate your crew', note: `${input.toRate} ${input.toRate === 1 ? 'person' : 'people'} for ${input.rateMonth}. Three sliders each.`, action: 'Rate', count: input.toRate })
  }
  if (input.cardCharges != null && input.cardCharges > 0) {
    const n = input.cardCharges
    rows.push({ key: 'cards', title: `${n} card ${n === 1 ? 'charge needs' : 'charges need'} a job`, note: 'Put each one on the job it was for.', action: 'Open', count: n })
  }
  if (input.truck) {
    rows.push({ key: 'truck', title: 'Truck mileage', note: `${input.truck.vehicle}. ${input.truck.age ? `The last reading was ${input.truck.age}.` : 'No reading yet.'}`, action: 'Send', count: 1 })
  }
  if (input.coursesOwed > 0) {
    const n = input.coursesOwed
    rows.push({ key: 'training', title: `${n} ${n === 1 ? 'course' : 'courses'} to do`, note: 'Short lessons, at your own pace.', action: 'Open', count: n })
  }
  return rows
}

/** The band's count: how many rows wait, with Your record's own rows added by the page. */
export function waitingCount(rows: ReadonlyArray<WaitingRow>, recordRows: number): number {
  return rows.length + Math.max(0, recordRows)
}
