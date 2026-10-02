/**
 * The phone reminder for a bid's call-again day (v2.4427, punch list #80): the pure rules.
 * `remind-bid-followups` reads the rows and sends; this decides what is due, who is told and
 * what the notification says. Tested from `src/lib/bids/bidFollowupReminder.test.ts`, which
 * also pins `followupDayStandsOnServer` to the app's own rule (`bidNextFollowup.ts`).
 */
import { APP_CALENDAR_TZ } from './appTimeZone.ts'

/** The office hour, 0 to 23, from which the morning reminder may go out. */
export const BID_FOLLOWUP_REMINDER_HOUR = 8

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The civil day of an instant in the office's time zone; '' when it is no instant. */
export function officeYmd(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}`
}

/** The office's hour of the day, 0 to 23. */
export function officeHour(now: Date): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).find((p) => p.type === 'hour')?.value ?? '0'
  return Number(h) % 24
}

/** A picked day stands until a contact is logged on or after it (the app's `followupDayStands`). */
export function followupDayStandsOnServer(nextYmd: string | null | undefined, lastContactIso: string | null | undefined): boolean {
  if (!nextYmd || !YMD.test(nextYmd)) return false
  const contact = officeYmd(lastContactIso)
  return !contact || nextYmd > contact
}

export type BidFollowupReminderRow = {
  id: string
  bid_date_sent: string | null
  outcome: string | null
  last_contact: string | null
  adopted_into_bid_id: string | null
  next_followup_on: string | null
  account_manager_id: string | null
  estimator_id: string | null
  created_by: string | null
}

/**
 * Due for its one reminder: a sent bid with no answer, its own picked day here or passed and
 * still standing, not a robot's bid, and not already reminded for that day.
 */
export function bidDueForReminder(
  row: BidFollowupReminderRow,
  todayYmd: string,
  ctx: { remindedDays: ReadonlySet<string>; twinUserIds: ReadonlySet<string> },
): boolean {
  if (row.outcome != null || !row.bid_date_sent || row.adopted_into_bid_id) return false
  if (!followupDayStandsOnServer(row.next_followup_on, row.last_contact)) return false
  if ((row.next_followup_on as string) > todayYmd) return false
  if ((row.estimator_id && ctx.twinUserIds.has(row.estimator_id)) || (row.created_by && ctx.twinUserIds.has(row.created_by))) return false
  return !ctx.remindedDays.has(reminderKey(row.id, row.next_followup_on as string))
}

/** One reminder per bid and day: a day moved later is a new day and reminds again. */
export function reminderKey(bidId: string, dueYmd: string): string {
  return `${bidId}:${dueYmd}`
}

/** Who is told: the bid's account manager, else its estimator, else whoever set the day. */
export function reminderRecipientId(row: Pick<BidFollowupReminderRow, 'account_manager_id' | 'estimator_id'>, setByUserId: string | null): string | null {
  return row.account_manager_id ?? row.estimator_id ?? setByUserId ?? null
}

/** "Jan 5" for a civil day. */
function monthDay(ymd: string): string {
  const m = YMD.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}`
}

/** The notification's words. The body names the builder, the bid and who to ask for. */
export function bidFollowupReminderMessage(args: {
  bidLabel: string
  projectName: string | null
  builderName: string | null
  personName: string | null
  dueYmd: string
  todayYmd: string
}): { title: string; body: string } {
  const late = args.dueYmd < args.todayYmd
  const title = late ? `Bid follow-up was due ${monthDay(args.dueYmd)}` : 'Bid follow-up due today'
  const builder = (args.builderName ?? '').trim()
  const bid = [args.bidLabel.trim(), (args.projectName ?? '').trim()].filter(Boolean).join(' ')
  const who = [builder, bid].filter(Boolean).join(', ') || 'A bid'
  const person = (args.personName ?? '').trim()
  return { title, body: `${who}.${person ? ` Ask for ${person}.` : ''}` }
}
