/**
 * The phone's trip (v2.7701, punch list #379, PR 7b). The crew knows first that a trip has started, so the
 * job's card in Job Mode offers one: a question once somebody is clocked in on a job of a site that is a
 * trip from home, and a banner with **Heading home** and **End the trip** while their own trip is open,
 * on the job they are clocked in on or the one the card says is ready to start.
 *
 * This file decides what the phone shows and says it in words. It is fed by `trip_phone_state` (migration
 * 20261118030000), which answers for the signed-in person alone: the job's site, their own open trip there
 * and the open trips of crewmates, by first name and day.
 *
 * The promise the phone makes is held here by what is missing: nothing in this file knows the clock. The
 * question is asked of a person who is already clocked in, and no answer to it reaches a clock row, a
 * bill or a cost. Pure: days are `YYYY-MM-DD` strings in the company's calendar.
 */
import { daysBetween, isYmd, parseTripDays, personDayCounts, type TripDayKind, type TripDays } from './tripDays'
import { siteIsFar } from './tripPlace'
import { daysWords, monthDay, namesWords, tripSpanWords } from './tripsLook'

/** The person's own open trip on the job's site. */
export type TripPhoneMine = {
  tripId: string
  /** The trip's short number on its site (*Trip 5*), handed out by the database; null on a trip made before numbers. */
  tripNumber: number | null
  firstDay: string
  lastDay: string
  purpose: string
  /** Their own days alone. */
  days: TripDays
  /** The first names of the others on the trip. */
  with: string[]
}

/** A crewmate's open trip on the site, by first names and its first day. */
export type TripPhoneOpen = { tripId: string; tripNumber: number | null; firstDay: string; people: string[] }

/** What `trip_phone_state` said, for somebody working the job. */
export type TripPhoneState = {
  /** Null for a job on no site: nothing is asked or shown there. */
  developmentId: string | null
  developmentName: string
  hasTrips: boolean
  mine: TripPhoneMine | null
  /** Newest first. */
  open: TripPhoneOpen[]
  /** The company's day, as the server read it. */
  today: string
}

/** The four acts of `trip_phone`. Always the caller's own row and the server's own today. */
export type TripPhoneAct =
  | { action: 'start'; job_id: string; kind?: TripDayKind }
  | { action: 'join'; job_id: string; trip_id: string; kind?: TripDayKind }
  | { action: 'day'; job_id: string; trip_id: string; kind: TripDayKind }
  | { action: 'end'; job_id: string; trip_id: string; outcome?: string }

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const names = (v: unknown): string[] => (Array.isArray(v) ? v.map((n) => text(n).trim()).filter(Boolean) : [])
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** A trip's number: a positive whole number, or null. A reply from before numbers has none, which is null and no error. */
const tripNumberOf = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

/**
 * The reply read back, with nothing taken on trust. Null when the caller is not working the job
 * (`ok: false`) or the reply is not one: the phone then asks nothing. `fallbackToday` is the device's
 * reading of the company's day, used only when the reply names no day.
 */
export function parseTripPhoneState(raw: unknown, fallbackToday: string): TripPhoneState | null {
  if (!isRecord(raw) || raw.ok !== true) return null
  const today = isYmd(raw.today) ? raw.today : fallbackToday
  let mine: TripPhoneMine | null = null
  if (isRecord(raw.mine) && text(raw.mine.trip_id)) {
    const days = parseTripDays(raw.mine.days)
    const own = Object.keys(days).sort()
    const firstDay = isYmd(raw.mine.first_day) ? raw.mine.first_day : (own[0] ?? today)
    const lastDay = isYmd(raw.mine.last_day) ? raw.mine.last_day : (own[own.length - 1] ?? firstDay)
    mine = { tripId: text(raw.mine.trip_id), tripNumber: tripNumberOf(raw.mine.trip_number), firstDay, lastDay, purpose: text(raw.mine.purpose).trim(), days, with: names(raw.mine.with) }
  }
  const open: TripPhoneOpen[] = []
  for (const o of Array.isArray(raw.open) ? raw.open : []) {
    if (!isRecord(o) || !text(o.trip_id) || !isYmd(o.first_day)) continue
    open.push({ tripId: text(o.trip_id), tripNumber: tripNumberOf(o.trip_number), firstDay: o.first_day, people: names(o.people) })
  }
  // Newest first, as the server sends them; a sort that keeps their order where two started the same day.
  open.sort((a, b) => (a.firstDay < b.firstDay ? 1 : a.firstDay > b.firstDay ? -1 : 0))
  return { developmentId: text(raw.development_id) || null, developmentName: text(raw.development_name).trim(), hasTrips: raw.has_trips === true, mine, open, today }
}

// ---- words ------------------------------------------------------------------------------------

export const TRIP_PHONE_WORDS = {
  question: 'This site is a trip from home. Is this a trip?',
  start: 'Start a trip',
  justClockIn: 'Just clock in',
  promise: 'The office can change it later. Your hours are the same either way.',
  headingHome: 'Heading home',
  headingHomeLine: 'Heading home marks the drive as On the road.',
  roadToday: 'Today is marked On the road.',
  end: 'End the trip',
  endTitle: 'End the trip',
  notYet: 'Not yet, still out',
  outcomeLabel: 'How did it go? (you can skip this)',
  endLine: 'Ending the trip changes no hours. The office can still change the trip.',
  started: 'Trip started. The office can change it later.',
  joined: 'You are on the trip.',
  ended: 'Trip ended.',
  startFailed: 'The trip could not be started. You are still clocked in.',
  joinFailed: 'You could not be added to the trip. You are still clocked in.',
  homeFailed: 'Today could not be marked On the road. Your hours are unchanged.',
  endFailed: 'The trip could not be ended. Your hours are unchanged.',
} as const

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** *Mon*. Read at noon UTC of the day itself, so no clock change and no device zone moves it. */
export function weekdayOf(ymd: string): string {
  return WEEKDAYS[new Date(ymd + 'T12:00:00Z').getUTCDay()] ?? ''
}

/**
 * When a trip started, after *out since*: *today*, the weekday inside the last six days (*Mon*), and the
 * date before that (*Oct 26*), since a weekday a week old names the wrong day.
 */
export function sinceWords(firstDay: string, today: string): string {
  const back = daysBetween(firstDay, today)
  if (back === 0) return 'today'
  return back > 0 && back <= 6 ? weekdayOf(firstDay) : monthDay(firstDay)
}

/** *Trip 5*, the name the office uses too; plain *Trip* on a trip with no number. */
export function tripNameWords(tripNumber: number | null): string {
  return tripNumber == null ? 'Trip' : `Trip ${tripNumber}`
}

/** The banner's title: *Trip 5 · day 3 at Heron Point*, and *Trip · day 3 at Heron Point* with no number. */
export function tripBannerTitle(args: { tripNumber: number | null; day: number; site: string }): string {
  return `${tripNameWords(args.tripNumber)} · day ${args.day}${args.site ? ` at ${args.site}` : ''}`
}

/** The End the trip sheet's first line: *Trip 5 to Heron Point*, and *Trip to Heron Point* with no number. */
export function tripToSiteWords(tripNumber: number | null, site: string): string {
  return `${tripNameWords(tripNumber)}${site ? ` to ${site}` : ''}`
}

/** *Join Luis’s trip, out since Mon*. With no name on the trip, *Join a crewmate’s trip*. A crewmate knows the person, not the number. */
export function joinTripWords(open: Pick<TripPhoneOpen, 'people' | 'firstDay'>, today: string): string {
  return `Join ${open.people.length ? namesWords(open.people) : 'a crewmate'}’s trip, out since ${sinceWords(open.firstDay, today)}`
}

/** *1,180 miles from the shop*; null while the distance is unknown. */
export function milesFromShopWords(miles: number | null): string | null {
  if (miles == null || !Number.isFinite(miles)) return null
  const n = Math.round(miles)
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'mile' : 'miles'} from the shop`
}

/**
 * A person's own days on a trip in words: *8 days at the site · 2 on the road*. A kind with no day is left
 * out, and the first figure carries the word *days*. Empty with no day at all.
 */
export function ownDaysWords(days: TripDays): string {
  const c = personDayCounts(days)
  const parts: Array<[number, string]> = [
    [c.site, 'at the site'],
    [c.road, 'on the road'],
    [c.ready, 'getting ready'],
  ]
  return parts
    .filter(([n]) => n > 0)
    .map(([n, label], i) => `${i === 0 ? daysWords(n) : n} ${label}`)
    .join(' · ')
}

// ---- what the phone shows ----------------------------------------------------------------------

/** How many crewmates' trips the question offers to join. */
export const TRIP_PHONE_MAX_JOINS = 2

export type TripPhoneJoin = { tripId: string; label: string }

export type TripPhoneView =
  | { kind: 'none' }
  | {
      kind: 'ask'
      /** *Heron Point · 1,180 miles from the shop*; the miles are left out while unknown, and the line is empty with neither. */
      siteLine: string
      /** At most two, newest first. */
      joins: TripPhoneJoin[]
    }
  | {
      kind: 'banner'
      tripId: string
      /** *Trip 5 · day 3 at Heron Point*; *Trip · day 3 at Heron Point* on a trip with no number. */
      title: string
      /** *Trip 5 to Heron Point*, the End the trip sheet's first line. */
      heading: string
      /** *with Priya · started Mon Oct 26*. */
      sub: string
      /** *Oct 26 to Nov 4*, the trip's own span. */
      when: string
      /** *8 days at the site · 2 on the road*, the person's own days. */
      daysLine: string
      /** What the person's own today is painted, or null while it is not. */
      todayKind: TripDayKind | null
    }

const NONE: TripPhoneView = { kind: 'none' }

/**
 * Which day of the trip today is for the person: their own days before today, and today. So the banner
 * reads *day 3* on the third morning whether or not today is painted yet.
 */
export function tripDayNumber(mine: Pick<TripPhoneMine, 'days'>, today: string): number {
  return Object.keys(mine.days).filter((d) => d !== today).length + 1
}

/**
 * What the job's card shows about a trip.
 *
 * - Nothing with no reply, or on a job on no site.
 * - The banner while the person's own trip is open there, clocked in or not.
 * - The question only of somebody who is clocked in on the job (`clockedIn`: a clock session, a state
 *   read since it opened, and the session's kind known), so it always comes after the clock in, when the
 *   site is a trip from home: it is far from the shop, or it has had a trip, or a
 *   crewmate's trip is open there. Never after **Just clock in** was said for this job today on this
 *   device (`justClockIn`).
 *
 * An unknown distance is not far, so a site whose point will not read asks nothing by distance alone.
 */
export function tripPhoneView(args: { state: TripPhoneState | null; miles: number | null; justClockIn: boolean; clockedIn: boolean; farMiles?: number }): TripPhoneView {
  const { state, miles } = args
  if (!state || !state.developmentId) return NONE
  const site = state.developmentName
  if (state.mine) {
    const m = state.mine
    const n = tripDayNumber(m, state.today)
    return {
      kind: 'banner',
      tripId: m.tripId,
      title: tripBannerTitle({ tripNumber: m.tripNumber, day: n, site }),
      heading: tripToSiteWords(m.tripNumber, site),
      sub: [m.with.length ? `with ${namesWords(m.with)}` : null, `started ${weekdayOf(m.firstDay)} ${monthDay(m.firstDay)}`].filter(Boolean).join(' · '),
      when: tripSpanWords(m.firstDay, m.lastDay < m.firstDay ? m.firstDay : m.lastDay, state.today),
      daysLine: ownDaysWords(m.days),
      todayKind: m.days[state.today] ?? null,
    }
  }
  if (!args.clockedIn || args.justClockIn) return NONE
  if (!(state.hasTrips || state.open.length > 0 || siteIsFar(miles, args.farMiles))) return NONE
  return {
    kind: 'ask',
    siteLine: [site || null, milesFromShopWords(miles)].filter(Boolean).join(' · '),
    joins: state.open.slice(0, TRIP_PHONE_MAX_JOINS).map((o) => ({ tripId: o.tripId, label: joinTripWords(o, state.today) })),
  }
}

/**
 * Whether the distance is worth reading: only when it alone would decide the question. Somebody not
 * clocked in is not asked, and a person with a trip, a site that has had one, a crewmate out there or a
 * **Just clock in** already answers it. The shop's point and the site's are then never read.
 */
export function tripPhoneNeedsMiles(state: TripPhoneState | null, justClockIn: boolean, clockedIn: boolean): boolean {
  return clockedIn && !!state && !!state.developmentId && !state.mine && !state.hasTrips && state.open.length === 0 && !justClockIn
}

/** The two stamps the clock keeps on a session: **On my way** starts the drive, **I'm here** ends it. */
export type TripSessionTravel = { travelStartedAt: string | null; arrivedAt: string | null }

/**
 * The kind a trip act paints, read from the open clock session: On the road while the session is an
 * **On my way** drive that has not arrived, else At the site. A session with no stamps, or none read, is
 * a person at work, so a day spent driving is the only one that reads On the road by itself.
 */
export function tripKindOfSession(travel: TripSessionTravel | null | undefined): TripDayKind {
  return travel?.travelStartedAt && !travel.arrivedAt ? 'road' : 'site'
}

/**
 * The quiet rule that grows a trip a day at a time. A person with an open trip who is clocked in on a job
 * of its site has today painted the kind their session says (`tripKindOfSession`). It answers the kind to
 * paint, or null for nothing:
 *
 * - nothing for somebody who has not clocked in, with no trip of their own, or while the session's kind
 *   is not known;
 * - nothing when today is that kind already;
 * - never At the site turned into On the road: a person who worked at the site and then drives to the
 *   motel had a site day;
 * - On the road does turn into At the site: a morning drive, then **I'm here**;
 * - a Getting ready day is left alone: a person at home loading the trailer clocks in on the site's
 *   job on a day the office painted, and only a press of theirs or the office changes that day;
 * - nothing after **Heading home** was pressed in this session (`headedHome`): that press is the
 *   person's own word, and nothing quiet paints over it until a new clock session.
 */
export function tripQuietPaint(args: { state: TripPhoneState | null; clockedIn: boolean; kind: TripDayKind | null; headedHome: boolean }): TripDayKind | null {
  const { state, kind } = args
  if (!args.clockedIn || !kind || args.headedHome || !state?.mine) return null
  const today = state.mine.days[state.today]
  if (today === kind || today === 'ready') return null
  if (today === 'site' && kind === 'road') return null
  return kind
}

/** The state after the person's own today was painted, so the banner counts the day without a second read. */
export function withTodayPainted(state: TripPhoneState, kind: TripDayKind): TripPhoneState {
  if (!state.mine) return state
  return { ...state, mine: { ...state.mine, days: { ...state.mine.days, [state.today]: kind }, lastDay: state.mine.lastDay > state.today ? state.mine.lastDay : state.today } }
}

// ---- What the device remembers: Just clock in, and Heading home --------------------------------

export type TripPhoneStorage = Pick<Storage, 'getItem' | 'setItem'>

/** One small object, job id to the day **Just clock in** was said. Yesterday's answers are dropped on the next write. */
export const TRIP_JUST_CLOCK_IN_KEY = 'trips_phone_just_clock_in_v1'

/** One small object, clock session id to the day **Heading home** was pressed in it, kept the same way. */
export const TRIP_HEADED_HOME_KEY = 'trips_phone_headed_home_v1'

function storageOrNull(storage?: TripPhoneStorage | null): TripPhoneStorage | null {
  if (storage !== undefined) return storage
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readKept(s: TripPhoneStorage, key: string): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(s.getItem(key) ?? '{}')
    if (!isRecord(raw)) return {}
    const out: Record<string, string> = {}
    for (const [id, day] of Object.entries(raw)) if (typeof day === 'string') out[id] = day
    return out
  } catch {
    return {}
  }
}

function readKeptDay(key: string, id: string, today: string, storage?: TripPhoneStorage | null): boolean {
  const s = storageOrNull(storage)
  if (!s || !id) return false
  return readKept(s, key)[id] === today
}

function writeKeptDay(key: string, id: string, today: string, storage?: TripPhoneStorage | null): void {
  const s = storageOrNull(storage)
  if (!s || !id) return
  try {
    const kept: Record<string, string> = {}
    for (const [other, day] of Object.entries(readKept(s, key))) if (day === today) kept[other] = day
    kept[id] = today
    s.setItem(key, JSON.stringify(kept))
  } catch {
    /* a private window: the answer holds for this screen only */
  }
}

/** Whether **Just clock in** was said for this job today on this device. False when the store cannot be read. */
export function readTripJustClockIn(jobId: string, today: string, storage?: TripPhoneStorage | null): boolean {
  return readKeptDay(TRIP_JUST_CLOCK_IN_KEY, jobId, today, storage)
}

/** Remember **Just clock in** for this job and today. A store that cannot be written is passed over. */
export function writeTripJustClockIn(jobId: string, today: string, storage?: TripPhoneStorage | null): void {
  writeKeptDay(TRIP_JUST_CLOCK_IN_KEY, jobId, today, storage)
}

/**
 * Whether **Heading home** was pressed in this clock session today on this device, so a reload of the
 * card does not paint the day At the site again. False when the store cannot be read.
 */
export function readTripHeadedHome(sessionId: string, today: string, storage?: TripPhoneStorage | null): boolean {
  return readKeptDay(TRIP_HEADED_HOME_KEY, sessionId, today, storage)
}

/** Remember **Heading home** for this clock session and today. A store that cannot be written is passed over. */
export function writeTripHeadedHome(sessionId: string, today: string, storage?: TripPhoneStorage | null): void {
  writeKeptDay(TRIP_HEADED_HOME_KEY, sessionId, today, storage)
}
