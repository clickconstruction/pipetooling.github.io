/**
 * A missed call gets a text back (punch list #195): the setting as the row keeps it, and the one answer the webhook
 * asks for, over the to-do's made-up people. Dana calls the company number at 4:11 PM on Friday Oct 23, 2026 and nobody
 * picks up.
 */
import { describe, expect, it } from 'vitest'
import { APP_SETTINGS_KEY_MESSAGES_MISSED_CALL_REPLY_V1 } from '../appSettingsKeys'
import { OFFICE_HOURS, type OfficeHours } from '../messages/hasRule'
import { plainWordsFailures } from '../plainWords'
import {
  holdWords,
  MISSED_LINE_WORDS,
  MISSED_REPLY_DEFAULTS,
  MISSED_REPLY_HOLD_MS,
  MISSED_REPLY_KEY,
  missedCall,
  parseMissedReply,
  planMissedReply,
  serializeMissedReply,
  textedBackLine,
  TEXTED_BACK_WHO,
  type MissedHold,
  type MissedReplyInput,
} from './missedReply'

/** Friday Oct 23, 2026, 4:12 PM in Chicago (CDT, five hours behind UTC). */
const FRIDAY_4PM = '2026-10-23T21:12:00.000Z'
/** The same Friday at 8:40 PM. */
const FRIDAY_8PM = '2026-10-24T01:40:00.000Z'

const ON = { ...MISSED_REPLY_DEFAULTS, on: true }

const dana = (over: Partial<MissedReplyInput> = {}): MissedReplyInput => ({
  line: { channel: 'missed', direction: 'in' },
  settings: ON,
  hours: OFFICE_HOURS,
  textsOn: true,
  optedOut: false,
  ownNumber: false,
  prospect: null,
  lastOurTextAt: null,
  pausedSince: null,
  nowIso: FRIDAY_4PM,
  ...over,
})

describe('the setting', () => {
  it('is the app’s key', () => {
    expect(MISSED_REPLY_KEY).toBe(APP_SETTINGS_KEY_MESSAGES_MISSED_CALL_REPLY_V1)
  })

  it('ships off, with the owner’s three lines', () => {
    expect(parseMissedReply(null)).toEqual(MISSED_REPLY_DEFAULTS)
    expect(parseMissedReply('')).toEqual(MISSED_REPLY_DEFAULTS)
    expect(parseMissedReply('not json')).toEqual(MISSED_REPLY_DEFAULTS)
    expect(parseMissedReply('[1]')).toEqual(MISSED_REPLY_DEFAULTS)
    expect(MISSED_REPLY_DEFAULTS.on).toBe(false)
  })

  it('reads the switch only as true, and falls back line by line', () => {
    expect(parseMissedReply('{"on":"true","inHours":"  We missed you.  ","afterHours":"","voicemail":7}')).toEqual({
      on: false,
      inHours: 'We missed you.',
      afterHours: MISSED_REPLY_DEFAULTS.afterHours,
      voicemail: MISSED_REPLY_DEFAULTS.voicemail,
    })
    expect(parseMissedReply('{"on":true}').on).toBe(true)
  })

  it('writes what the card saved, trimmed, and reads it back the same', () => {
    const json = serializeMissedReply({ on: true, inHours: ' A ', afterHours: 'B', voicemail: 'C ' }, '2026-10-28T15:00:00.000Z')
    expect(JSON.parse(json)).toEqual({ on: true, inHours: 'A', afterHours: 'B', voicemail: 'C', savedAt: '2026-10-28T15:00:00.000Z' })
    expect(parseMissedReply(json)).toEqual({ on: true, inHours: 'A', afterHours: 'B', voicemail: 'C' })
    expect(JSON.parse(serializeMissedReply(ON))).not.toHaveProperty('savedAt')
  })
})

describe('a call nobody answered', () => {
  it('is a missed call or a voicemail from them, never ours out or a call someone took', () => {
    expect(missedCall({ channel: 'missed', direction: 'in' })).toBe(true)
    expect(missedCall({ channel: 'voicemail', direction: 'in' })).toBe(true)
    expect(missedCall({ channel: 'call', direction: 'in' })).toBe(false)
    expect(missedCall({ channel: 'missed', direction: 'out' })).toBe(false)
    expect(missedCall({ channel: 'text', direction: 'in' })).toBe(false)
  })
})

describe('the text back', () => {
  it('sends the in-hours line on a Friday afternoon', () => {
    expect(planMissedReply(dana())).toEqual({ send: true, line: 'in_hours', body: MISSED_REPLY_DEFAULTS.inHours })
  })

  it('sends the after-hours line at 8:40 PM, and the voicemail line when they left one', () => {
    expect(planMissedReply(dana({ nowIso: FRIDAY_8PM }))).toEqual({ send: true, line: 'after_hours', body: MISSED_REPLY_DEFAULTS.afterHours })
    expect(planMissedReply(dana({ nowIso: FRIDAY_8PM, line: { channel: 'voicemail', direction: 'in' } }))).toEqual({ send: true, line: 'voicemail', body: MISSED_REPLY_DEFAULTS.voicemail })
  })

  it('reads the office’s own hours: open around the clock, 8:40 PM is in hours', () => {
    const always: OfficeHours = { ...OFFICE_HOURS, always: true }
    expect(planMissedReply(dana({ nowIso: FRIDAY_8PM, hours: always }))).toMatchObject({ send: true, line: 'in_hours' })
    const allDay: OfficeHours = { ...OFFICE_HOURS, days: [0, 1, 2, 3, 4, 5, 6], opens: '00:00', closes: '23:59' }
    expect(planMissedReply(dana({ nowIso: FRIDAY_8PM, hours: allDay }))).toMatchObject({ send: true, line: 'in_hours' })
  })

  it('sends the office’s words, not the defaults, once the card has them', () => {
    const words = { ...ON, inHours: 'We missed you. Text here.' }
    expect(planMissedReply(dana({ settings: words }))).toMatchObject({ body: 'We missed you. Text here.' })
  })

  it('holds for each gate, in the gates’ order, with the reason in a word and in words', () => {
    const holds: Array<[Partial<MissedReplyInput>, MissedHold, string]> = [
      [{ settings: MISSED_REPLY_DEFAULTS }, 'off', 'The text back is off.'],
      [{ line: { channel: 'call', direction: 'in' } }, 'not-missed', 'Someone answered the call.'],
      [{ textsOn: false }, 'texts-off', 'Send texts is off.'],
      [{ ownNumber: true }, 'own-number', 'The number is one of ours.'],
      [{ optedOut: true }, 'stopped', 'They sent STOP.'],
      [{ prospect: { ok_to_text: 'no', contact_name: 'Dana Whitfield', company_name: null } }, 'no-texts', 'Dana Whitfield said not to text them. Call or email instead.'],
      [{ prospect: { ok_to_text: null, contact_name: null, company_name: 'Ridgeway Builders' } }, 'not-asked', 'Ridgeway Builders has not said we may text. Ask on the call, then set May we text? on their card.'],
      [{ lastOurTextAt: Date.parse('2026-10-23T18:40:00.000Z') }, 'recent-text', 'We texted this number at 1:40 PM.'],
      [{ pausedSince: '2026-10-22T10:00:00.000Z' }, 'paused', 'Texts are paused until the phone balance is topped up.'],
    ]
    for (const [over, hold, words] of holds) expect(planMissedReply(dana(over)), hold).toEqual({ send: false, hold, words })
    // Every gate at once: the first in the order wins.
    expect(planMissedReply(dana({ textsOn: false, optedOut: true, ownNumber: true }))).toMatchObject({ hold: 'texts-off' })
  })

  it('texts a number once in three hours, a prospect who said yes, and a customer who is a prospect too', () => {
    const now = Date.parse(FRIDAY_4PM)
    expect(planMissedReply(dana({ lastOurTextAt: now - MISSED_REPLY_HOLD_MS + 60_000 })).send).toBe(false)
    expect(planMissedReply(dana({ lastOurTextAt: now - MISSED_REPLY_HOLD_MS })).send).toBe(true)
    expect(planMissedReply(dana({ prospect: { ok_to_text: 'yes', contact_name: 'Dana', company_name: null } })).send).toBe(true)
    expect(MISSED_REPLY_HOLD_MS).toBe(3 * 60 * 60 * 1000)
  })

  it('words a hold with no facts', () => {
    expect(holdWords('recent-text')).toBe('We texted this number in the last three hours.')
    expect(holdWords('no-texts')).toBe('They have not said we may text.')
  })
})

describe('the lines the office reads', () => {
  it('names the thread line and the New lane’s quiet line', () => {
    expect(TEXTED_BACK_WHO).toBe('The app texted back')
    expect(textedBackLine(FRIDAY_4PM)).toBe('The app texted back at 4:12 PM. The row still waits on you.')
    expect(MISSED_LINE_WORDS).toEqual({ in_hours: 'In office hours', after_hours: 'After hours', voicemail: 'With a voicemail' })
  })

  it('reads in plain words', () => {
    const words = [
      MISSED_REPLY_DEFAULTS.inHours,
      MISSED_REPLY_DEFAULTS.afterHours,
      MISSED_REPLY_DEFAULTS.voicemail,
      textedBackLine(FRIDAY_4PM),
      ...(['off', 'not-missed', 'texts-off', 'own-number', 'stopped', 'recent-text', 'paused'] as const).map((h) => holdWords(h, { lastOurTextAt: Date.parse(FRIDAY_4PM) })),
    ]
    for (const w of words) expect(plainWordsFailures(w), w).toEqual([])
  })
})
