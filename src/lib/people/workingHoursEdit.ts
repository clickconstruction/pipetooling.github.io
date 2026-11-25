/**
 * The Working hours row's field (punch list #429, PR 3): what the open line would save, said before Keep. A line
 * of days changes whole, its start and its end together, and every save is a whole week. For a salaried person a
 * change to a day's length moves pay: that starts this week, since pay carries no date, and needs a reason for the
 * pay log. A change of times alone moves no pay and may start next week. Taking the hours off a salaried person
 * puts their week on pay back on the standard week, which is a change to pay like any other (`workingHoursTakeOffPlan`).
 * Pure; the row draws it and the door (`set_working_hours`) holds the same rules.
 */
import { SALARIED_DEFAULT_WEEK, salariedWeekWords } from '../salariedEffectiveHours'
import { val } from '../valuesInPlace'
import type { Segment, WeekDays } from './weekAvailability'
import { formatHours, withWorkingDays, workingChangeSentence, workingHoursMovePay, workingHoursStarts, workingWeekHours, workingWeekProblem } from './workingHours'

/** A week with no hours on any day: what the row edits from when nobody has set hours. */
export const NO_WORKING_WEEK: WeekDays = [[], [], [], [], [], [], []]
/** The line a first-time field opens on when pay gives no week to start from: Monday to Friday, 7:00 AM to 3:00 PM. */
export const FIRST_WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5]
export const FIRST_WORKING_RANGE: Segment = [7 * 60, 15 * 60]

export type WorkingHoursFacts = {
  /** The set week in force today; null with no working hours. */
  current: WeekDays | null
  /** A salaried person: their pay follows the hours. */
  isSalary: boolean
  /** The seven hour numbers on pay, Sunday first; only read for a salaried person. */
  paidWeek: readonly number[] | null
  /** The person's first name, for the pay sentence. */
  firstName: string
  todayYmd: string
  /** The last day a pay report covers, for the weeks a pay change prices again. */
  lastReportEndYmd: string | null
}

/** The open field: one line's days, the ranges typed for them, when it starts and why. */
export type WorkingHoursOpen = {
  dows: readonly number[]
  segs: readonly Segment[]
  start: 'this' | 'next'
  reason: string
}

export type WorkingHoursFieldPlan = {
  /** The whole week a Keep would save. */
  week: WeekDays
  /** What the change comes to, values marked. */
  sentence: string
  /** What happens to pay, for a salaried person: `moves` is the warning, `stands` the reassurance. */
  pay: { moves: boolean; words: string } | null
  /** Pay moves, so the change starts this week whatever was picked. */
  startLocked: boolean
  /** The Sunday the save would start on. */
  effectiveFrom: string
  /** A reason is asked for, and Keep waits on it. */
  needsReason: boolean
  /** Whether Keep is live. `why` is the one thing to fix, or null when there is simply nothing to keep yet. */
  keep: { ok: true } | { ok: false; why: string | null }
}

const sameWeek = (a: WeekDays, b: WeekDays): boolean => a.length === b.length && a.every((segs, d) => segs.length === (b[d]?.length ?? 0) && segs.every(([s, e], i) => s === b[d]![i]![0] && e === b[d]![i]![1]))

/** Whole pay weeks since the last pay report: the weeks a change to pay prices again. 0 with no report on file. */
function weeksWithoutReport(lastReportEndYmd: string | null, todayYmd: string): number {
  if (!lastReportEndYmd) return 0
  const days = Math.floor((Date.parse(`${todayYmd}T12:00:00Z`) - Date.parse(`${lastReportEndYmd}T12:00:00Z`)) / 86_400_000)
  return days > 0 ? Math.floor(days / 7) : 0
}

export function workingHoursFieldPlan(facts: WorkingHoursFacts, open: WorkingHoursOpen): WorkingHoursFieldPlan {
  const base = facts.current ?? NO_WORKING_WEEK
  const week = withWorkingDays(base, open.dows, open.segs)
  const sentence = workingChangeSentence({ days: base, dows: open.dows, segs: open.segs })
  const moves = facts.isSalary && facts.paidWeek != null && workingHoursMovePay(week, facts.paidWeek)
  const starts = workingHoursStarts(facts.todayYmd)
  const effectiveFrom = moves || open.start === 'this' ? starts.thisWeek : starts.nextWeek

  let pay: WorkingHoursFieldPlan['pay'] = null
  if (facts.isSalary && facts.paidWeek != null) {
    if (moves) {
      const weeks = weeksWithoutReport(facts.lastReportEndYmd, facts.todayYmd)
      const reach = weeks > 0 ? ` ${weeks === 1 ? 'One earlier week has' : `${weeks} earlier weeks have`} no pay report, and will be priced at the new hours.` : ''
      pay = { moves: true, words: `${facts.firstName} is on a set week. Pay follows the hours, so the set week becomes ${val('hours', `${formatHours(workingWeekHours(week))} h`)}.${reach}` }
    } else {
      pay = { moves: false, words: 'Each day keeps its length, so pay does not move.' }
    }
  }

  const problem = workingWeekProblem(week)
  const changed = facts.current == null || !sameWeek(facts.current, week)
  let keep: WorkingHoursFieldPlan['keep']
  if (problem) keep = { ok: false, why: problem }
  else if (!changed) keep = { ok: false, why: null }
  else if (workingWeekHours(week) === 0) keep = { ok: false, why: 'Give at least one day its hours.' }
  else if (moves && !open.reason.trim()) keep = { ok: false, why: 'Say why first. The reason goes on the pay log.' }
  else keep = { ok: true }

  return { week, sentence, pay, startLocked: moves, effectiveFrom, needsReason: moves, keep }
}

/** What **Take working hours off** would do, said before the press. */
export type WorkingHoursTakeOffPlan = {
  /** The Sunday the take-off starts on: this week's, since a change to pay carries no date. */
  effectiveFrom: string
  /** A salaried person's week on pay goes back to the standard week. */
  movesPay: boolean
  /** Pay moves, so the window asks why and the reason goes on the pay log. */
  needsReason: boolean
  /** The window's words. */
  message: string
  /** The line the row says once it is done. */
  done: string
}

/**
 * Taking working hours off (punch list #429). For a salaried person whose week on pay is not the standard week,
 * the door puts the standard week back, 8 hours Monday to Friday: the hours that set the week are gone, so the week
 * goes with them, and it is never left at the hours last set or at no paid hours. That moves pay, so it asks for a
 * reason. Anyone else has no pay side to a take-off.
 */
export function workingHoursTakeOffPlan(facts: WorkingHoursFacts, displayName: string): WorkingHoursTakeOffPlan {
  const paid = facts.isSalary ? facts.paidWeek : null
  const movesPay = facts.current != null && paid != null && SALARIED_DEFAULT_WEEK.some((h, d) => Math.abs(h - (Number(paid[d]) || 0)) > 0.001)
  const standard = salariedWeekWords(SALARIED_DEFAULT_WEEK)
  const lines = [`Take working hours off ${displayName}?`, 'From this week nothing holds them to a start and an end.']
  if (movesPay && paid) {
    const weeks = weeksWithoutReport(facts.lastReportEndYmd, facts.todayYmd)
    lines.push(`Their set week on pay is ${salariedWeekWords(paid)} today.`, `It goes back to the standard week, ${standard}.`)
    if (weeks > 0) lines.push(`${weeks === 1 ? 'One earlier week has' : `${weeks} earlier weeks have`} no pay report, and will be priced at the standard week.`)
    lines.push('Say why. The reason goes on the pay log.')
  } else if (paid) {
    lines.push(`Their pay stays on the standard week, ${standard}.`)
  }
  lines.push('What the hours were is kept under Earlier hours.')
  return {
    effectiveFrom: workingHoursStarts(facts.todayYmd).thisWeek,
    movesPay,
    needsReason: movesPay,
    message: lines.join(' '),
    done: movesPay ? 'Working hours taken off. Pay is back on the standard week.' : 'Working hours taken off',
  }
}

/** "Sun Nov 22": the Sunday hours hold from, as the row prints it. */
export function workingSundayWords(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00Z`)
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCDate()}`
}
