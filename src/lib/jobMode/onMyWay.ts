/**
 * Job Mode's **On my way** and **I'm here** (v2.5573, punch list #112; the plan `to-dos/on-my-way/README.md`). The big
 * green button clocks the tech in on the next job as on the way and texts the customer the office's On my way line,
 * with the minutes guessed from the drive; while on the way it reads I'm here and stamps the arrival. Pure: the leg
 * from the open session's two stamps, which line each press sends, why a text cannot go, the guess and its rounding,
 * the past-the-window line, the session's note, the header's words and the sheet's rows. The reads and writes are
 * `jobModeOnMyWayIo.ts`; the sheets are `components/jobMode/OnMyWaySheet.tsx` and `ImHereSheet.tsx`.
 */
import { formatTravelMiles } from '../clockedInMapTravel'
import { estimateTravelBetween, TRAVEL_SAME_SITE_METERS, type LatLng } from '../jobTravelEstimate'
import { pgTimeToMinutes, scheduleFormatTimeHm } from '../jobScheduleChicago'
import type { PhoneLine } from '../quickReplies/phone'
import { PRESS_WORDS, type PhonePress } from '../quickReplies/press'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

export type { PhonePress } from '../quickReplies/press'

// ---------- the leg ----------

/** The open session's two stamps, as `clock_sessions` keeps them. */
export interface TravelFacts {
  travelStartedAt: string | null
  arrivedAt: string | null
}

/** Where the session is: on the way (the drive began, no arrival yet), on site (arrived), or unmarked (a row with no stamps). */
export type Leg = 'on-the-way' | 'on-site' | 'unmarked'

export function legOf(facts: TravelFacts | null | undefined): Leg {
  if (!facts) return 'unmarked'
  if (facts.arrivedAt) return 'on-site'
  if (facts.travelStartedAt) return 'on-the-way'
  return 'unmarked'
}

/** The drive in whole minutes: from the start of the drive to the arrival, or to now while on the way. Null with no start. */
export function driveMinutes(facts: TravelFacts | null | undefined, nowMs: number): number | null {
  const start = Date.parse(facts?.travelStartedAt ?? '')
  if (!Number.isFinite(start)) return null
  const end = facts?.arrivedAt ? Date.parse(facts.arrivedAt) : nowMs
  if (!Number.isFinite(end) || end < start) return 0
  return Math.round((end - start) / 60_000)
}

/** An instant as the phone's clock says it: "10:12 AM". */
export function clockHm(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/** The header's status line: *On the way · left 10:12 AM · 14 min*, *On site since 10:31 AM · 19 min drive*; null when unmarked. */
export function legWords(facts: TravelFacts | null | undefined, nowMs: number): string | null {
  const leg = legOf(facts)
  if (leg === 'unmarked' || !facts) return null
  const drive = driveMinutes(facts, nowMs)
  if (leg === 'on-the-way') return `On the way · left ${clockHm(facts.travelStartedAt!)} · ${drive ?? 0} min`
  const since = `On site since ${clockHm(facts.arrivedAt!)}`
  return drive == null ? since : `${since} · ${drive} min drive`
}

// ---------- the lines ----------

/** The line a press sends: the live team line for customers on the phone that holds the press. Null when the office named none. */
export function pressLine(lines: readonly PhoneLine[], press: PhonePress): PhoneLine | null {
  return lines.find((l) => l.phonePress === press && !l.removed && l.scope === 'team' && l.for === 'customer' && l.phoneOrder != null) ?? null
}

/** Why a text cannot go on this press, or null when it can. */
export type TextHold = 'not-offered' | 'no-customer' | 'texts-off' | 'no-line'

export function textHold(input: { offered: boolean; hasCustomer: boolean; textsOn: boolean; line: PhoneLine | null }): TextHold | null {
  if (!input.offered) return 'not-offered'
  if (!input.hasCustomer) return 'no-customer'
  if (!input.textsOn) return 'texts-off'
  if (!input.line) return 'no-line'
  return null
}

/** The hold as the sheet's row says it. */
export function holdWords(hold: TextHold, press: PhonePress): string {
  switch (hold) {
    case 'not-offered':
      return 'No text: your role does not text from the phone.'
    case 'no-customer':
      return 'No text: this job has no customer yet.'
    case 'texts-off':
      return 'No text: texts are off. The owner or a dev turns them on in Settings → Phone and texts.'
    case 'no-line':
      return `No text: the office has no ${PRESS_WORDS[press]} line on the phone.`
  }
}

// ---------- the guess ----------

/** The minutes round up to the next five, so the guess errs early; never under five. */
export const GUESS_STEP = 5

export interface DriveGuess {
  /** Rounded up to the next five. */
  minutes: number
  /** Straight line × the road winding factor. */
  meters: number
  /** Under the Day view's same-site tolerance: no drive to text. */
  sameSite: boolean
}

/** The drive from the phone to the job, from the straight line; null when either point is unknown. */
export function guessDrive(me: LatLng | null, job: LatLng | null): DriveGuess | null {
  if (!me || !job) return null
  const est = estimateTravelBetween(me, job)
  const sameSite = est.meters < TRAVEL_SAME_SITE_METERS
  const minutes = Math.max(GUESS_STEP, Math.ceil(est.minutes / GUESS_STEP) * GUESS_STEP)
  return { minutes, meters: est.meters * 1.3, sameSite }
}

/** A typed number of minutes, or null for anything that is not one to a few hundred. */
export function minutesOf(text: string): number | null {
  const n = Number(text.trim())
  return Number.isInteger(n) && n >= 1 && n <= 600 ? n : null
}

/** The minutes after a − or + press: steps of five, never under one. */
export function stepMinutes(current: number | null, direction: -1 | 1): number {
  const base = current ?? GUESS_STEP
  const next = direction > 0 ? Math.floor(base / GUESS_STEP) * GUESS_STEP + GUESS_STEP : Math.ceil(base / GUESS_STEP) * GUESS_STEP - GUESS_STEP
  return Math.max(1, next)
}

/** The miles under the guess: "9.4 mi". */
export function guessMiles(guess: DriveGuess): string {
  return formatTravelMiles(guess.meters)
}

// ---------- the window ----------

/** The phone's clock as minutes past midnight in the app's calendar day. */
export function nowMinutesInAppTz(nowMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: APP_CALENDAR_TZ }).formatToParts(new Date(nowMs))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

const hmOf = (minutes: number) => scheduleFormatTimeHm(`${Math.floor(minutes / 60) % 24}:${String(minutes % 60).padStart(2, '0')}`)

/** One quiet line when the guessed arrival passes the end of today's block; null otherwise. */
export function pastWindowWords(nowMs: number, minutes: number | null, block: { timeEnd: string } | null | undefined): string | null {
  if (minutes == null || !block) return null
  const arrival = nowMinutesInAppTz(nowMs) + minutes
  const end = pgTimeToMinutes(block.timeEnd)
  if (!Number.isFinite(end) || arrival <= end) return null
  return `That lands about ${hmOf(arrival)}, past the ${scheduleFormatTimeHm(block.timeEnd)} window. Running late is under Message the customer and moves the board.`
}

// ---------- the note ----------

/** The session's note, written by the app: *On my way to PLUM 512 · Whitfield water heater, about 20 min*. */
export function travelNote(jobLabel: string, minutes: number | null): string {
  return minutes == null ? `On my way to ${jobLabel}` : `On my way to ${jobLabel}, about ${minutes} min`
}

/** The note when the tech starts at the door, with no drive. */
export function hereNote(jobLabel: string): string {
  return `On site at ${jobLabel}`
}

// ---------- the sheet's rows and presses ----------

export interface ActRow {
  icon: string
  words: string
  hold: boolean
}

export interface Acts {
  rows: ActRow[]
  /** The primary press, which says exactly what it will do. */
  primary: string
  /** The quiet second press, or null when there is only one thing to do. */
  secondary: string | null
}

export interface ActsInput {
  press: PhonePress
  /** The destination as the card names it: "PLUM 512 · Whitfield water heater". */
  jobLabel: string
  /** The customer's first name, or null. */
  first: string | null
  /** The job the tech leaves, or null before the first clock-in. */
  leaving: string | null
  hold: TextHold | null
  /** The phone says the tech is already at the job. */
  sameSite: boolean
  /** On an I'm here press: the drive so far. */
  driveMinutes?: number | null
  /** On an On my way press: the bio that follows the line, as the lines picked of the lines there; null when none goes. */
  bio?: { lines: number; of: number } | null
}

const firstOr = (first: string | null, fallback: string) => first ?? fallback

/** The third row on a first-time press: *Then texts your bio, 3 of 4 lines, since Dana has not heard from you before.* */
const bioRow = (bio: { lines: number; of: number }, who: string) => `Then texts your bio, ${bio.lines} of ${bio.of} lines, since ${who} has not heard from you before.`

/** The sheet's rows and its two presses, for either press. */
export function acts(input: ActsInput): Acts {
  const who = firstOr(input.first, 'the customer')
  const them = firstOr(input.first, 'them')
  const textHere = { icon: '💬', words: `Texts ${who} that you are at the door. Skip it when ${input.first ? `${input.first} is` : 'they are'} already there.`, hold: false }
  // Already at the job, the On my way press sends the I'm here line, so a missing line is named as that one.
  const holdRow = input.hold ? { icon: '⚠', words: holdWords(input.hold, input.sameSite ? 'im_here' : input.press), hold: true } : null
  if (input.press === 'im_here') {
    const road = input.driveMinutes != null && input.driveMinutes > 0 ? ` ${input.driveMinutes} minutes on the road.` : ''
    return {
      rows: [{ icon: '📍', words: `Marks you on site at ${input.jobLabel}.${road}`, hold: false }, holdRow ?? textHere],
      primary: input.hold ? 'I’m here' : `I’m here, text ${them}`,
      secondary: input.hold ? null : 'I’m here, no text',
    }
  }
  if (input.sameSite) {
    const clockIn = input.leaving ? `Clocks you out of ${input.leaving} and in on ${input.jobLabel}, on site now.` : `Clocks you in on ${input.jobLabel}, on site now.`
    return {
      rows: [{ icon: '📍', words: clockIn, hold: false }, holdRow ?? textHere],
      primary: input.hold ? 'I’m here' : `I’m here, text ${them}`,
      secondary: input.hold ? null : 'I’m here, no text',
    }
  }
  const clockIn = input.leaving ? `Clocks you out of ${input.leaving} and in on ${input.jobLabel} as on the way.` : `Clocks you in on ${input.jobLabel} as on the way.`
  const textRow = { icon: '💬', words: `Texts ${who} from the company number. Their answer comes back to you.`, hold: false }
  return {
    rows: [{ icon: '⏱', words: clockIn, hold: false }, holdRow ?? textRow, ...(input.bio && !input.hold ? [{ icon: '👋', words: bioRow(input.bio, who), hold: false }] : [])],
    primary: input.hold ? 'On my way' : `On my way, text ${them}`,
    secondary: input.hold ? null : 'Clock in, no text',
  }
}

// ---------- the words ----------

export const ON_MY_WAY_WORDS = {
  /** The big button, two lines like its neighbours. */
  button: 'On my\nway',
  hereButton: 'I’m\nhere',
  title: 'On my way',
  hereTitle: 'You are on site',
  whereTo: 'Where to',
  suggested: 'Suggested',
  gets: (first: string | null) => (first ? `This is what ${first} gets.` : 'This is what they get.'),
  guessed: (miles: string) => `Guessed from your phone to the job, ${miles}. Change it if you know better.`,
  guessing: 'Reading your phone’s location for the minutes…',
  noGuess: 'Type how many minutes out you are.',
  alreadyThere: 'Your phone says you are already there, so there is no drive to text.',
  happens: 'What happens',
  minutes: 'minutes',
  less: 'Five minutes less',
  more: 'Five minutes more',
  startHere: 'Start here instead',
  done: 'Done for the day',
  waitMinutes: 'Type the minutes, or press Start here instead.',
  marking: 'Marking you on site…',
  onTheWay: (jobLabel: string) => `On the way to ${jobLabel}.`,
  arrived: (drive: number | null) => (drive != null && drive > 0 ? `You are on site. ${drive} min on the road.` : 'You are on site.'),
  sent: (first: string | null) => (first ? `Sent to ${first}.` : 'Sent.'),
  textFailed: 'The text did not go. You are clocked in; Message the customer sends it again.',
  hereTextFailed: 'The text did not go. You are on site; Message the customer sends it again.',
  noDestination: 'Pick where you are going.',
  /** The tech's bio (v2.5590): the block under the line the first time, the window on top, and the toasts. */
  bioFirst: (first: string | null) => `${first ?? 'They'} hears from you for the first time. This goes right after:`,
  bioNone: 'Nothing goes while every line is off.',
  notThisTime: 'Not this time',
  editBio: 'Edit bio',
  bioSent: 'Your bio went too.',
  bioFailed: 'Your bio did not go. The line did.',
  bioWindowTitle: (first: string | null) => `Your bio for ${first ?? 'them'}`,
  bioWindowHint: 'Tick what goes this time. The office wrote the lines.',
  bioPreview: (first: string | null) => (first ? `As ${first} gets it` : 'As they get it'),
  bioUsual: 'Your usual picks are in Settings → Your account. A change here is for this customer only.',
  bioNoSpanish: 'No Spanish yet, so it cannot go to a Spanish reader.',
  useThese: 'Use these',
  back: 'Back',
} as const
