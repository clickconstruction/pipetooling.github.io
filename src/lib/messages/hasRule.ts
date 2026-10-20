/**
 * Messages, residential R5: who answers a customer's reply. A reply goes to the tech who last texted them from a job,
 * until 5 PM Chicago on the day of that text, then to the office. Outside the office's hours nobody has it: the app
 * answers once a night, and the row waits on Needs a reply for the office. Lifted from the residential prototype
 * (branch spike/gc-mode, `to-dos/gc-mode/messages/customer-messages-prototype.html` v0.8: screen 2's sheet and preview,
 * *Who gets the reply*, the thread's pill `Open · Luis until 5 PM`) and the owner's decision 4 in
 * `RESIDENTIAL_BUILD_PLAN.md` § 7.
 *
 * The office's hours are `app_settings.messages_office_hours_v1` (seeded by R5's SQL PR), read by `parseOfficeHours`,
 * which falls back to the defaults below when the setting is missing or unreadable. The rule says who has it in
 * `contacts`' own columns (`has_user_id`, `has_since`, `has_how` = `rule`, and R5's `has_until`), the shapes
 * `followUp/queue.ts` reads. Days and times are Chicago's, read through `utils/dateUtils`, never the browser's.
 * Holidays are not known: a closed weekday reads as open until the owner asks for them.
 */
import { appTzWallTimeMs, calendarYmdInAppTzFromIso, startOfYmdInAppTzMs, ymdAddDays } from '../../utils/dateUtils'
import type { ContactFollowUpRow } from '../followUp/followUpTypes'
import { dayLabel } from './owed'
import { clockTime } from './thread'

/** The `app_settings` key that keeps the office's hours, as JSON. */
export const OFFICE_HOURS_KEY = 'messages_office_hours_v1'

/** When the office answers, and how long a tech keeps the replies to their text. Times are Chicago's, 24-hour "HH:MM". */
export interface OfficeHours {
  /** The days the office is open, 0 for Sunday to 6 for Saturday. */
  days: readonly number[]
  opens: string
  closes: string
  /** When a tech's hold on the replies ends, on the day they texted. */
  techUntil: string
  /** The number the after-hours answer gives for a leak, written "512-555-0144". Null: the answer gives none. */
  emergency: string | null
}

/** The defaults: Monday to Friday, 7:30 AM to 5 PM, the tech until 5 PM, no after-hours number. */
export const OFFICE_HOURS: OfficeHours = { days: [1, 2, 3, 4, 5], opens: '07:30', closes: '17:00', techUntil: '17:00', emergency: null }

const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/

const hmMinutes = (hm: string): number | null => {
  const m = HM.exec(hm.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

const hmOf = (v: unknown): string | null => (typeof v === 'string' && hmMinutes(v) !== null ? v.trim().padStart(5, '0') : null)

/**
 * A phone number as a text writes it: "512-555-0144". Parentheses fail the plain-words test, so "(512) 555-0144" is
 * rewritten. Null when it is not ten digits, with or without a leading 1.
 */
export function phoneWords(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (ten.length !== 10) return null
  return `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`
}

/**
 * The office's hours as the setting keeps them: `{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00",
 * "techUntil":"17:00","emergency":"(512) 555-0144"}`. A field it cannot read takes its default, so a bad value never
 * leaves the office without hours. An opening at or after the close takes both defaults.
 */
export function parseOfficeHours(valueText: string | null | undefined): OfficeHours {
  if (!valueText?.trim()) return { ...OFFICE_HOURS }
  let parsed: unknown
  try {
    parsed = JSON.parse(valueText)
  } catch {
    return { ...OFFICE_HOURS }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...OFFICE_HOURS }
  const o = parsed as Record<string, unknown>
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))] : []
  let opens = hmOf(o.opens) ?? OFFICE_HOURS.opens
  let closes = hmOf(o.closes) ?? OFFICE_HOURS.closes
  if (hmMinutes(opens)! >= hmMinutes(closes)!) {
    opens = OFFICE_HOURS.opens
    closes = OFFICE_HOURS.closes
  }
  return {
    days: days.length ? days.sort((a, b) => a - b) : [...OFFICE_HOURS.days],
    opens,
    closes,
    techUntil: hmOf(o.techUntil) ?? OFFICE_HOURS.techUntil,
    emergency: typeof o.emergency === 'string' ? phoneWords(o.emergency) : null,
  }
}

/** UTC ms of a Chicago wall time "HH:MM" on `ymd`. */
function wallMs(ymd: string, hm: string): number {
  const minutes = hmMinutes(hm) ?? 0
  return appTzWallTimeMs(ymd, Math.floor(minutes / 60), minutes % 60)
}

function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()
}

const isoOf = (ms: number) => new Date(ms).toISOString()

/** Whether the office is open at this instant: an open day, from the opening up to the close. */
export function officeOpen(at: string, hours: OfficeHours = OFFICE_HOURS): boolean {
  const ymd = calendarYmdInAppTzFromIso(at)
  if (!hours.days.includes(weekdayOf(ymd))) return false
  const t = Date.parse(at)
  return t >= wallMs(ymd, hours.opens) && t < wallMs(ymd, hours.closes)
}

/** The next time the office opens after this instant, ISO. Friday evening and the weekend go to Monday's opening. */
export function nextOpening(at: string, hours: OfficeHours = OFFICE_HOURS): string | null {
  const t = Date.parse(at)
  const today = calendarYmdInAppTzFromIso(at)
  for (let d = 0; d <= 7; d++) {
    const ymd = ymdAddDays(today, d)
    if (!hours.days.includes(weekdayOf(ymd))) continue
    const opens = wallMs(ymd, hours.opens)
    if (opens > t) return isoOf(opens)
  }
  return null
}

/** The office's last close at or before this instant, ISO: where the night the instant sits in began. */
export function lastClosing(at: string, hours: OfficeHours = OFFICE_HOURS): string | null {
  const t = Date.parse(at)
  const today = calendarYmdInAppTzFromIso(at)
  for (let d = 0; d <= 7; d++) {
    const ymd = ymdAddDays(today, -d)
    if (!hours.days.includes(weekdayOf(ymd))) continue
    const closes = wallMs(ymd, hours.closes)
    if (closes <= t) return isoOf(closes)
  }
  return null
}

/**
 * When a tech's hold on the replies to their text ends: the tech's hour on the day they texted. A text sent after that
 * hour, on an evening call, holds until midnight, so the customer's answer reaches the tech on the way.
 */
export function techHoldUntil(textAt: string, hours: OfficeHours = OFFICE_HOURS): string {
  const ymd = calendarYmdInAppTzFromIso(textAt)
  const until = wallMs(ymd, hours.techUntil)
  return isoOf(Date.parse(textAt) < until ? until : startOfYmdInAppTzMs(ymdAddDays(ymd, 1)))
}

/**
 * Whether the app answers a reply now: the office is closed, and no answer went since it closed. A night runs from the
 * close to the next opening, so a weekend is one night and gets one answer.
 */
export function autoAnswerDue(now: string, lastAutoAnswerAt: string | null | undefined, hours: OfficeHours = OFFICE_HOURS): boolean {
  if (officeOpen(now, hours)) return false
  if (!lastAutoAnswerAt) return true
  const closed = lastClosing(now, hours)
  return closed !== null && Date.parse(lastAutoAnswerAt) < Date.parse(closed)
}

/** The tech who last texted the person from a job: their user, their name and when they texted. */
export interface TechText {
  userId: string
  name: string
  at: string
}

/** What the rule reads. */
export interface HasRuleInput {
  /** The newest text to this person from a tech on a job. Null when no tech has texted them. */
  techText: TechText | null
  /** Who in the office gets it: `whoGetsIt`'s pick in `followUp/queue.ts`. Null: whoever answers first. */
  officeUserId?: string | null
  officeName?: string | null
  /** When the tech's hold ends, ISO, when the caller sets it. Otherwise `techHoldUntil`. */
  hasUntil?: string | null
  hours?: OfficeHours
  /** When the app last answered this person after hours, ISO. */
  lastAutoAnswerAt?: string | null
}

/** Who has the reply: the tech who texted, the office, or nobody while the office is closed. */
export type HasKind = 'tech' | 'office' | 'nobody'

/**
 * Why: the tech's hold stands, the tech's hold ended today, no tech texted them today, or the office is closed.
 */
export type HasReason = 'tech' | 'techDone' | 'noTech' | 'closed'

/** Who has it, in `contacts`' own columns. All four null when nobody does. */
export type HasWrite = Pick<ContactFollowUpRow, 'has_user_id' | 'has_since' | 'has_how'> & { has_until: string | null }

/** The rule's answer for one reply. */
export interface HasRule {
  has: HasKind
  /** Who has it, or null for the office with nobody named, and for nobody. */
  userId: string | null
  /** Their name, or null when the office has it with nobody named. */
  name: string | null
  /** The tech's hold's end, or the office's next opening while nobody has it. Null when the office has it. */
  until: string | null
  reason: HasReason
  /** The tech whose text the rule read, and when their hold ends. */
  tech: (TechText & { until: string }) | null
  /** After hours: the app sends its answer now, or one already went this night. Null when the office or a tech has it. */
  autoAnswer: 'send' | 'sent' | null
  write: HasWrite
  /** When the reply came. */
  now: string
}

const NOBODY_WRITE: HasWrite = { has_user_id: null, has_since: null, has_how: null, has_until: null }

/**
 * Who has a customer's reply that came at `now`. The tech's hold wins over the office's hours, so a tech who texts
 * before the office opens, or on a Saturday, hears the answer. After the hold, an open office has it. Otherwise
 * nobody does: the app answers once a night and the row waits for the office's opening.
 */
export function whoHasReply(input: HasRuleInput, now: string): HasRule {
  const hours = input.hours ?? OFFICE_HOURS
  const t = Date.parse(now)
  const tech = input.techText ? { ...input.techText, until: input.hasUntil ?? techHoldUntil(input.techText.at, hours) } : null
  if (tech && t < Date.parse(tech.until)) {
    return {
      has: 'tech',
      userId: tech.userId,
      name: tech.name,
      until: tech.until,
      reason: 'tech',
      tech,
      autoAnswer: null,
      write: { has_user_id: tech.userId, has_since: now, has_how: 'rule', has_until: tech.until },
      now,
    }
  }
  if (officeOpen(now, hours)) {
    const userId = input.officeUserId ?? null
    const endedToday = !!tech && calendarYmdInAppTzFromIso(tech.until) === calendarYmdInAppTzFromIso(now)
    return {
      has: 'office',
      userId,
      name: userId ? input.officeName?.trim() || null : null,
      until: null,
      reason: endedToday ? 'techDone' : 'noTech',
      tech,
      autoAnswer: null,
      write: userId ? { has_user_id: userId, has_since: now, has_how: 'rule', has_until: null } : { ...NOBODY_WRITE },
      now,
    }
  }
  return {
    has: 'nobody',
    userId: null,
    name: null,
    until: nextOpening(now, hours),
    reason: 'closed',
    tech,
    autoAnswer: autoAnswerDue(now, input.lastAutoAnswerAt, hours) ? 'send' : 'sent',
    write: { ...NOBODY_WRITE },
    now,
  }
}

/** Whether the rule's hold has run out: the rule gave it, with an end, and the end has come. */
export function handOffDue(row: Pick<HasWrite, 'has_user_id' | 'has_how' | 'has_until'>, now: string): boolean {
  return !!row.has_user_id && row.has_how === 'rule' && !!row.has_until && Date.parse(row.has_until) <= Date.parse(now)
}

/** "5 PM", "9:02 AM": a clock time with no ":00". */
function shortTime(iso: string): string {
  return clockTime(iso).replace(':00 ', ' ')
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** "Monday at 7:30 AM", as the after-hours answer says the opening. */
function openingWords(opensAt: string): string {
  return `${WEEKDAY_LONG[weekdayOf(calendarYmdInAppTzFromIso(opensAt))]} at ${shortTime(opensAt)}`
}

/** "5 PM" today, "midnight" at the end of today, "Mon 7:30 AM" on another day. */
function untilWords(until: string, now: string): string {
  const day = calendarYmdInAppTzFromIso(until)
  const today = calendarYmdInAppTzFromIso(now)
  const time = shortTime(until)
  if (time === '12 AM' && day === ymdAddDays(today, 1)) return 'midnight'
  if (day === today) return time
  return `${dayLabel(day).slice(0, 3)} ${time}`
}

/**
 * The one text the app sends after hours, once a night: when the office opens, and the number for a leak when the
 * owner set one. `emergency` is `OfficeHours.emergency`.
 */
export function afterHoursAnswer(firstName: string, opensAt: string, emergency?: string | null): string {
  const hi = firstName.trim() ? `Hi ${firstName.trim()}.` : 'Hi.'
  const leak = emergency ? ` For a leak you cannot stop, call ${emergency}.` : ''
  return `${hi} Thanks for your message. The office is closed right now. We open ${openingWords(opensAt)} and will answer you then.${leak}`
}

/** "today at 7:30 AM", "tomorrow at 7:30 AM", "Monday at 7:30 AM": an opening said from `now`. */
function openingFrom(opensAt: string, now: string): string {
  const day = calendarYmdInAppTzFromIso(opensAt)
  const today = calendarYmdInAppTzFromIso(now)
  if (day === today) return `today at ${shortTime(opensAt)}`
  if (day === ymdAddDays(today, 1)) return `tomorrow at ${shortTime(opensAt)}`
  return openingWords(opensAt)
}

/**
 * The gray event line when the tech's hold ends at `when`, saying where it landed. An open office: "Passed from Luis
 * to Rosa.", or to the office with nobody named. A closed one has nobody on it yet: "Passed from Luis to the office.
 * It opens tomorrow at 7:30 AM."
 */
export function handOffEvent(from: string, to: string | null, when: string, hours: OfficeHours = OFFICE_HOURS): string {
  if (officeOpen(when, hours)) return `Passed from ${from} to ${to?.trim() || 'the office'}.`
  const opens = nextOpening(when, hours)
  return `Passed from ${from} to the office.${opens ? ` It opens ${openingFrom(opens, when)}.` : ''}`
}

/** What the tech's hold ending writes, and its event line. */
export interface HandOff {
  write: HasWrite
  line: string
}

/**
 * The tech's hold has ended at `when` (`handOffDue`): the office's pick has it while the office is open, and nobody
 * does while it is closed, so the row waits for the opening.
 */
export function handOff(
  input: { from: string; officeUserId?: string | null; officeName?: string | null; hours?: OfficeHours },
  when: string,
): HandOff {
  const hours = input.hours ?? OFFICE_HOURS
  const userId = officeOpen(when, hours) ? (input.officeUserId ?? null) : null
  return {
    write: userId ? { has_user_id: userId, has_since: when, has_how: 'rule', has_until: null } : { ...NOBODY_WRITE },
    line: handOffEvent(input.from, userId ? input.officeName?.trim() || null : null, when, hours),
  }
}

/** The pill on the thread's header: "Open · Luis until 5 PM", "Open · Rosa", "Open · waits for Mon 7:30 AM". */
export function hasPill(rule: HasRule): string {
  if (rule.has === 'tech') return `Open · ${rule.name} until ${untilWords(rule.until!, rule.now)}`
  if (rule.has === 'office') return `Open · ${rule.name ?? 'the office'}`
  return rule.until ? `Open · waits for ${untilWords(rule.until, rule.now)}` : 'Open · waits for the office'
}

/** "5 PM" today, "Mon Oct 12 at 5 PM" on another day. */
function whenWords(at: string, now: string): string {
  const day = calendarYmdInAppTzFromIso(at)
  return day === calendarYmdInAppTzFromIso(now) ? shortTime(at) : `${dayLabel(day)} at ${shortTime(at)}`
}

/** The pill's hover: why the rule gave it, in plain words. `firstName` is the customer's. */
export function hasHover(rule: HasRule, firstName: string): string {
  const first = firstName.trim() || 'them'
  const office = rule.name ?? 'The office'
  if (rule.reason === 'tech' && rule.tech) {
    return `${rule.tech.name} texted ${first} from the job at ${whenWords(rule.tech.at, rule.now)}. Replies go to ${rule.tech.name} until ${untilWords(rule.tech.until, rule.now)}. Then the office has them.`
  }
  if (rule.reason === 'techDone' && rule.tech) return `${rule.tech.name} had the replies until ${shortTime(rule.tech.until)}. ${office} has them now.`
  if (rule.reason === 'noTech') return `No tech has texted ${first} from a job today. ${office} has the replies.`
  if (!rule.until) return 'The office is closed. The reply waits on Needs a reply for the office.'
  const told = rule.autoAnswer ? ` The app told ${first} we open ${openingWords(rule.until)}.` : ''
  return `The office is closed until ${dayLabel(calendarYmdInAppTzFromIso(rule.until))} at ${shortTime(rule.until)}. The reply waits on Needs a reply for the office.${told}`
}
