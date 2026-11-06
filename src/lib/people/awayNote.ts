/**
 * The Away note (punch list #256, PR 6): while a teammate is away, the office leaves them one screen,
 * and it is the only page the app draws for their sealed sign-in (PR 8, behind the seal PR 7 proves).
 * This is the screen's arithmetic and its words, pure, so the office's preview and the person's own
 * page are drawn by one component over one model: the countdown in days, hours and minutes with a
 * thin bar for how far along they are, *Today's the day* when it ends, the miles and the drive from
 * two points worked out on the phone and never sent, the city from the office address, the call and
 * text links, the note signed *The team*, and the resting words when nothing is on. The owner's calls
 * of 2026-11-03: the note is signed by the team and not by whoever pressed Save, the location press
 * asks only after it is pressed, the end-of-countdown alert is off by default.
 */
import { haversineMeters, type LatLng } from '../jobTravelEstimate'
import { longDate } from './bringBack'

/** A note is a few lines, not a letter. */
export const AWAY_NOTE_WORDS_MAX = 600

/** The miles are rough and the drive rougher: a highway pace, and a long day at the wheel. */
export const AWAY_DRIVE_MPH = 60
export const AWAY_DRIVE_HOURS_PER_DAY = 10

export type AwayNoteDraft = {
  /** The office's words, in their own voice. */
  words: string
  /** The day back the countdown runs to, or null for no countdown. */
  countdownYmd: string | null
  /** *Show where we are*: the city from Settings → Office address, and the location press. */
  showWhere: boolean
  /** *Call or text button*: the office line. */
  showCall: boolean
  /** *Tell me when the countdown ends*: the Needs you item on the day (PR 9). Off by default. */
  alertOnDay: boolean
}

export const AWAY_NOTE_DEFAULT: AwayNoteDraft = { words: '', countdownYmd: null, showWhere: true, showCall: true, alertOnDay: false }

export const AWAY_WORDS = {
  from: 'The team',
  countdownHead: "Until you're back",
  doneTitle: "Today's the day.",
  doneWithCall: "Call the office and we'll open the app back up for you.",
  doneNoCall: "We'll open the app back up for you.",
  whereAsk: 'Want to see how far away that is?',
  locate: 'Use my location',
  privacy: 'Your location stays on this phone. We never see it.',
  call: 'Call the office',
  text: 'Text the office',
  signOut: 'Sign out',
  /** The preview with nothing on, and the person's screen the same. */
  empty: 'Write a note, or turn something on, and it shows here.',
  previewFoot: 'The buttons in the preview do nothing. Theirs do.',
  alertHelp: 'A Needs you item on the day, with Bring back… on it. Only the office sees this, so the preview does not change.',
} as const

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/

function parseYmd(ymd: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = YMD.exec(ymd ?? '')
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, m: mo, d }
}

/** Midnight at the start of the day, on the clock the phone keeps: the countdown ends when their day begins. */
function localMidnight(ymd: string): Date | null {
  const p = parseYmd(ymd)
  return p ? new Date(p.y, p.m - 1, p.d) : null
}

/** *Only Corinne sees this. Change it any time.* */
export function awayNoteHelp(firstName: string | null | undefined): string {
  const who = firstName?.trim() || 'they'
  return `Only ${who} ${who === 'they' ? 'see' : 'sees'} this. Change it any time.`
}

/** Why the note cannot be saved as drafted, or null. */
export function awayNoteProblem(draft: AwayNoteDraft, todayYmd: string): string | null {
  if (draft.words.length > AWAY_NOTE_WORDS_MAX) return `The note is over ${AWAY_NOTE_WORDS_MAX.toLocaleString('en-US')} characters. Keep it to a few lines.`
  if (draft.countdownYmd != null) {
    if (!parseYmd(draft.countdownYmd)) return 'The day back is not a date.'
    if (draft.countdownYmd <= todayYmd) return 'The day back has to be after today.'
  }
  if (draft.alertOnDay && draft.countdownYmd == null) return 'Tell me when the countdown ends needs a day back to count to.'
  return null
}

/** Nothing to show: no words, no countdown, the city and the call both off. */
export function awayNoteIsEmpty(draft: AwayNoteDraft): boolean {
  return !draft.words.trim() && draft.countdownYmd == null && !draft.showWhere && !draft.showCall
}

/** *See you soon, Corinne.* */
export function awayHello(firstName: string | null | undefined): string {
  const who = firstName?.trim()
  return who ? `See you soon, ${who}.` : 'See you soon.'
}

/** *updated today*, else *updated Nov 3, 2026*. */
export function awayUpdatedWords(updatedYmd: string | null | undefined, todayYmd: string): string {
  if (!updatedYmd || !parseYmd(updatedYmd)) return 'updated today'
  return updatedYmd === todayYmd ? 'updated today' : `updated ${longDate(updatedYmd)}`
}

/** The line under the note: *The team · updated today*. Signed by the team, since whoever pressed Save may be gone in three years too. */
export function awayFromLine(updatedYmd: string | null | undefined, todayYmd: string): string {
  return `${AWAY_WORDS.from} · ${awayUpdatedWords(updatedYmd, todayYmd)}`
}

export type AwayCountdown = {
  days: number
  hours: number
  minutes: number
  /** The day back has begun on the phone's clock, or has passed. */
  done: boolean
  /** How far along they are, 0 to 1, from the day they left to the day back; 1 with no day left or a day back that is not after it. */
  pct: number
  /** *Back on Monday, Nov 5, 2029*. */
  backOn: string
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** *Back on Monday, Nov 5, 2029*. */
export function awayBackOnWords(backYmd: string): string {
  const at = localMidnight(backYmd)
  return at ? `Back on ${WEEKDAYS[at.getDay()]}, ${longDate(backYmd)}` : `Back on ${backYmd}`
}

/**
 * The countdown as the screen draws it: whole days, hours and minutes left until the day back begins, no
 * seconds, since a number that ticks every second is the biggest thing on the screen and says nothing; and
 * the bar's share of the way from the day they left. Null when the day back is not a date.
 */
export function awayCountdown(args: { backYmd: string; leftYmd: string | null; now: Date }): AwayCountdown | null {
  const back = localMidnight(args.backYmd)
  if (!back) return null
  const ms = Math.max(0, back.getTime() - args.now.getTime())
  const mins = Math.floor(ms / 60_000)
  const left = args.leftYmd ? localMidnight(args.leftYmd) : null
  const span = left ? back.getTime() - left.getTime() : 0
  const pct = span > 0 && left ? Math.min(1, Math.max(0, (args.now.getTime() - left.getTime()) / span)) : 1
  return { days: Math.floor(mins / 1440), hours: Math.floor((mins % 1440) / 60), minutes: mins % 60, done: ms === 0, pct, backOn: awayBackOnWords(args.backYmd) }
}

function plural(n: number, one: string): string {
  return `${n.toLocaleString('en-US')} ${one}${n === 1 ? '' : 's'}`
}

/** The countdown in one line, for a screen reader and a test: *1,068 days, 14 hours and 32 minutes until you're back*. */
export function awayCountdownLine(c: AwayCountdown): string {
  if (c.done) return AWAY_WORDS.doneTitle
  return `${plural(c.days, 'day')}, ${plural(c.hours, 'hour')} and ${plural(c.minutes, 'minute')} until you're back`
}

/** The bar's width in percent, never under one so an empty bar still shows where it starts. */
export function awayBarPercent(c: AwayCountdown): number {
  return Math.max(1, Math.round(c.pct * 1000) / 10)
}

const METERS_PER_MILE = 1609.344

/** Rough miles: to the mile under ten, to five under a hundred, to ten past that. */
export function roundAwayMiles(miles: number): number {
  if (miles < 10) return Math.round(miles)
  if (miles < 100) return Math.round(miles / 5) * 5
  return Math.round(miles / 10) * 10
}

const SMALL = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

/** *Roughly a two-day drive.*, *About 3 hours of driving.*, *Under an hour's drive.*, or *You're nearly there.* */
export function awayDriveWords(miles: number): string {
  if (miles < 1) return "You're nearly there."
  const hours = miles / AWAY_DRIVE_MPH
  if (hours < 1) return "Under an hour's drive."
  if (hours < AWAY_DRIVE_HOURS_PER_DAY) return `About ${plural(Math.round(hours), 'hour')} of driving.`
  const days = Math.max(1, Math.round(hours / AWAY_DRIVE_HOURS_PER_DAY))
  return `Roughly a ${days <= 10 ? SMALL[days] : days.toLocaleString('en-US')}-day drive.`
}

export type AwayMiles = {
  miles: number
  /** *About 1,180 miles*, or *Under a mile*. */
  line: string
  /** *from you, as the crow flies. Roughly a two-day drive.* */
  tail: string
}

/**
 * How far the office is from where they stand, worked out on the phone from the office's map pin and the
 * browser's position, which is never saved or sent: the crow's miles, and a rough drive.
 */
export function awayMiles(from: LatLng, office: LatLng): AwayMiles {
  const miles = haversineMeters(from, office) / METERS_PER_MILE
  const rough = roundAwayMiles(miles)
  const line = miles < 1 ? 'Under a mile' : `About ${plural(rough, 'mile')}`
  return { miles: rough, line, tail: `from you, as the crow flies. ${awayDriveWords(miles)}` }
}

/** The city and state out of the office address: *12925 FM 20, Kingsbury, TX 78638* → *Kingsbury, TX*; a short address reads whole. */
export function awayCityFromAddress(address: string | null | undefined): string | null {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length < 3) return parts[parts.length - 1] ?? null
  const city = parts[parts.length - 2]!
  const state = parts[parts.length - 1]!.split(/\s+/)[0] ?? ''
  return state && !/^\d/.test(state) ? `${city}, ${state}` : city
}

/** *We're in Kingsbury, TX*. */
export function awayWhereWords(city: string): string {
  return `We're in ${city}`
}

/** The phone's digits as a link the phone dials or texts; null without a number. */
export function awayCallHref(phone: string | null | undefined, kind: 'call' | 'text' = 'call'): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  if (digits.replace(/\D/g, '').length < 7) return null
  const e164 = digits.startsWith('+') ? digits : digits.length === 10 ? `+1${digits}` : `+${digits}`
  return `${kind === 'call' ? 'tel' : 'sms'}:${e164}`
}

/** The Needs you item on the day the countdown ends (PR 9): *Corinne Vela's countdown ended today.* / *They left Nov 3, 2026.* */
export function awayAlertWords(displayName: string, leftYmd: string | null): { title: string; sub: string | null } {
  return { title: `${displayName.trim() || 'A teammate'}'s countdown ended today.`, sub: leftYmd && parseYmd(leftYmd) ? `They left ${longDate(leftYmd)}.` : null }
}

export type AwayOffice = { address: string | null; latLng: LatLng | null; phone: string | null }

/** Everything the one screen draws, for the office's preview and the person's page alike. */
export type AwayScreen = {
  /** *See you soon, Corinne.*; gone on the day. */
  hello: string | null
  /** The day-of block, in place of the hello, the note, the countdown and the city. */
  done: { title: string; sub: string } | null
  letter: { words: string; from: string } | null
  countdown: (AwayCountdown & { head: string; line: string; barPercent: number }) | null
  where: { city: string; words: string; ask: string; locate: string; privacy: string; office: LatLng | null } | null
  call: { label: string; href: string | null; textLabel: string; textHref: string | null } | null
  /** The resting words when nothing is on. */
  empty: string | null
}

/**
 * The screen from the note and the moment. `onTheDay` draws the day-of screen whatever the clock says, for
 * the preview's *Today · On the day* switch.
 */
export function buildAwayScreen(args: { draft: AwayNoteDraft; firstName: string | null; now: Date; leftYmd: string | null; updatedYmd: string | null; todayYmd: string; office: AwayOffice | null; onTheDay?: boolean }): AwayScreen {
  const { draft } = args
  const countdown = draft.countdownYmd ? awayCountdown({ backYmd: draft.countdownYmd, leftYmd: args.leftYmd, now: args.now }) : null
  const done = args.onTheDay === true || countdown?.done === true
  const call = draft.showCall ? { label: AWAY_WORDS.call, href: awayCallHref(args.office?.phone, 'call'), textLabel: AWAY_WORDS.text, textHref: awayCallHref(args.office?.phone, 'text') } : null
  if (done) return { hello: null, done: { title: AWAY_WORDS.doneTitle, sub: draft.showCall ? AWAY_WORDS.doneWithCall : AWAY_WORDS.doneNoCall }, letter: null, countdown: null, where: null, call, empty: null }
  const words = draft.words.trim()
  const city = draft.showWhere ? awayCityFromAddress(args.office?.address) : null
  return {
    hello: awayHello(args.firstName),
    done: null,
    letter: words ? { words, from: awayFromLine(args.updatedYmd, args.todayYmd) } : null,
    countdown: countdown ? { ...countdown, head: AWAY_WORDS.countdownHead, line: awayCountdownLine(countdown), barPercent: awayBarPercent(countdown) } : null,
    where: city ? { city, words: awayWhereWords(city), ask: AWAY_WORDS.whereAsk, locate: AWAY_WORDS.locate, privacy: AWAY_WORDS.privacy, office: args.office?.latLng ?? null } : null,
    call,
    empty: awayNoteIsEmpty(draft) ? AWAY_WORDS.empty : null,
  }
}
