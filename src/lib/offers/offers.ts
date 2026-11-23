/**
 * Today's sends (v2.5595, punch list #115 PR 4; the plan `to-dos/tell-the-customer/README.md`). The app's own texts
 * become offers: the morning run prepares the words for a step the owner set to *offers* and writes them to
 * `nudge_offers`; the office presses each on the Dashboard, or all that are ready, and a held one says why. The office
 * can also prepare a text itself for a morning (Send in the morning on the Tell the customer sheet), which the run sends
 * on that day. Pure: the rows as the window reads them, ready against held, the line and the words, and the morning an
 * office-made text goes. The reads and the writes are `offersIo.ts`; the window is
 * `components/dashboard/TodaysSendsWindow.tsx`; the run's side is `flows/nudgeDispatch.ts` (`NudgeOffer`, `OFFER_HELD`).
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'
import { OFFER_HELD } from '../flows/nudgeDispatch'
import { RUN_HOUR } from '../flows/nudgeRunLog'
import { weekdayDate } from '../gc/words'
import { jobRefOf } from '../messages/jobKeys'
import { needsRatingLink } from '../ratings/ratingAsk'
import { plainSentence, val } from '../valuesInPlace'
import { SEND_LATER_WORDS, shortWhen } from './sendLater'

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
  /** When it was written, ISO: the Dashboard's row says how long the oldest has waited. */
  preparedAt: string
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

/** The step whose reminder asks for money: Paid, in every flow that has one. */
export const PAY_STEP_KEY = 'paid'

/** Why a pay reminder waits when an in kind arrangement pays its job's bills (v2.8277, punch list #301): the reason, and the door. */
export const HELD_IN_KIND = 'An in kind arrangement pays this job’s bills. Put this one away with Not this one.'

/** The Pipeline job the app's own pay reminder asks about. Null for any other step, and for a text the office wrote itself. */
const payJobOf = (o: OfferRow): string | null => {
  if (o.preparedBy !== 'app' || o.stepKey !== PAY_STEP_KEY) return null
  const ref = jobRefOf(o.jobKey)
  return ref?.kind === 'pipeline' ? ref.id : null
}

/** The Pipeline jobs of the app's open pay reminders, once each: the jobs whose arrangement the window reads (v2.8277). */
export function payJobsOf(offers: readonly OfferRow[]): string[] {
  return [...new Set(offers.flatMap((o) => (payJobOf(o) ? [payJobOf(o)!] : [])))]
}

/**
 * Work paid in kind (v2.8277, punch list #301): since v2.8219 the morning run prepares no pay reminder for a job an in
 * kind arrangement pays, since its bill has no due day. One prepared before the job went on the arrangement stayed open
 * and, with a number on file, ready: Send all would have texted a customer to pay a bill a credit pays down. The window
 * holds it with its door, over any hold the run gave it, since adding a number is not the fix. Only the app's own
 * reminder is held. A text a person wrote for the Paid step is their call, as Remind now is on the step's card.
 */
export function withInKindHolds(offers: readonly OfferRow[], onDeal: ReadonlySet<string>): OfferRow[] {
  return offers.map((o) => {
    const jobId = payJobOf(o)
    return jobId && onDeal.has(jobId) ? { ...o, heldWhy: HELD_IN_KIND } : o
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
      preparedAt: o.preparedAt,
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

/** A held text's cause in a word or two, for a chip. The window says the whole reason and its door. */
export function heldCause(held: string): string {
  if (held.startsWith(HELD_NO_NUMBER)) return 'no number'
  if (/sent STOP\./.test(held)) return 'sent STOP'
  if (held.startsWith(OFFER_HELD['prefers email'])) return 'wants email'
  if (held === OFFER_HELD.answered) return 'already answered'
  if (held === HELD_IN_KIND) return 'paid in kind'
  if (held === HELD_NEWER) return 'a newer text waits'
  if (held.startsWith('A text for this step already went')) return 'already sent'
  if (held.startsWith('This text names a visit')) return 'the visit has passed'
  if (held.startsWith('The line still has')) return 'a blank to fill'
  return 'see why'
}

/** A chip on the Dashboard's row: a timed text with its time, a held text with its cause, or how long the oldest has waited. */
export interface TodaysSendsChip {
  kind: 'timed' | 'held' | 'old'
  /** Its words, each value marked with `val`. */
  text: string
}

/**
 * The Dashboard's row (punch list #424). Until it the row read *Today's sends* over *3 texts ready to send, 1 goes
 * later, 1 held*, with **Open**: a place for a title, counts with no names, and *held* with no cause. The row is
 * built from the texts themselves, so it shows them: how many can go, who they go to, a timed text's time and a held
 * text's cause. Every value is marked with `val`, so the card draws it apart from the fixed words.
 */
export interface TodaysSendsNeed {
  /** The number in the title: the texts that can go, else the held, else the timed. */
  count: number
  /** *⟪3⟫ texts to send*. */
  title: string
  /** Who they go to: up to `NAMES_SHOWN` names and how many more. One text names its step too. */
  names: string
  /** The words of the text itself, when exactly one can go. */
  peek: string | null
  chips: TodaysSendsChip[]
  /** The press's words. It opens the window and sends nothing. */
  press: string
  /** Grey when nothing on the row needs a person: only timed texts wait. */
  severity: 'amber' | 'gray'
  /** The names and the chips as one plain line, for a place that draws no values apart. */
  detail: string
}

/** The names a row shows before it counts the rest. */
export const NAMES_SHOWN = 3
/** The held texts a row names, each with its cause, when none can go. */
export const HELD_SHOWN = 2
/** A text that has waited this many days puts its age on the row. */
export const OLD_FROM_DAYS = 2

const texts = (n: number) => (n === 1 ? 'text' : 'texts')

function namesOf(rows: readonly TodaysSend[]): string {
  const unique = [...new Set(rows.map((r) => r.who))]
  const shown = unique.slice(0, NAMES_SHOWN).map((w) => val('who', w))
  // The count of the rest holds to the last name with spaces that do not break, so *+2* never starts a line by itself.
  return unique.length > NAMES_SHOWN ? `${shown.join(' · ')}\u00a0·\u00a0${val('more', `+${unique.length - NAMES_SHOWN}`)}` : shown.join(' · ')
}

const dayNumber = (ymd: string) => Math.round(Date.parse(`${ymd}T12:00:00Z`) / 86_400_000)

/** Whole days the oldest of these texts has waited, on the company's calendar. */
function oldestDays(rows: readonly TodaysSend[], now: Date): number {
  const today = dayNumber(todayYmdInAppTz(now))
  return rows.reduce((most, r) => {
    const day = calendarYmdInAppTzFromIso(r.preparedAt)
    return day ? Math.max(most, today - dayNumber(day)) : most
  }, 0)
}

/** When a timed text goes: *Tue 9:00 AM*, or the morning's day. */
function goesWhen(r: Pick<TodaysSend, 'goesOn' | 'goesAt'>, nowMs: number): string {
  return r.goesAt != null ? shortWhen(r.goesAt, nowMs) : weekdayDate(r.goesOn)
}

export function todaysSendsNeed(rows: readonly TodaysSend[], now: Date = new Date()): TodaysSendsNeed | null {
  if (!rows.length) return null
  const nowMs = now.getTime()
  const ready = readyRows(rows)
  const held = rows.filter((r) => r.held)
  const timed = rows.filter((r) => r.goesOn && !r.held)
  const one = (r: TodaysSend) => `${val('who', r.who)} · ${r.step}`
  const timedChip = (): TodaysSendsChip[] =>
    timed.length === 0 ? [] : [{ kind: 'timed', text: timed.length === 1 ? `${val('n', '1')} · ${val('when', goesWhen(timed[0]!, nowMs))}` : `${val('n', String(timed.length))} timed` }]
  const done = (need: Omit<TodaysSendsNeed, 'detail'>): TodaysSendsNeed => ({ ...need, detail: [need.names, ...need.chips.map((c) => c.text)].filter(Boolean).map(plainSentence).join(' · ').replace(/\u00a0/g, ' ') })

  if (ready.length > 0) {
    const days = oldestDays(ready, now)
    return done({
      count: ready.length,
      title: `${val('n', String(ready.length))} ${texts(ready.length)} to send`,
      names: ready.length === 1 ? one(ready[0]!) : namesOf(ready),
      peek: ready.length === 1 ? ready[0]!.body.trim() : null,
      chips: [
        ...(days >= OLD_FROM_DAYS ? [{ kind: 'old' as const, text: `oldest ${val('age', `${days} days`)}` }] : []),
        ...timedChip(),
        ...(held.length === 0 ? [] : [{ kind: 'held' as const, text: held.length === 1 ? `${val('n', '1')} held · ${val('why', heldCause(held[0]!.held ?? ''))}` : `${val('n', String(held.length))} held` }]),
      ],
      press: ready.length === 1 ? 'Read it' : 'Read them',
      severity: 'amber',
    })
  }
  if (held.length > 0) {
    return done({
      count: held.length,
      title: `${val('n', String(held.length))} ${texts(held.length)} cannot go`,
      names: '',
      peek: null,
      chips: [
        ...held.slice(0, HELD_SHOWN).map((r) => ({ kind: 'held' as const, text: `${val('who', r.who)} · ${val('why', heldCause(r.held ?? ''))}` })),
        ...(held.length > HELD_SHOWN ? [{ kind: 'held' as const, text: val('more', `+${held.length - HELD_SHOWN}`) }] : []),
        ...timedChip(),
      ],
      press: held.length === 1 ? 'Fix it' : 'Fix them',
      severity: 'amber',
    })
  }
  return done({
    count: timed.length,
    title: timed.length === 1 ? `${val('n', '1')} text goes ${val('when', goesWhen(timed[0]!, nowMs))}` : `${val('n', String(timed.length))} texts go later`,
    names: timed.length === 1 ? one(timed[0]!) : namesOf(timed),
    peek: null,
    chips: [],
    press: timed.length === 1 ? 'See it' : 'See them',
    severity: 'gray',
  })
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
