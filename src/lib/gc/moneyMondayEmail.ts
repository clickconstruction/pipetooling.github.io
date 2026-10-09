/**
 * GC mode, Owner Billing's O7b: the Monday money email's weekly chains. A member of the money team asks for it for
 * themselves or each other. Each weekday is its own weekly chain of rows in gc_money_monday_email_requests, the
 * statement round's shape, so its grouping and its edit plan are reused as they are (`statementRoundEmail.ts`). Pure:
 * the reads and writes are gcIo's.
 */
import { groupStatementRoundChains, planStatementRoundChainEdit, type StatementRoundChainEditPlan, type StatementRoundChainGroup } from '../statementRoundEmail'

/** A pending send of the Monday money email. */
export interface MoneyMondayRequestRow {
  id: string
  requested_by: string
  recipient_user_id: string
  send_at: string
  repeat_weekly: boolean
}

/** One person's weekly chains: their weekdays (0 Sunday to 6 Saturday), the time in Central, and the rows. */
export type MoneyMondayChain = StatementRoundChainGroup

/** Each recipient's weekly chains. A one-off row is left out. */
export function moneyMondayChains(rows: readonly MoneyMondayRequestRow[]): MoneyMondayChain[] {
  return groupStatementRoundChains(rows)
}

/** A change to one person's chains as rows to add and rows to stop. No weekday stops them all. */
export function planMoneyMondayEdit(
  input: { requestedBy: string; recipientUserId: string; desiredWeekdays: number[]; desiredTimeHm: string; current: MoneyMondayChain | null },
  now: Date = new Date(),
): StatementRoundChainEditPlan {
  return planStatementRoundChainEdit(input, now)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Mon", "Mon and Thu", "Mon, Wed and Fri": Monday first. */
export function moneyMondayDaysWords(weekdays: readonly number[]): string {
  const names = [...new Set(weekdays)]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => DAYS[d] ?? '')
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** "7:00 AM" from "07:00"; the text as it came when it is not a time. */
export function moneyMondayTimeWords(timeHm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeHm.trim())
  if (!m) return timeHm
  const hour = Number(m[1])
  if (hour > 23) return timeHm
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${m[2]} ${hour < 12 ? 'AM' : 'PM'}`
}

/** "Grace gets it on Mon and Thu at 7:00 AM." or "You get it on Mon at 7:00 AM." */
export function moneyMondayChainWords(chain: MoneyMondayChain, name: string, isMe: boolean): string {
  const who = isMe ? 'You get' : `${name.trim() || 'Someone'} gets`
  return `${who} it on ${moneyMondayDaysWords(chain.weekdays)} at ${moneyMondayTimeWords(chain.timeHm)}.`
}
