import { scheduleDateKeyAddDays, scheduleParseDateKeyLocal } from '../jobScheduleChicago'
import { formatRelativeDayPhrase, relativeDayOffset } from '../relativeDayPhrase'
import { formatStagesCompactWindow, formatStagesNextDateLabel, type StagesUpcomingAppointment } from '../stagesUpcomingSchedule'

/**
 * The Pipeline row's two-week schedule strip (v2.3752): ten weekday cells —
 * this week and next, Monday first — filled where the job has a calendar
 * block, today outlined, with the plain-words lines under it (NEXT / ENDS,
 * "Not scheduled", "Done"). Pure: the row feeds it the job's upcoming
 * appointment (already fetched for the NEXT line) and the reference dates
 * the `j:` line used to show. Worked ticks (approved sessions) are not in
 * this cut — the strip draws booked days only.
 */

export type StagesStripCell = {
  ymd: string
  /** Single weekday letter for the row under the cells. */
  letter: string
  booked: boolean
  /** Someone clocked an approved session that day (v2.3785). */
  worked: boolean
  /** Booked, before today, and nobody clocked — a planned day that did not happen. */
  missed: boolean
  today: boolean
  /** Before today with nothing booked and nothing worked: drawn fainter. */
  past: boolean
  /** First cell of the second week — carries the visual week break. */
  weekStart: boolean
  weekend: boolean
}

export type StagesStrip = {
  cells: StagesStripCell[]
  /** Worked days inside the window. */
  workedInWindow: number
  /** Booked days after the two-week window (a "+N later" hint). */
  laterCount: number
  /** Booked days inside the window. */
  bookedInWindow: number
}

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

/** Monday of the week holding `ymd` (Chicago civil date). */
export function stripWeekStartYmd(ymd: string): string | null {
  const d = scheduleParseDateKeyLocal(ymd)
  if (!d) return null
  const dow = d.getUTCDay() // 0 = Sunday
  const back = (dow + 6) % 7
  return scheduleDateKeyAddDays(ymd, -back)
}

/**
 * Weekday cells for this week + next; a weekend cell appears only when a
 * block sits on it, so a Saturday job shows as a sixth cell on its week.
 */
export function buildTwoWeekStrip(args: {
  todayYmd: string
  bookedYmds: readonly string[]
  workedYmds?: readonly string[]
}): StagesStrip {
  const start = stripWeekStartYmd(args.todayYmd)
  const isYmd = (y: string) => /^\d{4}-\d{2}-\d{2}$/.test(y)
  const booked = new Set(args.bookedYmds.filter(isYmd))
  const worked = new Set((args.workedYmds ?? []).filter(isYmd))
  if (!start) return { cells: [], laterCount: booked.size, bookedInWindow: 0, workedInWindow: 0 }
  const cells: StagesStripCell[] = []
  let bookedInWindow = 0
  let workedInWindow = 0
  let endYmd = start
  for (let i = 0; i < 14; i++) {
    const ymd = scheduleDateKeyAddDays(start, i)
    if (!ymd) continue
    endYmd = ymd
    const dow = i % 7
    const weekend = dow >= 5
    const isBooked = booked.has(ymd)
    const isWorked = worked.has(ymd)
    if (weekend && !isBooked && !isWorked) continue
    if (isBooked) bookedInWindow++
    if (isWorked) workedInWindow++
    const before = ymd < args.todayYmd
    cells.push({
      ymd,
      letter: LETTERS[dow]!,
      booked: isBooked,
      worked: isWorked,
      missed: isBooked && before && !isWorked,
      today: ymd === args.todayYmd,
      past: before && !isBooked && !isWorked,
      weekStart: i === 7,
      weekend,
    })
  }
  let laterCount = 0
  for (const y of booked) if (y > endYmd) laterCount++
  return { cells, laterCount, bookedInWindow, workedInWindow }
}

export type StagesWhen =
  | {
      kind: 'scheduled'
      nextYmd: string
      /** "8–10 AM" */
      nextWindow: string
      nextNames: string[]
      endsYmd: string
      visits: number
    }
  | {
      kind: 'unscheduled'
      /** Amber on a Working job (something to chase); muted on Waiting, where nothing booked is the stage's meaning. */
      tone: 'amber' | 'muted'
      lastYmd: string | null
      lastKind: 'worked' | 'scheduled' | null
    }
  | { kind: 'done'; lastYmd: string | null }

export type StagesWhenInput = {
  upcoming: StagesUpcomingAppointment | null | undefined
  /** `jobs_ledger.last_work_date` — the latest approved clock day. */
  lastWorkDate: string | null | undefined
  /** Max `job_schedule_blocks.work_date`, past or future (set in Jobs `loadJobs`). */
  lastScheduleWorkDate: string | null | undefined
  pctComplete: number | null | undefined
  status: string | null | undefined
  todayYmd: string
}

function ymdOf(s: string | null | undefined): string | null {
  const t = s?.trim() ?? ''
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  return null
}

/** Which of the three states the row is in, and the dates the words need. */
export function deriveStagesWhen(input: StagesWhenInput): StagesWhen {
  const up = input.upcoming ?? null
  if (up) {
    const visits = Math.max(1, up.visitCount || up.bookedYmds?.length || 1)
    return {
      kind: 'scheduled',
      nextYmd: up.ymd,
      nextWindow: formatStagesCompactWindow(up.timeStart, up.timeEnd),
      nextNames: up.assigneeNames,
      endsYmd: up.lastYmd || up.ymd,
      visits,
    }
  }
  const worked = ymdOf(input.lastWorkDate)
  const scheduled = ymdOf(input.lastScheduleWorkDate)
  // A block still ahead of today with no upcoming entry cannot happen (the
  // upcoming query covers >= today); treat any schedule date as past.
  let lastYmd: string | null = null
  let lastKind: 'worked' | 'scheduled' | null = null
  if (worked && (!scheduled || worked >= scheduled)) {
    lastYmd = worked
    lastKind = 'worked'
  } else if (scheduled) {
    lastYmd = scheduled
    lastKind = 'scheduled'
  }
  const status = (input.status ?? '').trim()
  const pct = typeof input.pctComplete === 'number' ? input.pctComplete : null
  const pastWorking = status !== '' && status !== 'waiting' && status !== 'working'
  if ((pct != null && pct >= 100) || pastWorking) {
    return { kind: 'done', lastYmd }
  }
  return { kind: 'unscheduled', tone: status === 'waiting' ? 'muted' : 'amber', lastYmd, lastKind }
}

/** "Wed Sep 23" — the strip's date words (same shape as the NEXT line). */
export function formatStripDate(ymd: string): string {
  return formatStagesNextDateLabel(ymd)
}

/** "Fri Sep 25 · 3 visits" / "same day · 1 visit". */
export function formatStripEnds(when: Extract<StagesWhen, { kind: 'scheduled' }>): string {
  const visits = `${when.visits} visit${when.visits === 1 ? '' : 's'}`
  if (when.endsYmd === when.nextYmd) return `same day · ${visits}`
  return `${formatStripDate(when.endsYmd)} · ${visits}`
}

/**
 * The distance from today, in words (v2.3792 — what `T+2` was saying):
 * today · yesterday · tomorrow · N days ago · in N days, then weeks past
 * two weeks and months past twelve weeks, so the words never outgrow the
 * column. Null when either date is not a YYYY-MM-DD.
 */
export function stripDistancePhrase(ymd: string, todayYmd: string): string | null {
  const n = relativeDayOffset(ymd, todayYmd)
  if (n == null) return null
  const abs = Math.abs(n)
  if (abs <= 13) return formatRelativeDayPhrase(ymd, todayYmd)
  const past = n > 0
  if (abs < 84) {
    const w = Math.round(abs / 7)
    return past ? `${w} weeks ago` : `in ${w} weeks`
  }
  const m = Math.max(3, Math.round(abs / 30))
  return past ? `${m} months ago` : `in ${m} months`
}

/**
 * The column's two-line shape: the label and the calendar date on line one,
 * the distance from today and the fact on line two ("Mon Sep 21" over
 * "2 days ago · sent" is `T+2 (mon)` spelled out). The Crew & Dates column
 * has ~112 px of words beside the strip, so the fact words stay short.
 */
export type StripLineParts = { main: string; sub: string | null }

function joinSub(phrase: string | null, fact: string | null): string | null {
  const parts = [phrase, fact].filter((x): x is string => Boolean(x))
  return parts.length ? parts.join(' · ') : null
}

/** NEXT: "Fri Sep 25" / "in 2 days · 8 AM–12 PM". */
export function stripNextParts(when: Extract<StagesWhen, { kind: 'scheduled' }>, todayYmd: string): StripLineParts {
  return { main: formatStripDate(when.nextYmd), sub: joinSub(stripDistancePhrase(when.nextYmd, todayYmd), when.nextWindow) }
}

/** ENDS: "same day" (the NEXT line already carries the distance) / "Fri Sep 25" over "in 3 days · 3 visits". */
export function stripEndsParts(when: Extract<StagesWhen, { kind: 'scheduled' }>, todayYmd: string): StripLineParts {
  if (when.endsYmd === when.nextYmd) return { main: 'same day', sub: when.visits > 1 ? `${when.visits} visits` : null }
  return {
    main: formatStripDate(when.endsYmd),
    sub: joinSub(stripDistancePhrase(when.endsYmd, todayYmd), `${when.visits} visit${when.visits === 1 ? '' : 's'}`),
  }
}

/** LAST: "Tue Sep 22" over "yesterday · worked" / "booked, no hrs"; "never worked" alone. */
export function stripLastParts(lastYmd: string | null, lastKind: 'worked' | 'scheduled' | null, todayYmd: string): StripLineParts {
  if (!lastYmd) return { main: 'never worked', sub: null }
  return { main: formatStripDate(lastYmd), sub: joinSub(stripDistancePhrase(lastYmd, todayYmd), lastKind === 'scheduled' ? 'booked, no hrs' : 'worked') }
}

/** DONE: "Mon Sep 21" over "2 days ago · last visit"; "nothing booked" alone. */
export function stripDoneParts(lastYmd: string | null, todayYmd: string): StripLineParts {
  return lastYmd ? { main: formatStripDate(lastYmd), sub: joinSub(stripDistancePhrase(lastYmd, todayYmd), 'last visit') } : { main: 'nothing booked', sub: null }
}

/**
 * The billing line (the old `b:`): PAID when the latest event is a payment,
 * BILL for an invoice sent or billed — "Mon Sep 21" over "2 days ago · sent".
 */
export type StripBillParts = StripLineParts & { label: 'Bill' | 'Paid' }

export function stripBillParts(detail: { ymd: string; labels: readonly string[] }, todayYmd: string): StripBillParts {
  const paid = detail.labels.includes('Payment recorded')
  const fact = paid ? 'paid' : detail.labels.includes('Invoice sent') ? 'sent' : 'billed'
  return { label: paid ? 'Paid' : 'Bill', main: formatStripDate(detail.ymd), sub: joinSub(stripDistancePhrase(detail.ymd, todayYmd), fact) }
}

/**
 * The field line where there is no strip (the Job Summary header's old `j:`):
 * the later of the last approved clock day and the last booked day, worked
 * or booked, with the distance — "Tue Sep 22" over "yesterday · worked".
 */
export function stripFieldParts(lastWorkDate: string | null | undefined, lastScheduleWorkDate: string | null | undefined, todayYmd: string): StripLineParts | null {
  const w = ymdOf(lastWorkDate)
  const b = ymdOf(lastScheduleWorkDate)
  if (!w && !b) return null
  const worked = Boolean(w) && (!b || (w as string) >= (b as string))
  const ymd = (worked ? w : b) as string
  return { main: formatStripDate(ymd), sub: joinSub(stripDistancePhrase(ymd, todayYmd), worked ? 'worked' : 'booked') }
}

/** "Thu Sep 17 · worked" / "Thu Sep 17 · booked, no hours" / "never". */
export function formatStripLast(lastYmd: string | null, lastKind: 'worked' | 'scheduled' | null): string {
  if (!lastYmd) return 'never worked'
  if (lastKind === 'scheduled') return `${formatStripDate(lastYmd)} · booked, no hours`
  return `${formatStripDate(lastYmd)} · worked`
}

/** One sentence for the strip's hover / screen-reader label. */
export function describeStagesWhen(when: StagesWhen): string {
  if (when.kind === 'scheduled') {
    return `Next ${formatStripDate(when.nextYmd)} ${when.nextWindow} · ${when.nextNames.join(', ')}; ends ${formatStripEnds(when)}`
  }
  if (when.kind === 'done') {
    return when.lastYmd ? `Done — last visit ${formatStripDate(when.lastYmd)}` : 'Done — nothing on the calendar'
  }
  return when.lastYmd ? `Not scheduled — last ${formatStripLast(when.lastYmd, when.lastKind)}` : 'Not scheduled — never worked'
}
