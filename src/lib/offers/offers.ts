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
import { weekdayDate } from '../gc/words'
import { jobRefOf } from '../messages/jobKeys'
import { needsRatingLink } from '../ratings/ratingAsk'
import { SEND_LATER_WORDS } from './sendLater'

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
  /** An office-made offer handed to a time (v2.6774, Send later): the instant it goes, ISO; null when the morning's or waiting for a press. */
  sendAt?: string | null
  /** The day the words are about, a moved visit's new day (YYYY-MM-DD, v2.6387); null for a text about no day. */
  aboutOn: string | null
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
  /** Handed to a time (v2.6774): the instant the run sends it, in milliseconds; null for the morning's or a press. */
  goesAt: number | null
  /** The office prepared it, so its time can change (`nudge_offer_retime`). */
  office: boolean
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

/** The Pipeline job a review offer asks about, while its words still wait on the rating link. */
const rateJobOf = (o: OfferRow): string | null => {
  if (!needsRatingLink(o.body)) return null
  const ref = jobRefOf(o.jobKey)
  return ref?.kind === 'pipeline' ? ref.id : null
}

/** The Pipeline jobs of the offers still waiting on their rating link, once each: the jobs whose asks the window reads (v2.6007). */
export function rateJobsOf(offers: readonly OfferRow[]): string[] {
  return [...new Set(offers.flatMap((o) => (rateJobOf(o) ? [rateJobOf(o)!] : [])))]
}

/**
 * Customer reviews (v2.6007, punch list #185): a review offer on a job the customer answered already is held with its
 * door, over any hold the run gave it, so Send all skips it and a press is never a fresh ask. The rule is
 * `ratings/ratingAsk.ts`'s, the same the morning run keeps; the window reads the answered jobs through `answeredJobs`.
 */
export function withAnsweredHolds(offers: readonly OfferRow[], answered: ReadonlySet<string>): OfferRow[] {
  return offers.map((o) => {
    const jobId = rateJobOf(o)
    return jobId && answered.has(jobId) ? { ...o, heldWhy: OFFER_HELD.answered } : o
  })
}

/** A reminder that went on a step (`nudge_sent`), as the window reads it: whose, the step, the job and when. */
export interface SentRow {
  contactId: string
  stepKey: string
  jobKey: string | null
  /** ISO timestamp. */
  sentAt: string
}

/** Why a text waits when its step already got one after it was prepared (v2.6386): the day it went, and the door. */
export function heldSentWords(sentAtIso: string): string {
  return `A text for this step already went to them on ${weekdayDate(todayYmdInAppTz(new Date(sentAtIso)))}. Put this one away with Not this one.`
}

/** Why the older of two open texts on one step and job waits (v2.6386): a visit moved twice makes two. */
export const HELD_NEWER = 'A newer text for this step is on this list. Put this one away with Not this one.'

/**
 * Already texted (v2.6386): the morning run keeps a step back when a reminder went inside its days (`sentLately`) and
 * when a text for it already waits (`offeredAlready`), but an office-made offer — a moved visit's, Send in the morning's
 * — took neither road, so it sat ready after the step's text went another way: the run's own text, Remind now from the
 * thread's step card, or another offer on the same step pressed. The window holds such an offer with the day and the
 * door, and holds the older of two open offers on one step and job (a visit moved twice). A text that went is the fact
 * that matters, so this hold wins over the run's own.
 */
export function withSentHolds(offers: readonly OfferRow[], sent: readonly SentRow[]): OfferRow[] {
  const sameStep = (a: Pick<OfferRow, 'contactId' | 'stepKey' | 'jobKey'>, b: Pick<OfferRow, 'contactId' | 'stepKey' | 'jobKey'>) => a.contactId === b.contactId && a.stepKey === b.stepKey && (a.jobKey ?? null) === (b.jobKey ?? null)
  return offers.map((o) => {
    const went = sent.filter((s) => sameStep(s, o) && s.sentAt > o.preparedAt).sort((a, b) => a.sentAt.localeCompare(b.sentAt))[0]
    if (went) return { ...o, heldWhy: heldSentWords(went.sentAt) }
    const newer = offers.some((x) => x.id !== o.id && sameStep(x, o) && (x.preparedAt > o.preparedAt || (x.preparedAt === o.preparedAt && x.id > o.id)))
    return newer ? { ...o, heldWhy: HELD_NEWER } : o
  })
}

/** Why a text about a day that has passed waits (v2.6387): the day, and the door. The run puts it away the next morning. */
export function heldStaleWords(aboutOn: string): string {
  return `This text names a visit on ${weekdayDate(aboutOn)}. That day has passed. Put this one away with Not this one.`
}

/** A text about a day before today is stale (v2.6387): the words would tell the customer about a visit behind them. */
export function staleOn(o: Pick<OfferRow, 'aboutOn'>, todayYmd: string): boolean {
  return Boolean(o.aboutOn && o.aboutOn < todayYmd)
}

/**
 * The rows: the ready ones first, then the morning's, then the held, each set by name. A text about a day that has
 * passed is held first of all (v2.6387), over the run's own hold: there is nothing to fix on it.
 */
export function todaysSends(input: TodaysSendsInput, now: Date = new Date()): TodaysSend[] {
  const today = todayYmdInAppTz(now)
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
      held: (staleOn(o, today) && o.aboutOn ? heldStaleWords(o.aboutOn) : null) || o.heldWhy?.trim() || (o.channelId ? null : HELD_NO_NUMBER),
      goesOn: o.sendOn,
      goesAt: o.sendAt ? (Number.isNaN(Date.parse(o.sendAt)) ? null : Date.parse(o.sendAt)) : null,
      office: o.preparedBy === 'office',
    }),
  )
  const rank = (r: TodaysSend) => (r.held ? 2 : r.goesOn ? 1 : 0)
  return rows.sort((a, b) => rank(a) - rank(b) || a.who.localeCompare(b.who))
}

/**
 * The words the office reads when a press is refused because the step is not on the person's flow (`stepUnknown`
 * from `flow_step_check`, v2.6385): the step, the person and the door. Every other failure keeps its own words. Since
 * the push of `20261102193000` a residential customer's step is found, so this is left for a step the office took off
 * the flow after the text was prepared.
 */
export function offerRefusalWords(message: string, row: Pick<TodaysSend, 'step' | 'who'>): string {
  if (!/stepUnknown/.test(message)) return message
  return `The step ${row.step} is not on ${row.who}’s flow, so there is nothing to stop or hold. Put this text away with Not this one.`
}

/** The rows a press sends now: not held, and not handed to a morning. */
export function readyRows(rows: readonly TodaysSend[]): TodaysSend[] {
  return rows.filter((r) => !r.held && !r.goesOn)
}

/**
 * The Dashboard's line: "3 texts ready to send", "1 text ready to send, 1 goes in the morning, 2 held", "2 held". Since
 * v2.6774 a text handed to a time counts as "goes later", and the whole group reads so once any row has a time.
 */
export function todaysSendsLine(rows: readonly TodaysSend[]): string {
  const ready = readyRows(rows).length
  const held = rows.filter((r) => r.held).length
  const waiting = rows.filter((r) => r.goesOn && !r.held)
  const later = waiting.some((r) => r.goesAt != null)
  const parts: string[] = []
  if (ready) parts.push(`${ready} ${ready === 1 ? 'text' : 'texts'} ready to send`)
  if (waiting.length) parts.push(`${waiting.length} ${waiting.length === 1 ? 'goes' : 'go'} ${later ? 'later' : 'in the morning'}`)
  if (held) parts.push(`${held} held`)
  return parts.join(', ')
}

/** The row's line under a waiting text (v2.6774): "Goes Tue 9:00 AM" with a time, "Goes in the morning of Tue, Oct 20." without. */
export function goesLine(row: Pick<TodaysSend, 'goesOn' | 'goesAt'>, nowMs: number): string | null {
  if (row.goesAt != null) return SEND_LATER_WORDS.rowGoes(row.goesAt, nowMs)
  return row.goesOn ? TODAYS_SENDS_WORDS.goesOn(weekdayDate(row.goesOn)) : null
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
  /** Send later (v2.6774): the row's press to change the time (the toast is `SEND_LATER_WORDS.timeChanged`), and the press that takes a waiting text back. */
  changeTime: SEND_LATER_WORDS.changeTime,
  takeBack: 'Take it back',
} as const
