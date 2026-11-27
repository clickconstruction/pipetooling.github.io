/**
 * Taking today's goals check back (punch list #443, row 19): the take-back of **Continue to app**.
 *
 * After a person's first clock in of a day the app covers itself with that person's goals
 * (`DailyGoalsGateOverlay`). **Continue to app** writes one `user_daily_goals_ack` row for the person and the day
 * (`upsertDailyGoalsAck`), and the check does not come again that day, on any device. Nothing took the row back, so
 * a walk that clocked in on the dev's own account used up that account's check for the day. The table has let a
 * person manage their own row since the baseline (*Users manage own daily goals ack*, one policy for every
 * statement, the person's own `user_id`), and nothing called a delete. This is the rule for the press that does.
 * Pure: the reads and the delete are `goalsCheckTakeBackIo.ts`, the block is
 * `components/settings/GoalsCheckTakeBackBlock.tsx`.
 *
 * - The block is drawn for a dev and for nobody else. View as a sample account is that account, so it draws nothing.
 * - It takes back the signed-in person's own row and no other: the read and the delete name that one `user_id`, and
 *   the table's policy lets nobody reach another person's.
 * - It takes back today alone. *Today* is two days when a device's clock sits in another time zone: the gate reads
 *   the device's own day when the app loads and the company's day at a clock in (`DailyGoalsGateContext`,
 *   `ClockInOutButton`), and the row is written under whichever asked. `goalsCheckDays` is both, once each.
 * - Nothing else changes. The goals stay and the clock sessions stay.
 *
 * When the check asks again is the gate's own rule and is not changed here (`dailyGoalsGate.ts`): with a clock
 * session today it asks at the next load of the app, and with none it asks after the first clock in. The block says
 * which of the two holds, because a walk that leaves its session standing meets the check at once.
 */
import { formatWorkDateYmdWeekdayShortFriendly } from '../utils/dateUtils'
import { plainSentence, val } from './valuesInPlace'

/** Who is offered the block: a dev. Every other role sees nothing new. */
export function goalsCheckTakeBackDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** The days that are *today* to the gate: the company's day and the device's own, once each, the company's first. */
export function goalsCheckDays(appDay: string, deviceDay: string): string[] {
  const days: string[] = []
  for (const day of [appDay, deviceDay]) {
    const d = (day ?? '').trim()
    if (YMD.test(d) && !days.includes(d)) days.push(d)
  }
  return days
}

/** One record that the check was passed: its day, and when **Continue to app** was pressed. */
export interface GoalsCheckAck {
  localDate: string
  completedAtIso: string | null
}

/** What the block reads about the signed-in person's own day. */
export interface GoalsCheckToday {
  /** The person's own records for today. One, unless the device's day and the company's differ. */
  acks: ReadonlyArray<GoalsCheckAck>
  /** How many goals the person has. With none the check never asks. */
  goals: number
  /** How many clock sessions the person has today. */
  sessions: number
}

/** Why today's check cannot be taken back; '' when it can. `today` is null when it could not be read. */
export function goalsCheckTakeBackProblem(role: string | null | undefined, today: GoalsCheckToday | null | undefined): string {
  if (!goalsCheckTakeBackDrawn(role)) return 'Only a developer takes a goals check back.'
  if (!today) return 'Today’s check could not be read. Nothing was taken back.'
  if (today.acks.length === 0) return 'You have not passed today’s check, so there is nothing to take back.'
  return ''
}

/** A count and its noun: *1 clock session*, *2 clock sessions*. */
const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * When the check asks again once today's record is gone, by the gate's own rule. The count is marked with `val`, so
 * the block draws it apart from the words.
 */
export function goalsCheckAsksAgain(today: Pick<GoalsCheckToday, 'goals' | 'sessions'>): string {
  if (today.goals <= 0) return 'You have no goals, so the check does not ask.'
  if (today.sessions > 0) return `You have ${val('sessions', counted(today.sessions, 'clock session', 'clock sessions'))} today, so the check asks again the next time the app loads.`
  return 'You have no clock session today, so the check asks again after your first clock in.'
}

/** A day as the block and the confirm say it: *Thu, Nov 26*. */
export function goalsCheckDayWords(ymd: string): string {
  return formatWorkDateYmdWeekdayShortFriendly(ymd)
}

/** Several days in one line: *Thu, Nov 26 and Fri, Nov 27*. */
function daysWords(acks: ReadonlyArray<GoalsCheckAck>): string {
  const days = acks.map((a) => goalsCheckDayWords(a.localDate))
  return days.length <= 1 ? days.join('') : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`
}

/** The confirm window's words. The button names the act, and the message says what goes and what stays. */
export function goalsCheckTakeBackConfirm(today: GoalsCheckToday): { title: string; message: string; confirmLabel: string } {
  return {
    title: 'Take today’s goals check back?',
    message: `This deletes your own record that you passed the check on ${daysWords(today.acks)}. Your goals and your clock sessions stay. ${plainSentence(goalsCheckAsksAgain(today))}`,
    confirmLabel: 'Take the check back',
  }
}

/** What the toast says once the record is gone. */
export const GOALS_CHECK_TAKEN_BACK = 'Today’s goals check was taken back.'

/** What the delete says when it reaches no row. */
export const GOALS_CHECK_NOT_TAKEN_BACK = 'The check was not taken back. Its record may be gone already. Read it again.'
