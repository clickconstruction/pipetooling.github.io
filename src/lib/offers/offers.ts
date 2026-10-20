/**
 * Today's sends (v2.5595, punch list #115 PR 4; the plan `to-dos/tell-the-customer/README.md`). The app's own texts
 * become offers: the morning run prepares the words for a step the owner set to *offers* and writes them to
 * `nudge_offers`; the office presses each on the Dashboard, or all that are ready, and a held one says why. The office
 * can also prepare a text itself for a morning (Send in the morning on the Tell the customer sheet), which the run sends
 * on that day. Pure: the rows as the window reads them, ready against held, the line and the words, and the morning an
 * office-made text goes. The reads and the writes are `offersIo.ts`; the window is
 * `components/dashboard/TodaysSendsWindow.tsx`; the run's side is `flows/nudgeDispatch.ts` (`NudgeOffer`, `OFFER_HELD`).
 */
import { APP_CALENDAR_TZ, todayYmdInAppTz } from '../../utils/dateUtils'
import { OFFER_HELD } from '../flows/nudgeDispatch'
import { RUN_HOUR } from '../flows/nudgeRunLog'

/** A `nudge_offers` row as the office reads it. */
export interface OfferRow {
  id: string
  contactId: string
  /** The person's flow kind, so the step's name is their flow's; null when the contact did not read. */
  contactKind: string | null
  stepKey: string
  jobKey: string | null
  body: string
  channelId: string | null
  preparedAt: string
  preparedBy: 'app' | 'office'
  /** An office-made offer: the morning it goes (YYYY-MM-DD). */
  sendOn: string | null
  heldWhy: string | null
}

/** One row on Today's sends. */
export interface TodaysSend {
  id: string
  contactId: string
  /** "Dana Whitfield", or the number when the person has no name. */
  who: string
  /** The step's name in their flow, else its key. */
  step: string
  /** The step's key, for a hold or a stop. */
  stepKey: string
  body: string
  channelId: string | null
  jobKey: string | null
  /** Why it cannot go yet; null when it is ready to press. */
  held: string | null
  /** Prepared by the office for a morning: the day the run sends it. */
  goesOn: string | null
}

export interface TodaysSendsInput {
  offers: readonly OfferRow[]
  /** Each contact's name, by id. */
  names: Readonly<Partial<Record<string, string | null>>>
  /** Each number the offers go to, by channel id. */
  numbers: Readonly<Partial<Record<string, string>>>
  /** Each step's name, by `<kind>:<step key>`. */
  stepNames: Readonly<Partial<Record<string, string>>>
}

/** The words Today's sends shows on a prepared text with no number; the run's own (`OFFER_HELD`). */
export const HELD_NO_NUMBER = OFFER_HELD['no number']

/** The rows: the ready ones first, then the morning's, then the held, each set by name. */
export function todaysSends(input: TodaysSendsInput): TodaysSend[] {
  const rows = input.offers.map(
    (o): TodaysSend => ({
      id: o.id,
      contactId: o.contactId,
      who: input.names[o.contactId]?.trim() || (o.channelId ? (input.numbers[o.channelId] ?? 'A number') : 'Someone'),
      step: (o.contactKind ? input.stepNames[`${o.contactKind}:${o.stepKey}`] : undefined) ?? o.stepKey,
      stepKey: o.stepKey,
      body: o.body,
      channelId: o.channelId,
      jobKey: o.jobKey,
      held: o.heldWhy?.trim() || (o.channelId ? null : HELD_NO_NUMBER),
      goesOn: o.sendOn,
    }),
  )
  const rank = (r: TodaysSend) => (r.held ? 2 : r.goesOn ? 1 : 0)
  return rows.sort((a, b) => rank(a) - rank(b) || a.who.localeCompare(b.who))
}

/** The rows a press sends now: not held, and not handed to a morning. */
export function readyRows(rows: readonly TodaysSend[]): TodaysSend[] {
  return rows.filter((r) => !r.held && !r.goesOn)
}

/** The Dashboard's line: "3 texts ready to send", "1 text ready to send, 1 goes in the morning, 2 held", "2 held". */
export function todaysSendsLine(rows: readonly TodaysSend[]): string {
  const ready = readyRows(rows).length
  const held = rows.filter((r) => r.held).length
  const morning = rows.filter((r) => r.goesOn && !r.held).length
  const parts: string[] = []
  if (ready) parts.push(`${ready} ${ready === 1 ? 'text' : 'texts'} ready to send`)
  if (morning) parts.push(`${morning} ${morning === 1 ? 'goes' : 'go'} in the morning`)
  if (held) parts.push(`${held} held`)
  return parts.join(', ')
}

/** The hour in the app's zone, 0 to 23. */
function hourInAppTz(now: Date): number {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hour: '2-digit', hourCycle: 'h23' }).formatToParts(now).find((p) => p.type === 'hour')?.value
  return Number(hour) % 24
}

/** The morning an office-made text goes: today when the 9 AM run has not fired yet, else tomorrow (YYYY-MM-DD). */
export function morningSendOn(nowMs: number): string {
  const now = new Date(nowMs)
  if (hourInAppTz(now) < RUN_HOUR) return todayYmdInAppTz(now)
  return todayYmdInAppTz(new Date(nowMs + 24 * 60 * 60 * 1000))
}

export const TODAYS_SENDS_WORDS = {
  title: 'Today’s sends',
  hint: 'Prepared this morning from the flows, or by you for a morning. Press one, or all that are ready. A held one says why.',
  none: 'Nothing waits. The morning run prepares a text when a step is set to Offers in Flows.',
  send: 'Send',
  edit: 'Edit',
  save: 'Done editing',
  sendAll: (n: number) => `Send all ${n} that are ready`,
  notThisOne: 'Not this one',
  holdUntil: 'Hold until…',
  holdPick: 'Hold until',
  stop: 'Stop reminding on this job',
  goesOn: (day: string) => `Goes in the morning of ${day}.`,
  sent: (who: string) => `Sent to ${who}.`,
  sentAll: (n: number) => `${n} sent.`,
  someFailed: (n: number) => `${n} did not go. Each says why.`,
  held: (day: string) => `Held until ${day}.`,
  stopped: 'Stopped. The step will not remind them on this job.',
  putAway: 'Put away.',
  morningToast: (day: string) => `It goes in the morning of ${day}.`,
  sendInMorning: 'Send in the morning',
} as const
