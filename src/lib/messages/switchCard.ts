/**
 * Punch list #140 PR 2: **Finish switching Messages on**, the line at the top of Messages for the owner and a dev that
 * opens a card of the eight switches the loop runs on, each with a status chip and a door to its setting. The switches
 * themselves are the owner's presses on Settings; this card only reads them (`switchCardIo.ts`, one read of the eight
 * `app_settings` rows) and says what is still off. Pure: the rows, their words, each switch's state from its row as the
 * app's own parsers read it, the count, and the week-long fold **Later** keeps on the device.
 */
import { APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1, APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1, APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1 } from '../appSettingsKeys'
import { appSendsFrom } from '../flows/nudgeRunInputs'
import { ASSIGN_RULE_KEY, parseAssignSeats } from '../followUp/assignSeats'
import { parseQuoSeats } from '../quo/seatsCard'
import { TEXTS_SWITCH_KEY, textsAreOn } from '../quo/textsSwitch'
import { BOXES_SETTINGS_KEY, parseBoxSettings } from './boxes'
import { readerIsOn } from './emailReader'
import { OFFICE_HOURS_KEY, parseOfficeHours } from './hasRule'
import { REPLY_PUSH_ON_KEY } from './notifyPlan'
import { officeHoursSet } from './officeHoursCard'
import { replyPushIsOn } from './replyPushSwitch'

export type SwitchKey = 'texts' | 'reader' | 'assign' | 'teamBox' | 'replyPush' | 'seats' | 'reminders' | 'hours'

/** On; off; the team inbox named but not read; nobody in a seat; a setting never saved. */
export type SwitchState = 'on' | 'off' | 'not_read' | 'nobody' | 'not_set'

export interface SwitchRow {
  key: SwitchKey
  /** The `app_settings` row it reads. */
  settingKey: string
  title: string
  /** What turning it on does, in a few words. */
  why: string
  /** The door's label. */
  door: string
  href: string
}

const PHONE = '/settings?tab=settings-phone-texts'

export const SWITCH_ROWS: readonly SwitchRow[] = [
  { key: 'texts', settingKey: TEXTS_SWITCH_KEY, title: 'Send texts', why: 'the office texts from the company number', door: 'Turn it on', href: `${PHONE}#settings-phone-texts-send-texts` },
  { key: 'reader', settingKey: APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1, title: 'Read bids@', why: 'trade partners’ emails land in their threads', door: 'Turn it on', href: `${PHONE}#settings-phone-texts-read-bids` },
  { key: 'assign', settingKey: ASSIGN_RULE_KEY, title: 'Who gets a new message', why: 'the seats a new message goes to', door: 'Pick the seats', href: `${PHONE}#settings-phone-texts-who-gets-it` },
  { key: 'teamBox', settingKey: BOXES_SETTINGS_KEY, title: 'The team inbox', why: 'a customer’s emailed reply lands in their thread, not in someone’s Gmail', door: 'Set the address', href: `${PHONE}#settings-phone-texts-boxes` },
  { key: 'replyPush', settingKey: REPLY_PUSH_ON_KEY, title: 'Reply push', why: 'whoever has it hears a reply on their phone', door: 'Turn it on', href: `${PHONE}#settings-phone-texts-reply-push` },
  { key: 'seats', settingKey: APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1, title: 'Company phone seats', why: 'a seat per person, or one shared by the office', door: 'Pick the seats', href: `${PHONE}#settings-phone-texts-quo-seats` },
  { key: 'reminders', settingKey: APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1, title: 'Reminders the app offers', why: 'the estimate follow-up and the bill, as offers you press', door: 'Offer them', href: '/settings?tab=settings-flows&kind=residential' },
  { key: 'hours', settingKey: OFFICE_HOURS_KEY, title: 'Office hours', why: 'after hours the office hears first and the reply waits for the morning', door: 'Set the hours', href: `${PHONE}#settings-phone-texts-hours` },
]

/** The eight rows the card reads, in one `in('key', …)`. */
export const SWITCH_SETTING_KEYS: readonly string[] = SWITCH_ROWS.map((r) => r.settingKey)

export interface SwitchRaw {
  value_text: string | null
  value_num: number | null
}

/** The two residential steps the loop needs the app to offer: the estimate follow-up and the bill. */
const REMINDER_STEPS = ['approved', 'paid'] as const

/** Each switch's state from the rows as read, through the app's own parsers. A row that is missing reads as off. */
export function switchStates(raw: Readonly<Record<string, SwitchRaw | undefined>>): Record<SwitchKey, SwitchState> {
  const text = (key: string) => raw[key]?.value_text ?? null
  const reader = readerIsOn(text(APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1))
  const seats = parseAssignSeats(text(ASSIGN_RULE_KEY))
  const team = parseBoxSettings(text(BOXES_SETTINGS_KEY))?.team.address.trim() ?? ''
  const sends = appSendsFrom(text(APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1))
  const offered = REMINDER_STEPS.every((step) => Boolean(sends.residential?.[step]))
  return {
    texts: textsAreOn(text(TEXTS_SWITCH_KEY)) ? 'on' : 'off',
    reader: reader ? 'on' : 'off',
    assign: seats.customer && seats.trade ? 'on' : 'nobody',
    teamBox: !team ? 'not_set' : reader ? 'on' : 'not_read',
    replyPush: replyPushIsOn(text(REPLY_PUSH_ON_KEY)) ? 'on' : 'off',
    seats: parseQuoSeats(text(APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1)).length > 0 ? 'on' : 'nobody',
    reminders: offered ? 'on' : 'off',
    hours: officeHoursSet(text(OFFICE_HOURS_KEY)) ? 'on' : 'not_set',
  }
}

/** The Office hours row's why while the card's switch is on (punch list #141 PR 1). */
export const HOURS_ALWAYS_WHY = 'the office is open around the clock'

/**
 * Each row's why from the rows as read: the row's own words, except Office hours, which reads
 * `the office is open around the clock` while the card's switch is on.
 */
export function switchWhys(raw: Readonly<Record<string, SwitchRaw | undefined>>): Record<SwitchKey, string> {
  const whys = Object.fromEntries(SWITCH_ROWS.map((r) => [r.key, r.why])) as Record<SwitchKey, string>
  if (parseOfficeHours(raw[OFFICE_HOURS_KEY]?.value_text).always) whys.hours = HOURS_ALWAYS_WHY
  return whys
}

export interface SwitchCount {
  on: number
  of: number
}

export function onCount(states: Readonly<Record<SwitchKey, SwitchState>>): SwitchCount {
  return { on: SWITCH_ROWS.filter((r) => states[r.key] === 'on').length, of: SWITCH_ROWS.length }
}

export function allOn(states: Readonly<Record<SwitchKey, SwitchState>>): boolean {
  const c = onCount(states)
  return c.on === c.of
}

export const SWITCH_WORDS = {
  title: 'Finish switching Messages on',
  /** The line's count: "3 of 8 on". */
  count: (c: SwitchCount) => `${c.on} of ${c.of} on`,
  note: 'The page works before all eight. The loop closes when they are on.',
  later: 'Later',
  laterTip: 'Folds this away for a week on this device.',
  footer: 'Only the owner and devs see this card.',
  state: { on: 'On', off: 'Off', not_read: 'Not read', nobody: 'Nobody', not_set: 'Not set' } as Readonly<Record<SwitchState, string>>,
} as const

/** The line at the top of Messages: "Finish switching Messages on · 3 of 8 on". */
export function cardLine(c: SwitchCount): string {
  return `${SWITCH_WORDS.title} · ${SWITCH_WORDS.count(c)}`
}

/** The chip's tone: green on, red for an inbox named but not read, amber for the rest. */
export function stateTone(state: SwitchState): 'green' | 'red' | 'amber' {
  if (state === 'on') return 'green'
  if (state === 'not_read') return 'red'
  return 'amber'
}

export const SWITCH_LATER_STORAGE_KEY = 'messages_switch_card_later_until'

/** A week from now, ISO: how long **Later** folds the card on this device. */
export function laterUntil(nowIso: string): string {
  return new Date(Date.parse(nowIso) + 7 * 24 * 60 * 60 * 1000).toISOString()
}

/** Whether a kept **Later** still folds the card: a date to come. Anything else reads as no fold. */
export function laterHolds(stored: string | null | undefined, nowIso: string): boolean {
  if (!stored) return false
  const t = Date.parse(stored)
  return !Number.isNaN(t) && t > Date.parse(nowIso)
}
