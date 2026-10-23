/**
 * A voicemail read, over card 4 of `customer-messages-integrations-mockups.html` (branch spike/gc-mode, v0.2): Dana's
 * voicemail on the office line at Tue Oct 6, 2:14 PM Chicago, 41 seconds, "Thursday after two works for us". Made-up
 * people and words, never a live row.
 */
import { describe, expect, it } from 'vitest'
import { needsReply, stateMoveOf, type QueueContact, type QueueMessage } from '../followUp/queue'
import { dayKept, readDay } from './owed'
import {
  ANOTHER_DAY,
  KEEP_THE_DAY,
  NO_TRANSCRIPT_YET,
  heardDay,
  heardDayWrite,
  heardTime,
  voicemailLine,
  voicemailNeedsReply,
  type VoicemailMessage,
} from './voicemailRead'

/** Tue Oct 6 2026, 2:14 PM in Chicago (CDT). */
const LEFT_AT = '2026-10-06T19:14:00Z'
/** The office plays it a little later the same afternoon. */
const NOW = new Date('2026-10-06T19:40:00Z')

const DANA_WORDS = 'Hi, it’s Dana. Thursday after two works for us, and can you bring the water heater quote? Thanks.'

const dana = (over: Partial<VoicemailMessage> = {}): VoicemailMessage => ({
  id: 'vm-dana-1006',
  contactId: 'dana',
  channel: 'voicemail',
  direction: 'in',
  at: LEFT_AT,
  durationSeconds: 41,
  transcript: DANA_WORDS,
  summary: 'Dana can do Thursday after 2 PM and asks for the water heater quote.\nNext: Bring the water heater quote.',
  ...over,
})

describe('voicemailLine', () => {
  it('makes Quo’s transcript the line, with the summary on the hover and the length beside it', () => {
    expect(voicemailLine(dana())).toEqual({
      words: `“${DANA_WORDS}”`,
      hover: 'Dana can do Thursday after 2 PM and asks for the water heater quote.\nNext: Bring the water heater quote.',
      length: '0:41',
      meta: '0:41 · Quo’s transcript',
      transcribed: true,
    })
  })

  it('says "Voicemail · 0:41" alone while Quo has no transcript', () => {
    expect(voicemailLine(dana({ transcript: null, summary: null }))).toEqual({
      words: 'Voicemail · 0:41',
      hover: null,
      length: '0:41',
      meta: NO_TRANSCRIPT_YET,
      transcribed: false,
    })
    expect(voicemailLine(dana({ transcript: '   ', durationSeconds: null })).words).toBe('Voicemail')
  })

  it('does not quote words that come quoted', () => {
    expect(voicemailLine(dana({ transcript: '"Call me back."' })).words).toBe('"Call me back."')
  })
})

describe('heardDay', () => {
  it('reads Thu Oct 8, after 2 PM out of Dana’s voicemail, with its two presses', () => {
    const chip = heardDay(dana(), NOW)
    expect(chip).toEqual({
      day: '2026-10-08',
      words: 'Thu Oct 8, after 2 PM',
      said: 'Thursday',
      time: 'after 2 PM',
      past: false,
      presses: [KEEP_THE_DAY, ANOTHER_DAY],
      keep: { message_id: 'vm-dana-1006', state: 'offered', kind: null, day: '2026-10-08', day_words: null },
    })
    expect(chip!.presses).toEqual(['Keep the day', 'Another day'])
  })

  it('gives no chip while there is no transcript, or when no day was said', () => {
    expect(heardDay(dana({ transcript: null }), NOW)).toBeNull()
    expect(heardDay(dana({ transcript: 'Hi, it’s Dana. Call me back when you can. Thanks.' }), NOW)).toBeNull()
  })

  it('reads only a voicemail from them', () => {
    expect(heardDay(dana({ channel: 'call' }), NOW)).toBeNull()
    expect(heardDay(dana({ direction: 'out' }), NOW)).toBeNull()
  })

  it('reads "tomorrow" from the voicemail’s own day, not the day it is played', () => {
    const later = new Date('2026-10-09T15:00:00Z')
    const chip = heardDay(dana({ transcript: 'Tomorrow morning is fine, around nine.' }), later)
    expect(chip).toMatchObject({ day: '2026-10-07', words: 'Wed Oct 7, around 9 AM', past: true })
  })

  it('takes the first day said, a longer run first, and the voicemail’s own day only when nothing else is said', () => {
    expect(heardDay(dana({ transcript: 'Calling today about the leak. Next Monday works, or the Tuesday after.' }), NOW)).toMatchObject({ day: '2026-10-12', said: 'Next Monday' })
    expect(heardDay(dana({ transcript: 'Can you come out today? It is leaking.' }), NOW)).toMatchObject({ day: '2026-10-06', said: 'today' })
    expect(heardDay(dana({ transcript: 'We could do Oct 20, or 10/22 at the latest.' }), NOW)).toMatchObject({ day: '2026-10-20', said: 'Oct 20' })
    expect(heardDay(dana({ transcript: 'Give it two weeks and call me.' }), NOW)).toMatchObject({ day: '2026-10-20', said: 'two weeks' })
  })

  it('skips a weekday cut short inside the words, and reads the day said after it', () => {
    expect(heardDay(dana({ transcript: 'I sat with the plumber last week.' }), NOW)).toBeNull()
    expect(heardDay(dana({ transcript: 'I sat down and looked. Friday is good.' }), NOW)).toMatchObject({ day: '2026-10-09', said: 'Friday' })
  })
})

describe('heardTime', () => {
  it('reads one to six as PM and seven to eleven as AM', () => {
    expect(heardTime('Thursday at two works.')).toBe('at 2 PM')
    expect(heardTime('Thursday after two works.')).toBe('after 2 PM')
    expect(heardTime('Friday at seven is best.')).toBe('at 7 AM')
    expect(heardTime('Before eleven, please.')).toBe('before 11 AM')
    expect(heardTime('By six.')).toBe('by 6 PM')
  })

  it('keeps an AM or PM said, the minutes, noon and a clock hour', () => {
    expect(heardTime('At 9:30 am on Monday.')).toBe('at 9:30 AM')
    expect(heardTime('After 7 p.m. works.')).toBe('after 7 PM')
    expect(heardTime('Around 2pm.')).toBe('around 2 PM')
    expect(heardTime('By noon.')).toBe('by noon')
    expect(heardTime('At twelve.')).toBe('at noon')
    expect(heardTime('At 15:00.')).toBe('at 3 PM')
    expect(heardTime('About three o’clock.')).toBe('about 3 PM')
  })

  it('reads no time from a count or a year', () => {
    expect(heardTime('At one point it stopped.')).toBeNull()
    expect(heardTime('In about two weeks.')).toBeNull()
    expect(heardTime('By 2026 we will move.')).toBeNull()
    expect(heardTime('At tenth street.')).toBeNull()
    expect(heardTime('Thursday works.')).toBeNull()
  })
})

describe('heardDayWrite', () => {
  it('is cut 2’s offered row: a date, or the words when they were not one, never both', () => {
    expect(heardDayWrite('m1', dayKept(readDay('Thursday', '2026-10-06')))).toEqual({ message_id: 'm1', state: 'offered', kind: null, day: '2026-10-08', day_words: null })
    expect(heardDayWrite('m1', dayKept(readDay('after the inspection', '2026-10-06')))).toEqual({ message_id: 'm1', state: 'offered', kind: null, day: null, day_words: 'after the inspection' })
  })
})

describe('voicemailNeedsReply', () => {
  it('counts a voicemail from them as their move, as a text is', () => {
    expect(voicemailNeedsReply(dana())).toBe(true)
    expect(stateMoveOf(dana())).toBe(stateMoveOf({ channel: 'text', direction: 'in' }))
    expect(voicemailNeedsReply({ channel: 'text', direction: 'in' })).toBe(false)
    expect(voicemailNeedsReply({ channel: 'voicemail', direction: 'team' })).toBe(false)
  })

  it('puts Dana on Needs a reply with Call back', () => {
    const contact: QueueContact = { id: 'dana', kind: 'customer', name: 'Dana Whitfield', state: 'waiting' }
    const m = dana()
    const line: QueueMessage = { id: m.id, contactId: m.contactId, channel: m.channel, direction: m.direction, at: m.at, body: voicemailLine(m).words }
    const [row] = needsReply([contact], [line], [], '2026-10-06')
    expect(row).toMatchObject({ contactId: 'dana', landOnId: 'vm-dana-1006', callBack: true })
    expect(row!.acts).toContain('Call back')
  })
})
