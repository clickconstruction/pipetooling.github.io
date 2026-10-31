/**
 * The job's days as one strip (v2.6139, punch list #217, jobs-pipeline-6): the Job tab's Track
 * view of its two date bands. One column a day from the job's start to today: the start a
 * diamond, an approved field day a filled dot, a day clocked but not yet approved a ring, each
 * bill a blue tick, today the right edge. One *last work* line with its source — *approved
 * Oct 12*, or *clocked out today, not approved yet* — instead of the two bands that could
 * disagree (`jobs_ledger.last_work_date` against any clock-out). Pure: it reads the job's clock
 * sessions and its sent bills and returns cells; the tab draws them, and a press on a day opens
 * it in the job's feed. The shape is the Legal desk's Timeline strip (`timelineStrip.ts`).
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'

export type JobDaysSession = {
  work_date: string | null
  clocked_in_at: string | null
  clocked_out_at: string | null
  approved_at: string | null
  rejected_at: string | null
}

export type JobDaysBill = {
  /** jobs_ledger_invoices.billed_at; a bill with none is not on the strip. */
  billed_at: string | null
}

export type JobDaysStripInput = {
  todayYmd: string
  sessions: ReadonlyArray<JobDaysSession>
  bills: ReadonlyArray<JobDaysBill>
  /** The feed's cap on sessions read (100): the strip says when the job has more than it read. */
  sessionsTruncated?: boolean
}

export type JobStripField = 'approved' | 'pending' | null

export type JobStripDay = {
  ymd: string
  /** 0 Sunday … 6 Saturday. */
  dow: number
  weekend: boolean
  today: boolean
  /** The job's first day on the strip. */
  start: boolean
  /** An approved field day, or one clocked but not yet approved; null on a day with no work. */
  field: JobStripField
  /** People on the clock that day. */
  people: number
  /** Still on the clock: a session with no clock-out. */
  open: boolean
  /** Bills sent that day. */
  bills: number
  /** The axis label under the day — the month and day on each Monday, and on a first of the month that no Monday crowds; '' otherwise. */
  label: string
  /** The day in one line, for the hover and the screen reader. */
  words: string
}

export type JobLastWork = {
  ymd: string
  /** "approved Oct 12" · "clocked out today, not approved yet" · "clocked in today, still on the job". */
  words: string
  source: 'approved' | 'pending' | 'open'
}

export type JobDaysStrip = {
  startYmd: string
  endYmd: string
  days: JobStripDay[]
  /** The job's first day: the first clock-in or the first bill; '' with neither. */
  firstYmd: string
  lastWork: JobLastWork | null
  /** Days before the strip's left edge that the window could not hold. */
  trimmedDays: number
  /** The job has more sessions than were read, so the strip's right end may be missing days. */
  truncated: boolean
  /** The whole strip in one sentence. */
  words: string
}

export const JOB_STRIP_MAX_DAYS = 120
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

function addDays(ymd: string, n: number): string {
  const d = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)) + n))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function dowOf(ymd: string): number {
  return new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))).getUTCDay()
}

/** A session's day: its work date, else the day it clocked in; '' when neither reads. */
export function sessionDayYmd(s: Pick<JobDaysSession, 'work_date' | 'clocked_in_at'>): string {
  const wd = (s.work_date ?? '').trim().slice(0, 10)
  if (YMD_RE.test(wd)) return wd
  return calendarYmdInAppTzFromIso(s.clocked_in_at ?? '')
}

function dayWords(d: Omit<JobStripDay, 'words' | 'label'>, todayYmd: string): string {
  const parts: string[] = [formatYmdMonthDay(d.ymd)]
  if (d.today) parts.push('today')
  if (d.start) parts.push('the job’s first day')
  if (d.field === 'approved') parts.push(`${d.people} on the job, approved`)
  else if (d.field === 'pending') parts.push(d.open && d.ymd === todayYmd ? `${d.people} on the job now, not approved yet` : `${d.people} on the job, not approved yet`)
  if (d.bills) parts.push(d.bills === 1 ? 'a bill went out' : `${d.bills} bills went out`)
  return parts.join(' · ')
}

export function buildJobDaysStrip({ todayYmd, sessions, bills, sessionsTruncated = false }: JobDaysStripInput): JobDaysStrip {
  type Cell = { approved: boolean; pending: boolean; people: Set<string>; open: boolean; bills: number }
  const byDay = new Map<string, Cell>()
  const cell = (ymd: string): Cell => {
    const c = byDay.get(ymd) ?? { approved: false, pending: false, people: new Set<string>(), open: false, bills: 0 }
    byDay.set(ymd, c)
    return c
  }
  let lastApproved = ''
  let lastPending = ''
  let lastPendingOpen = false
  let lastPendingOut = ''
  sessions.forEach((s, i) => {
    if (s.rejected_at) return
    const ymd = sessionDayYmd(s)
    if (!ymd) return
    const c = cell(ymd)
    c.people.add(`${i}`)
    if (s.approved_at) {
      c.approved = true
      if (ymd > lastApproved) lastApproved = ymd
    } else {
      c.pending = true
      if (!s.clocked_out_at) c.open = true
      if (ymd >= lastPending) {
        lastPending = ymd
        lastPendingOpen = !s.clocked_out_at
        lastPendingOut = calendarYmdInAppTzFromIso(s.clocked_out_at ?? '')
      }
    }
  })
  for (const b of bills) {
    const ymd = calendarYmdInAppTzFromIso(b.billed_at ?? '')
    if (!ymd) continue
    cell(ymd).bills += 1
  }
  const dated = [...byDay.keys()].sort()
  const firstYmd = dated[0] ?? ''
  const endYmd = todayYmd
  let startYmd = firstYmd && firstYmd < todayYmd ? firstYmd : todayYmd
  let trimmedDays = 0
  if (daysBetweenYmd(startYmd, endYmd)! + 1 > JOB_STRIP_MAX_DAYS) {
    const kept = addDays(endYmd, -(JOB_STRIP_MAX_DAYS - 1))
    trimmedDays = daysBetweenYmd(startYmd, kept) ?? 0
    startYmd = kept
  }
  const days: JobStripDay[] = []
  for (let ymd = startYmd; ymd <= endYmd; ymd = addDays(ymd, 1)) {
    const c = byDay.get(ymd)
    const dow = dowOf(ymd)
    const day = Number(ymd.slice(8, 10))
    const base = {
      ymd,
      dow,
      weekend: dow === 0 || dow === 6,
      today: ymd === todayYmd,
      start: ymd === firstYmd,
      field: (c ? (c.approved ? 'approved' : c.pending ? 'pending' : null) : null) as JobStripField,
      people: c?.people.size ?? 0,
      open: c?.open ?? false,
      bills: c?.bills ?? 0,
    }
    days.push({ ...base, label: dow === 1 || (day === 1 && (dow === 4 || dow === 5)) ? `${MONTH[Number(ymd.slice(5, 7)) - 1]} ${day}` : '', words: dayWords(base, todayYmd) })
  }
  // One last work, said once: the approved day unless a later day is clocked and still waiting.
  let lastWork: JobLastWork | null = null
  if (lastPending && lastPending > lastApproved) {
    const sameDay = lastPending === todayYmd
    lastWork = lastPendingOpen
      ? { ymd: lastPending, words: sameDay ? 'clocked in today, still on the job' : `clocked in ${formatYmdMonthDay(lastPending)}, still on the clock`, source: 'open' }
      : { ymd: lastPending, words: `clocked out ${lastPendingOut === todayYmd ? 'today' : formatYmdMonthDay(lastPendingOut || lastPending)}, not approved yet`, source: 'pending' }
  } else if (lastApproved) {
    lastWork = { ymd: lastApproved, words: `approved ${formatYmdMonthDay(lastApproved)}`, source: 'approved' }
  }
  const fieldDays = days.filter((d) => d.field).length
  const billDays = days.reduce((n, d) => n + d.bills, 0)
  const parts = [firstYmd ? `${days.length} days since the job’s first day, ${formatYmdMonthDay(firstYmd)}, one column a day.` : 'No days on the job yet.']
  if (trimmedDays) parts.push(`${trimmedDays} earlier days are off the left edge.`)
  if (fieldDays) parts.push(`${fieldDays} field day${fieldDays === 1 ? '' : 's'}.`)
  if (billDays) parts.push(`${billDays} bill${billDays === 1 ? '' : 's'}.`)
  if (lastWork) parts.push(`Last work ${lastWork.words}.`)
  if (sessionsTruncated) parts.push('Only the first 100 sessions were read.')
  parts.push('Press a day to open it in the feed.')
  return { startYmd, endYmd, days, firstYmd, lastWork, trimmedDays, truncated: sessionsTruncated, words: parts.join(' ') }
}
