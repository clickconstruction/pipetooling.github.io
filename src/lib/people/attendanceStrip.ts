import { ymdAddDays } from '../../utils/dateUtils'
import {
  LATE_GRACE_MINUTES,
  SALARY_SESSION_ORIGIN,
  computeLatenessByCell,
  earliestStartByCell,
  firstClockInByCell,
  latenessCellKey,
  minutesToClock,
  type LatenessBlockRow,
  type LatenessSessionRow,
} from '../scheduleLateness'

/**
 * The Write-ups attendance card as a strip of days (v2.6140, punch list #217, people-docs-3): one
 * column a day for the last ninety, today at the right edge. A ring is a scheduled day clocked on
 * time, an amber dot a late day sized by its minutes past the grace, a red diamond a no-call
 * no-show, a grey slash an excused late, a faint ring a scheduled day with no clock-in, nothing a
 * day with no block. The last thirty days are shaded, since that is the run the warning counts.
 * Every marked day carries its receipt: the block's start, the first clock-in, the minutes past
 * grace, and who excused it when someone did.
 *
 * Pure: it reads the same rows `computeLatenessByCell` reads (the schedule blocks, the clock
 * sessions), the excuse notes and the NCNS incidents, and returns the cells, the labels, the
 * counts as chips and the tardiness write-up's context lines. The card draws it; nothing is filed.
 *
 * Salaried people's sessions are made at schedule time (`origin = 'salary_schedule'`), so the
 * kernel can never find them late. Their strip marks no day late or on time and says why; a filed
 * no-call no-show still draws.
 */

export const ATTENDANCE_STRIP_DAYS = 90
export const ATTENDANCE_RECENT_DAYS = 30
/** The warning and its write-up door show from this many unexcused lates in the recent run. */
export const ATTENDANCE_WARN_LATES = 3

export type AttendanceDayKind = 'none' | 'onTime' | 'late' | 'excused' | 'ncns' | 'noClockIn'
export type AttendanceDotSize = 'small' | 'mid' | 'big'

/** The latest excuse note on a late day, as the card needs it. */
export type AttendanceExcuse = { note: string; byName: string | null; onYmd: string | null }

/** A filed no-call no-show, as the card needs it. */
export type AttendanceNcns = { work_date: string; byName: string | null; filedYmd: string | null; details: string | null }

export type AttendanceReceipt = {
  /** The day as the receipt heads it: *Mon, Oct 27*. */
  heading: string
  /** One fact a line. */
  lines: string[]
}

export type AttendanceStripDay = {
  ymd: string
  /** 0 Sunday … 6 Saturday. */
  dow: number
  weekend: boolean
  today: boolean
  /** In the last thirty days, the shaded run the warning counts. */
  recent: boolean
  kind: AttendanceDayKind
  /** A late dot's size by its minutes past grace; null for every other kind. */
  size: AttendanceDotSize | null
  /** Minutes past the grace on a late or excused day; null otherwise. */
  minutesPastGrace: number | null
  /** The day in a few words, for the hover and the screen reader. */
  words: string
  receipt: AttendanceReceipt | null
}

export type AttendanceStripLabel = {
  index: number
  text: string
  tone: 'muted' | 'hot' | 'today'
  align: 'left' | 'center' | 'right'
}

export type AttendanceCountChip = {
  key: 'late' | 'ncns' | 'onTime'
  text: string
  tone: 'warn' | 'stop' | 'ok' | 'neutral'
  /** The chip's words in full, for the hover. */
  words: string
}

export type AttendanceCounts = {
  scheduled: number
  onTime: number
  /** Unexcused late days. */
  late: number
  excused: number
  ncns: number
  noClockIn: number
  /** Unexcused late days in the recent run. */
  recentLate: number
  /** Over the unexcused late days; null with none. */
  medianLateMinutes: number | null
}

export type AttendanceStrip = {
  startYmd: string
  endYmd: string
  recentStartYmd: string
  days: AttendanceStripDay[]
  labels: AttendanceStripLabel[]
  counts: AttendanceCounts
  chips: AttendanceCountChip[]
  /** The whole strip in a few sentences, for the group's label. */
  words: string
  /** The person is salaried: sessions made at schedule time, so no day is marked late or on time. */
  salaried: boolean
  /** The warning shows: enough unexcused lates in the recent run. */
  warn: boolean
  /** The tardiness write-up's context, a line a fact and one per unexcused late, newest first. */
  writeupLines: string[]
}

export type AttendanceStripInput = {
  userId: string
  todayYmd: string
  blocks: readonly LatenessBlockRow[]
  sessions: readonly LatenessSessionRow[]
  /** The latest excuse per cell (`latenessCellKey`). */
  excuses: ReadonlyMap<string, AttendanceExcuse>
  ncns: readonly AttendanceNcns[]
  graceMinutes?: number
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const YMD = /^\d{4}-\d{2}-\d{2}$/

function utcOf(ymd: string): Date {
  return new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))))
}

/** *Oct 27*. */
export function attendanceMonthDay(ymd: string): string {
  if (!YMD.test(ymd)) return ymd
  return `${MONTH[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

/** *Mon, Oct 27*. */
export function attendanceDayWords(ymd: string): string {
  if (!YMD.test(ymd)) return ymd
  return `${DOW[utcOf(ymd).getUTCDay()]}, ${attendanceMonthDay(ymd)}`
}

/** A late dot's size: a few minutes, a half hour, an hour or more past the grace. */
export function attendanceDotSize(minutesPastGrace: number): AttendanceDotSize {
  if (minutesPastGrace <= 15) return 'small'
  if (minutesPastGrace <= 45) return 'mid'
  return 'big'
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

/** Minutes as words a reader can hold: *35 minutes*, *1 hour*, *2 hours 40 minutes*. */
export function attendanceMinutesWords(n: number): string {
  if (n < 60) return plural(n, 'minute')
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${plural(h, 'hour')}${m ? ` ${plural(m, 'minute')}` : ''}`
}

function blockLine(start: { mins: number; jobLabel: string | null } | undefined): string | null {
  if (!start) return null
  return `Block ${minutesToClock(start.mins)}${start.jobLabel ? ` on ${start.jobLabel}` : ''}.`
}

export function attendanceStrip(input: AttendanceStripInput): AttendanceStrip {
  const grace = input.graceMinutes ?? LATE_GRACE_MINUTES
  const { userId, todayYmd } = input
  const startYmd = ymdAddDays(todayYmd, -(ATTENDANCE_STRIP_DAYS - 1))
  const recentStartYmd = ymdAddDays(todayYmd, -(ATTENDANCE_RECENT_DAYS - 1))

  const myBlocks = input.blocks.filter((b) => b.assignee_user_id === userId && b.work_date >= startYmd && b.work_date <= todayYmd)
  const mySessions = input.sessions.filter((s) => s.user_id === userId && s.work_date >= startYmd && s.work_date <= todayYmd)
  const salaried = mySessions.some((s) => !s.rejected_at && !s.revoked_at && s.origin === SALARY_SESSION_ORIGIN)
  const startByCell = earliestStartByCell(myBlocks)
  const clockInByCell = firstClockInByCell(mySessions)
  const lateByCell = computeLatenessByCell(myBlocks, mySessions, grace)
  const ncnsByDay = new Map<string, AttendanceNcns>()
  for (const n of input.ncns) if (n.work_date >= startYmd && n.work_date <= todayYmd && !ncnsByDay.has(n.work_date)) ncnsByDay.set(n.work_date, n)

  const days: AttendanceStripDay[] = []
  const counts: AttendanceCounts = { scheduled: 0, onTime: 0, late: 0, excused: 0, ncns: 0, noClockIn: 0, recentLate: 0, medianLateMinutes: null }
  const lateMinutes: number[] = []
  const writeupDays: string[] = []

  for (let ymd = startYmd; ymd <= todayYmd; ymd = ymdAddDays(ymd, 1)) {
    const key = latenessCellKey(userId, ymd)
    const dow = utcOf(ymd).getUTCDay()
    const today = ymd === todayYmd
    const recent = ymd >= recentStartYmd
    const start = startByCell.get(key)
    const clockIn = clockInByCell.get(key)
    const late = lateByCell.get(key)
    const excuse = late ? input.excuses.get(key) : undefined
    const ncns = ncnsByDay.get(ymd)
    const dayWords = attendanceDayWords(ymd)

    let kind: AttendanceDayKind = 'none'
    if (ncns) kind = 'ncns'
    else if (salaried) kind = 'none'
    else if (late) kind = excuse ? 'excused' : 'late'
    else if (start && clockIn != null) kind = 'onTime'
    else if (start) kind = 'noClockIn'

    if (start && !salaried) counts.scheduled += 1
    let size: AttendanceDotSize | null = null
    let minutesPastGrace: number | null = null
    let words = `${dayWords}: nothing scheduled.`
    let receipt: AttendanceReceipt | null = null
    const lines: string[] = []

    switch (kind) {
      case 'ncns': {
        counts.ncns += 1
        words = `${dayWords}: no call, no show.`
        lines.push('No call, no show.')
        if (ncns?.byName || ncns?.filedYmd) lines.push(`Filed${ncns.byName ? ` by ${ncns.byName}` : ''}${ncns.filedYmd ? ` on ${attendanceDayWords(ncns.filedYmd)}` : ''}.`)
        if (ncns?.details?.trim()) lines.push(ncns.details.trim())
        const b = blockLine(start)
        if (b) lines.push(b)
        receipt = { heading: dayWords, lines }
        break
      }
      case 'late':
      case 'excused': {
        minutesPastGrace = late!.minutesLate - grace
        size = attendanceDotSize(minutesPastGrace)
        lines.push(blockLine(start)!)
        lines.push(`First clock-in ${minutesToClock(late!.clockInMinutes)}.`)
        lines.push(`${attendanceMinutesWords(minutesPastGrace)} past the ${grace}-minute grace.`)
        if (kind === 'excused') {
          counts.excused += 1
          words = `${dayWords}: late ${attendanceMinutesWords(late!.minutesLate)}, excused.`
          lines.push(`Excused${excuse?.byName ? ` by ${excuse.byName}` : ''}${excuse?.onYmd ? ` on ${attendanceDayWords(excuse.onYmd)}` : ''}: ${excuse?.note ?? ''}`.replace(/: $/, '.'))
        } else {
          counts.late += 1
          if (recent) counts.recentLate += 1
          lateMinutes.push(late!.minutesLate)
          words = `${dayWords}: late ${attendanceMinutesWords(late!.minutesLate)}, ${attendanceMinutesWords(minutesPastGrace)} past grace.`
          writeupDays.push(`${dayWords}: block ${minutesToClock(late!.scheduledStartMinutes)}${late!.jobLabel ? ` on ${late!.jobLabel}` : ''}, clocked in ${minutesToClock(late!.clockInMinutes)}, ${attendanceMinutesWords(minutesPastGrace)} past grace.`)
        }
        receipt = { heading: dayWords, lines }
        break
      }
      case 'onTime': {
        counts.onTime += 1
        const after = clockIn! - start!.mins
        words = `${dayWords}: on time.`
        lines.push(blockLine(start)!)
        lines.push(`First clock-in ${minutesToClock(clockIn!)}.`)
        lines.push(after <= 0 ? 'On time.' : `${attendanceMinutesWords(after)} after the start, inside the ${grace}-minute grace.`)
        receipt = { heading: dayWords, lines }
        break
      }
      case 'noClockIn': {
        counts.noClockIn += 1
        words = `${dayWords}: scheduled, no clock-in${today ? ' yet' : ''}.`
        lines.push(blockLine(start)!)
        lines.push(today ? 'No clock-in yet today.' : 'No clock-in that day.')
        receipt = { heading: dayWords, lines }
        break
      }
      case 'none':
        if (salaried && start) words = `${dayWords}: scheduled, salaried.`
        break
    }

    days.push({ ymd, dow, weekend: dow === 0 || dow === 6, today, recent, kind, size, minutesPastGrace, words, receipt })
  }

  lateMinutes.sort((a, b) => a - b)
  if (lateMinutes.length) {
    const mid = Math.floor(lateMinutes.length / 2)
    counts.medianLateMinutes = lateMinutes.length % 2 === 1 ? lateMinutes[mid]! : Math.round((lateMinutes[mid - 1]! + lateMinutes[mid]!) / 2)
  }

  const labels = attendanceStripLabels(days, recentStartYmd)
  const chips = attendanceCountChips(counts, salaried, grace)
  const warn = !salaried && counts.recentLate >= ATTENDANCE_WARN_LATES

  const span = `${attendanceMonthDay(startYmd)} to ${attendanceMonthDay(todayYmd)}`
  const parts = [`${days.length} days, ${span}, one column a day.`]
  if (salaried) parts.push('Salaried: clock sessions are made at schedule time, so no day is marked late or on time.')
  else {
    if (counts.late) parts.push(`${plural(counts.late, 'late day')} as amber dots sized by minutes past grace.`)
    if (counts.excused) parts.push(`${plural(counts.excused, 'excused late')} as a grey slash.`)
    if (counts.onTime) parts.push(`${plural(counts.onTime, 'on-time day')} as rings.`)
    if (counts.noClockIn) parts.push(`${plural(counts.noClockIn, 'scheduled day')} with no clock-in as a faint ring.`)
  }
  if (counts.ncns) parts.push(`${plural(counts.ncns, 'no-call no-show')} as a red diamond.`)
  parts.push('The last 30 days are shaded. Press a day for its receipt.')

  const writeupLines: string[] = []
  if (!salaried && counts.late) {
    writeupLines.push(`${plural(counts.recentLate, 'unexcused late')} in the last ${ATTENDANCE_RECENT_DAYS} days.`)
    writeupLines.push(`${counts.late} in the last ${ATTENDANCE_STRIP_DAYS} days${counts.medianLateMinutes != null ? `, median ${attendanceMinutesWords(counts.medianLateMinutes)} late` : ''}.`)
    writeupLines.push(...writeupDays.reverse())
  }

  return { startYmd, endYmd: todayYmd, recentStartYmd, days, labels, counts, chips, words: parts.join(' '), salaried, warn, writeupLines }
}

/** The axis labels: the first day, each month's first, the recent edge and today; a month's first that would crowd another label is dropped. */
export function attendanceStripLabels(days: readonly Pick<AttendanceStripDay, 'ymd' | 'today'>[], recentStartYmd: string): AttendanceStripLabel[] {
  if (days.length === 0) return []
  const last = days.length - 1
  const recentIndex = days.findIndex((d) => d.ymd >= recentStartYmd)
  const fixed: AttendanceStripLabel[] = [{ index: 0, text: attendanceMonthDay(days[0]!.ymd), tone: 'muted', align: 'left' }]
  if (recentIndex > 0 && recentIndex < last) {
    const monthFirst = days[recentIndex]!.ymd.endsWith('-01')
    fixed.push({ index: recentIndex, text: monthFirst ? `${attendanceMonthDay(days[recentIndex]!.ymd)}, last ${ATTENDANCE_RECENT_DAYS} days` : `last ${ATTENDANCE_RECENT_DAYS} days`, tone: 'hot', align: 'center' })
  }
  if (last > 0) fixed.push({ index: last, text: 'today', tone: 'today', align: 'right' })
  const out = [...fixed]
  days.forEach((d, i) => {
    if (!d.ymd.endsWith('-01')) return
    if (fixed.some((l) => Math.abs(l.index - i) < 6)) return
    out.push({ index: i, text: attendanceMonthDay(d.ymd), tone: 'muted', align: 'center' })
  })
  return out.sort((a, b) => a.index - b.index)
}

/** The head's counts as chips with their words on hover: late with its excused, NCNS, on time of scheduled. */
export function attendanceCountChips(c: AttendanceCounts, salaried: boolean, grace: number = LATE_GRACE_MINUTES): AttendanceCountChip[] {
  const out: AttendanceCountChip[] = []
  if (!salaried) {
    const lateWords = [`${plural(c.late, 'unexcused late day')} in ${ATTENDANCE_STRIP_DAYS} days${c.excused ? `, and ${plural(c.excused, 'excused late')}` : ''}.`]
    if (c.medianLateMinutes != null) lateWords.push(`Median ${attendanceMinutesWords(c.medianLateMinutes)} late.`)
    lateWords.push(`Late is a first clock-in more than ${grace} minutes after the earliest block's start.`)
    out.push({ key: 'late', text: `late ${c.late}${c.excused ? ` · ${c.excused} excused` : ''}`, tone: c.late ? 'warn' : 'neutral', words: lateWords.join(' ') })
  }
  out.push({ key: 'ncns', text: `NCNS ${c.ncns}`, tone: c.ncns ? 'stop' : 'neutral', words: `${plural(c.ncns, 'no-call no-show')} filed in ${ATTENDANCE_STRIP_DAYS} days.` })
  if (!salaried) {
    const onTimeWords = [`On time on ${c.onTime} of ${plural(c.scheduled, 'scheduled day')}.`]
    if (c.noClockIn) onTimeWords.push(`${plural(c.noClockIn, 'scheduled day')} had no clock-in.`)
    out.push({ key: 'onTime', text: `on time ${c.onTime} of ${c.scheduled}`, tone: c.scheduled && c.onTime === c.scheduled ? 'ok' : 'neutral', words: onTimeWords.join(' ') })
  }
  return out
}
