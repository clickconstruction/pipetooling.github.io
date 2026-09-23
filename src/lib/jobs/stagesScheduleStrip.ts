import { scheduleDateKeyAddDays, scheduleParseDateKeyLocal } from '../jobScheduleChicago'
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
  today: boolean
  /** Before today (not booked): drawn fainter — the strip does not yet know what happened. */
  past: boolean
  /** First cell of the second week — carries the visual week break. */
  weekStart: boolean
  weekend: boolean
}

export type StagesStrip = {
  cells: StagesStripCell[]
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
export function buildTwoWeekStrip(args: { todayYmd: string; bookedYmds: readonly string[] }): StagesStrip {
  const start = stripWeekStartYmd(args.todayYmd)
  const booked = new Set(args.bookedYmds.filter((y) => /^\d{4}-\d{2}-\d{2}$/.test(y)))
  if (!start) return { cells: [], laterCount: booked.size, bookedInWindow: 0 }
  const cells: StagesStripCell[] = []
  let bookedInWindow = 0
  let endYmd = start
  for (let i = 0; i < 14; i++) {
    const ymd = scheduleDateKeyAddDays(start, i)
    if (!ymd) continue
    endYmd = ymd
    const dow = i % 7
    const weekend = dow >= 5
    const isBooked = booked.has(ymd)
    if (weekend && !isBooked) continue
    if (isBooked) bookedInWindow++
    cells.push({
      ymd,
      letter: LETTERS[dow]!,
      booked: isBooked,
      today: ymd === args.todayYmd,
      past: ymd < args.todayYmd && !isBooked,
      weekStart: i === 7,
      weekend,
    })
  }
  let laterCount = 0
  for (const y of booked) if (y > endYmd) laterCount++
  return { cells, laterCount, bookedInWindow }
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
 * The column's two-line shape: a main fact on the label's line, a shorter
 * sub-fact under it. The Crew & Dates column has ~80 px beside a 30 px label,
 * so a date and a window never share a line.
 */
export type StripLineParts = { main: string; sub: string | null }

/** NEXT: "Fri Sep 25" / "8 AM–12 PM". */
export function stripNextParts(when: Extract<StagesWhen, { kind: 'scheduled' }>): StripLineParts {
  return { main: formatStripDate(when.nextYmd), sub: when.nextWindow }
}

/** ENDS: "same day" (one visit, nothing under it) / "Fri Sep 25" over "3 visits". */
export function stripEndsParts(when: Extract<StagesWhen, { kind: 'scheduled' }>): StripLineParts {
  if (when.endsYmd === when.nextYmd) return { main: 'same day', sub: when.visits > 1 ? `${when.visits} visits` : null }
  return { main: formatStripDate(when.endsYmd), sub: `${when.visits} visit${when.visits === 1 ? '' : 's'}` }
}

/** LAST: "Tue Sep 22" over "worked" / "booked, no hrs"; "never worked" alone. */
export function stripLastParts(lastYmd: string | null, lastKind: 'worked' | 'scheduled' | null): StripLineParts {
  if (!lastYmd) return { main: 'never worked', sub: null }
  return { main: formatStripDate(lastYmd), sub: lastKind === 'scheduled' ? 'booked, no hrs' : 'worked' }
}

/** DONE: "Mon Sep 21" over "last visit"; "nothing booked" alone. */
export function stripDoneParts(lastYmd: string | null): StripLineParts {
  return lastYmd ? { main: formatStripDate(lastYmd), sub: 'last visit' } : { main: 'nothing booked', sub: null }
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
