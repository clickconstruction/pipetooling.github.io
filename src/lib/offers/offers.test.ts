import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { HELD_NO_NUMBER, morningSendOn, readyRows, todaysSends, todaysSendsLine, TODAYS_SENDS_WORDS, type OfferRow, type TodaysSendsInput } from './offers'

const offer = (over: Partial<OfferRow> = {}): OfferRow => ({
  id: 'o1',
  contactId: 'c-dana',
  contactKind: 'residential',
  stepKey: 'approved',
  jobKey: 'pipeline:job-1312',
  body: 'Dana, any word on the estimate? Happy to walk through it.',
  channelId: 'ch-1',
  preparedAt: '2026-10-17T14:00:00Z',
  preparedBy: 'app',
  sendOn: null,
  heldWhy: null,
  ...over,
})

const input = (offers: OfferRow[], over: Partial<TodaysSendsInput> = {}): TodaysSendsInput => ({
  offers,
  names: { 'c-dana': 'Dana Whitfield', 'c-sam': 'Sam Ortiz', 'c-noname': null },
  numbers: { 'ch-1': '(830) 555-0121', 'ch-9': '(210) 555-0199' },
  stepNames: { 'residential:approved': 'Approved', 'residential:booked': 'Booked', 'trade:portal': 'Portal opened' },
  ...over,
})

describe('todaysSends: the rows the office presses', () => {
  it('names the person, the step in their flow, and the words, ready first, then the morning’s, then the held', () => {
    const rows = todaysSends(
      input([
        offer({ id: 'held', contactId: 'c-sam', channelId: null, stepKey: 'booked' }),
        offer({ id: 'morning', preparedBy: 'office', sendOn: '2026-10-18' }),
        offer({ id: 'ready', contactId: 'c-sam', channelId: 'ch-9' }),
        offer({ id: 'ready-dana' }),
      ]),
    )
    expect(rows.map((r) => [r.id, r.who, r.step, r.held, r.goesOn])).toEqual([
      ['ready-dana', 'Dana Whitfield', 'Approved', null, null],
      ['ready', 'Sam Ortiz', 'Approved', null, null],
      ['morning', 'Dana Whitfield', 'Approved', null, '2026-10-18'],
      ['held', 'Sam Ortiz', 'Booked', HELD_NO_NUMBER, null],
    ])
    expect(rows[0]).toMatchObject({ stepKey: 'approved', jobKey: 'pipeline:job-1312', channelId: 'ch-1', body: 'Dana, any word on the estimate? Happy to walk through it.' })
  })

  it('says the number when the person has no name, the key when the step has none, and the run’s own hold words', () => {
    const rows = todaysSends(input([offer({ contactId: 'c-noname', stepKey: 'x_step', contactKind: 'trade', heldWhy: 'The number sent STOP. Call instead.' }), offer({ id: 'o2', contactId: 'c-gone', channelId: null, contactKind: null })]))
    expect(rows.map((r) => [r.who, r.step, r.held])).toEqual([
      ['(830) 555-0121', 'x_step', 'The number sent STOP. Call instead.'],
      ['Someone', 'approved', HELD_NO_NUMBER],
    ])
  })

  it('counts the ready ones for Send all, leaving out the held and the morning’s', () => {
    const rows = todaysSends(input([offer({ id: 'a' }), offer({ id: 'b', channelId: null }), offer({ id: 'c', preparedBy: 'office', sendOn: '2026-10-18' }), offer({ id: 'd', contactId: 'c-sam', channelId: 'ch-9' })]))
    expect(readyRows(rows).map((r) => r.id)).toEqual(['a', 'd'])
  })
})

describe('todaysSendsLine: the Dashboard’s line', () => {
  it('counts ready, the morning’s and held, each only when there are some', () => {
    const rows = todaysSends(input([offer({ id: 'a' }), offer({ id: 'b', channelId: null }), offer({ id: 'c', preparedBy: 'office', sendOn: '2026-10-18' }), offer({ id: 'd', contactId: 'c-sam', channelId: 'ch-9' }), offer({ id: 'e', contactId: 'c-sam', channelId: null })]))
    expect(todaysSendsLine(rows)).toBe('2 texts ready to send, 1 goes in the morning, 2 held')
    expect(todaysSendsLine(todaysSends(input([offer()])))).toBe('1 text ready to send')
    expect(todaysSendsLine(todaysSends(input([offer({ channelId: null })])))).toBe('1 held')
    expect(todaysSendsLine([])).toBe('')
  })
})

describe('morningSendOn: the morning an office-made text goes', () => {
  it('is today before the 9 AM run, and tomorrow from 9 AM on, in the app’s zone', () => {
    // Fri Oct 16 2026, Central daylight time: 8:40 AM is 13:40Z; 9:00 AM is 14:00Z; 11 PM is 04:00Z the next day.
    expect(morningSendOn(Date.parse('2026-10-16T13:40:00Z'))).toBe('2026-10-16')
    expect(morningSendOn(Date.parse('2026-10-16T14:00:00Z'))).toBe('2026-10-17')
    expect(morningSendOn(Date.parse('2026-10-17T04:00:00Z'))).toBe('2026-10-17')
    // Winter: 9 AM Central is 15:00Z.
    expect(morningSendOn(Date.parse('2026-12-02T14:30:00Z'))).toBe('2026-12-02')
    expect(morningSendOn(Date.parse('2026-12-02T15:00:00Z'))).toBe('2026-12-03')
  })
})

describe('the words', () => {
  it('keep to plain words', () => {
    const words = Object.values(TODAYS_SENDS_WORDS).map((w) => (typeof w === 'function' ? (w as (x: never) => string)(3 as never) : w))
    for (const w of [...words, HELD_NO_NUMBER, TODAYS_SENDS_WORDS.sent('Dana'), TODAYS_SENDS_WORDS.held('Mon'), TODAYS_SENDS_WORDS.goesOn('Fri, Oct 17')]) {
      expect(plainWordsFailures(w), w).toEqual([])
    }
  })
})
