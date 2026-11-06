/**
 * Your week (punch list #255, v2.6589): one progress signal a tech can watch move, every week. The office picks one
 * signal a person on the People desk (`users.week_signal`): license hours for an apprentice, jobs without a callback
 * for a tech, the crew's hours against the target for a lead. The card on the tech's home says three things at most:
 * the signal and where it stands, how far it moved this week, and the customer's words when a customer wrote some.
 * Compared to themselves, never to each other. The week is the company's pay week (Sunday to Saturday).
 *
 * Pure: the signal's options and the role's guess, the parse of `my_week()`, each signal's read and its words, the
 * eight-week dots, the three-line rule.
 */
import type { LicenseHoursLogRow } from '../licenseHoursLog'
import { goalsFor, parseLicenseType, progressFor, rowCounts, withOfficeJob, type Goal } from '../logbook/logbook'
import { payWeekContaining, type PayWeek } from '../payWeekAnchor'
import { crewAgainstTarget, crewTargetWords, lastWeeks, targetOf, type TargetJob } from './crewTarget'

// ---------- the signal ----------

export type WeekSignal = 'license_hours' | 'jobs_without_callback' | 'crew_vs_target'

export const WEEK_SIGNALS: readonly WeekSignal[] = ['license_hours', 'jobs_without_callback', 'crew_vs_target']

export const WEEK_SIGNAL_WORDS: Record<WeekSignal, { label: string; hint: string }> = {
  license_hours: { label: 'License hours', hint: 'Approved hours toward the next license, with the hours waiting for approval hatched beside them.' },
  jobs_without_callback: { label: 'Jobs without a callback', hint: 'A rolling count: 29 of the last 30 jobs. One callback costs one, never the whole year.' },
  crew_vs_target: { label: 'Crew hours against target', hint: 'The crew’s hours on the finished jobs that carry a target. A lead’s signal, never a tech’s.' },
}

export function parseWeekSignal(raw: unknown): WeekSignal | null {
  return typeof raw === 'string' && (WEEK_SIGNALS as readonly string[]).includes(raw) ? (raw as WeekSignal) : null
}

/** The office's guess by role, offered on the picker and corrected once. Nothing for the office's own roles. */
export function suggestedSignalForRole(role: string | null | undefined): WeekSignal | null {
  switch (role) {
    case 'helpers':
      return 'license_hours'
    case 'primary':
      return 'jobs_without_callback'
    case 'superintendent':
    case 'master_technician':
      return 'crew_vs_target'
    default:
      return null
  }
}

export const PICKER_WORDS = {
  label: 'Their week signal',
  hint: (first: string) => `The one number ${first} sees move on Your week.`,
  none: 'No signal picked yet, so no Your week card.',
  suggested: (label: string) => `Suggested: ${label}.`,
  clear: 'No card',
}

// ---------- the parse of my_week() ----------

export type MyWeekHour = LicenseHoursLogRow & { approved: boolean }

export type MyWeekJob = {
  jobId: string
  number: string
  name: string
  finishedYmd: string | null
  expectedHours: number | null
  budgetHours: number | null
  crewHours: number
  /** The caller's first day on the job. */
  myFirstYmd: string
}

export type MyWeek = {
  signal: WeekSignal | null
  name: string
  role: string
  hours: MyWeekHour[]
  licenses: Array<{ license_type: string; date_of_expiry: string | null }>
  officeJobId: string | null
  jobs: MyWeekJob[]
  /** The first jobs of the pairs the office pressed It was a callback on. */
  callbackJobIds: string[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const numOrNull = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : [])

/** `my_week()`'s jsonb, typed. NULL (no caller) stays null. */
export function parseMyWeek(raw: unknown): MyWeek | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  return {
    signal: parseWeekSignal(o.signal),
    name: str(o.name),
    role: str(o.role),
    hours: arr(o.hours).map((h) => ({
      session_id: str(h.session_id),
      work_date: str(h.work_date),
      clocked_in_at: str(h.clocked_in_at),
      clocked_out_at: str(h.clocked_out_at),
      hours: Number(h.hours) || 0,
      job_ledger_id: strOrNull(h.job_ledger_id),
      job_number: str(h.job_number),
      job_name: str(h.job_name),
      job_address: str(h.job_address),
      service_type_name: str(h.service_type_name),
      bid_id: strOrNull(h.bid_id),
      notes: '',
      approved: Boolean(h.approved),
    })),
    licenses: arr(o.licenses).map((l) => ({ license_type: str(l.license_type), date_of_expiry: strOrNull(l.date_of_expiry) })),
    officeJobId: strOrNull(o.office_job_id),
    jobs: arr(o.jobs).map((j) => ({
      jobId: str(j.job_id),
      number: str(j.job_number),
      name: str(j.job_name),
      finishedYmd: strOrNull(j.finished_ymd),
      expectedHours: numOrNull(j.expected_hours),
      budgetHours: numOrNull(j.budget_hours),
      crewHours: Number(j.crew_hours) || 0,
      myFirstYmd: str(j.my_first_ymd),
    })),
    callbackJobIds: arr(o.callbacks).map((c) => str(c.first_job_id)).filter(Boolean),
  }
}

// ---------- the week's move ----------

export type Move = { tone: 'up' | 'flat' | 'none'; text: string }

const round1 = (n: number) => Math.round(n * 10) / 10
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const inWeek = (ymd: string, week: PayWeek): boolean => ymd >= week.start && ymd <= week.end

// ---------- license hours ----------

export type LicenseHoursRead = {
  goal: Goal | null
  /** "Hours toward journeyman plumber" */
  title: string
  /** Approved, from the clock plus the opening balance. */
  done: number
  need: number
  /** Closed hours waiting for approval, in the goal's trade. */
  waiting: number
  /** Approved and waiting hours in the goal's trade this week. */
  thisWeek: number
  nextMark: { at: number; away: number } | null
  /** The short bar: from the last 500-hour mark to the next. */
  bar: { from: number; to: number; approvedPct: number; waitingPct: number } | null
}

export function licenseHoursRead(my: MyWeek, week: PayWeek, todayYmd: string): LicenseHoursRead | null {
  const held = my.licenses.map((l) => parseLicenseType(l.license_type, l.date_of_expiry))
  const goal = goalsFor(held).goals[0] ?? null
  if (!goal) return null
  const rows = withOfficeJob(my.hours, my.officeJobId)
  const approved = rows.filter((r) => r.approved)
  const progress = progressFor(goal, approved, [], todayYmd)
  const inTrade = (r: MyWeekHour) => rowCounts(r).trade === goal.requirement.trade
  const waiting = round1(rows.filter((r) => !r.approved && inTrade(r)).reduce((s, r) => s + r.hours, 0))
  const thisWeek = round1(rows.filter((r) => inTrade(r) && inWeek(r.work_date, week)).reduce((s, r) => s + r.hours, 0))
  const title = `${progress.unit === 'months' ? 'Months' : 'Hours'} toward ${goal.requirement.toName.toLowerCase()}`
  let bar: LicenseHoursRead['bar'] = null
  if (progress.unit === 'hours' && progress.nextMark) {
    const to = progress.nextMark.at
    const from = Math.max(0, to - 500)
    const span = to - from
    bar = { from, to, approvedPct: Math.min(1, Math.max(0, (progress.done - from) / span)), waitingPct: Math.min(1, Math.max(0, (progress.done + waiting - from) / span)) }
  }
  return { goal, title, done: progress.done, need: progress.need, waiting, thisWeek, nextMark: progress.nextMark, bar }
}

export function licenseHoursWords(r: LicenseHoursRead): { head: string; sub: string; move: Move; mark: string } {
  const unit = r.goal?.requirement.unit === 'months' ? 'months' : 'h'
  const head = `${fmt(r.done).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} of ${r.need.toLocaleString('en-US')}${unit === 'h' ? '' : ' months'}`
  const sub = r.waiting > 0 ? `Approved · ${fmt(r.waiting)} h waiting for approval` : 'Approved'
  const move: Move = r.thisWeek > 0 ? { tone: 'up', text: `▲ ${fmt(r.thisWeek)} h this week` } : { tone: 'flat', text: 'Same as last week' }
  const mark = r.nextMark ? `Next mark ${r.nextMark.at.toLocaleString('en-US')} h. You are ${fmt(r.nextMark.away)} hours away.` : 'You have the hours the board asks for.'
  return { head, sub, move, mark }
}

// ---------- jobs without a callback ----------

export const CALLBACK_WINDOW_JOBS = 30

export type CallbackRead = {
  /** The jobs counted: up to the last 30 finished. */
  counted: number
  clean: number
  /** Finished this week. */
  thisWeek: number
  /** Among this week's finished jobs, how many the office confirmed as a callback's first job. */
  cameBackThisWeek: number
}

/** The last `n` finished jobs the caller worked, newest first, as of a day. */
function finishedBy(jobs: readonly MyWeekJob[], asOfYmd: string, n: number): MyWeekJob[] {
  return jobs
    .filter((j): j is MyWeekJob & { finishedYmd: string } => j.finishedYmd != null && j.finishedYmd <= asOfYmd)
    .sort((a, b) => b.finishedYmd.localeCompare(a.finishedYmd))
    .slice(0, n)
}

export function callbackRead(my: MyWeek, week: PayWeek, n = CALLBACK_WINDOW_JOBS): CallbackRead {
  const back = new Set(my.callbackJobIds)
  const last = finishedBy(my.jobs, week.end, n)
  const thisWeek = last.filter((j) => inWeek(j.finishedYmd!, week))
  return { counted: last.length, clean: last.filter((j) => !back.has(j.jobId)).length, thisWeek: thisWeek.length, cameBackThisWeek: thisWeek.filter((j) => back.has(j.jobId)).length }
}

export function callbackWords(r: CallbackRead): { head: string; move: Move } {
  if (r.counted === 0) return { head: 'No finished job yet', move: { tone: 'none', text: '' } }
  const head = `${r.clean} of your last ${r.counted} ${r.counted === 1 ? 'job' : 'jobs'}`
  if (r.thisWeek === 0) return { head, move: { tone: 'flat', text: 'Same as last week' } }
  const jobs = `${r.thisWeek} ${r.thisWeek === 1 ? 'job' : 'jobs'} this week`
  if (r.cameBackThisWeek === 0) return { head, move: { tone: 'up', text: `▲ ${jobs}, none came back` } }
  return { head, move: { tone: 'flat', text: `${jobs}, ${r.cameBackThisWeek === 1 ? 'one' : r.cameBackThisWeek} came back` } }
}

// ---------- the crew against the target ----------

export function targetJobsOf(my: MyWeek): TargetJob[] {
  return my.jobs.map((j) => ({ jobId: j.jobId, label: `${j.number} ${j.name}`.trim(), finishedYmd: j.finishedYmd, targetHours: targetOf(j.expectedHours, j.budgetHours), crewHours: j.crewHours }))
}

// ---------- the eight-week dots ----------

export type WeekDot = { week: PayWeek; value: number; target?: number }

/** One value a week, oldest first: the rolling clean count, the hours in the trade, or the crew's hours with the target beside them. */
export function weekDots(my: MyWeek, signal: WeekSignal, todayYmd: string, n = 8): WeekDot[] {
  const weeks = lastWeeks(todayYmd, n)
  if (signal === 'jobs_without_callback') return weeks.map((week) => ({ week, value: callbackRead(my, week).clean }))
  if (signal === 'crew_vs_target') {
    const jobs = targetJobsOf(my)
    return weeks.map((week) => {
      const r = crewAgainstTarget(jobs, week)
      return { week, value: r.hours, target: r.target }
    })
  }
  const held = my.licenses.map((l) => parseLicenseType(l.license_type, l.date_of_expiry))
  const goal = goalsFor(held).goals[0] ?? null
  const rows = withOfficeJob(my.hours, my.officeJobId)
  return weeks.map((week) => ({ week, value: round1(rows.filter((r) => (!goal || rowCounts(r).trade === goal.requirement.trade) && inWeek(r.work_date, week)).reduce((s, r) => s + r.hours, 0)) }))
}

export const DOTS_WORDS = { left: '8 weeks ago', right: 'This week', dashed: 'Dashed line is the target' }

// ---------- the card ----------

export type YourWeekCard = {
  signal: WeekSignal
  /** "Your week" */
  title: string
  /** "Nov 1 to Nov 7" */
  range: string
  /** The signal's name over the big number: "Jobs without a callback". */
  kicker: string
  head: string
  sub: string
  move: Move
  /** The license bar, when the signal is hours. */
  bar: LicenseHoursRead['bar']
  mark: string
  /** The crew signal's note about jobs with no target. */
  note: string
  dots: WeekDot[]
  dashed: boolean
}

const shortDay = (ymd: string): string => {
  const [y = 1970, m = 1, d = 1] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function weekRangeWords(week: PayWeek): string {
  return `${shortDay(week.start)} to ${shortDay(week.end)}`
}

/** The card for the person's signal, or null when the office picked none or the signal has nothing to read yet. */
export function yourWeekCard(my: MyWeek, todayYmd: string): YourWeekCard | null {
  if (!my.signal) return null
  const week = payWeekContaining(todayYmd)
  const base = { signal: my.signal, title: 'Your week', range: weekRangeWords(week), dots: weekDots(my, my.signal, todayYmd), bar: null as LicenseHoursRead['bar'], note: '', dashed: false }
  if (my.signal === 'license_hours') {
    const r = licenseHoursRead(my, week, todayYmd)
    if (!r) return null
    const w = licenseHoursWords(r)
    return { ...base, kicker: r.title, head: w.head, sub: w.sub, move: w.move, bar: r.bar, mark: w.mark, dots: [] }
  }
  if (my.signal === 'jobs_without_callback') {
    const w = callbackWords(callbackRead(my, week))
    return { ...base, kicker: WEEK_SIGNAL_WORDS.jobs_without_callback.label, head: w.head, sub: '', move: w.move, mark: '' }
  }
  const r = crewAgainstTarget(targetJobsOf(my), week)
  const w = crewTargetWords(r)
  const move: Move = w.tone === 'none' ? { tone: 'none', text: '' } : w.tone === 'down' ? { tone: 'flat', text: w.move } : { tone: 'up', text: w.move }
  return { ...base, kicker: 'Your crew against the target', head: w.head, sub: '', move, mark: '', note: w.note, dashed: true }
}
