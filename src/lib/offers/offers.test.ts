import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { OFFER_HELD } from '../flows/nudgeDispatch'
import { HELD_NEWER, HELD_NO_NUMBER, heldSentWords, morningSendOn, offerRefusalWords, rateJobsOf, readyRows, todaysSends, todaysSendsLine, TODAYS_SENDS_WORDS, withAnsweredHolds, withSentHolds, type OfferRow, type TodaysSendsInput } from './offers'

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

// Customer reviews (v2.6007, punch list #185): a review offer on a job the customer answered already is held, never pressed.
describe('withAnsweredHolds: a review offer on a job answered already', () => {
  const REVIEW = 'Dana, thank you for paying for the water heater. Would you tell us how we did? It takes one tap: {rate}'

  it('names the Pipeline jobs of the offers still waiting on their link, once each, and no other job', () => {
    expect(rateJobsOf([offer({ stepKey: 'review', body: REVIEW }), offer({ id: 'o2', stepKey: 'review', body: REVIEW }), offer({ id: 'o3', stepKey: 'review', body: REVIEW, jobKey: 'pipeline:job-2' }), offer({ id: 'o4', stepKey: 'review', body: REVIEW, jobKey: 'project:p-1' }), offer({ id: 'o5' })])).toEqual(['job-1312', 'job-2'])
    expect(rateJobsOf([])).toEqual([])
  })

  it('holds the answered job’s offer with the door, leaves the rest, and the window reads it as held', () => {
    const rows = withAnsweredHolds([offer({ id: 'r1', stepKey: 'review', body: REVIEW }), offer({ id: 'r2', stepKey: 'review', body: REVIEW, jobKey: 'pipeline:job-2' }), offer({ id: 'a' })], new Set(['job-1312']))
    expect(rows.map((r) => [r.id, r.heldWhy])).toEqual([
      ['r1', OFFER_HELD.answered],
      ['r2', null],
      ['a', null],
    ])
    const sends = todaysSends(input(rows))
    expect(sends.find((r) => r.id === 'r1')?.held).toBe(OFFER_HELD.answered)
    expect(readyRows(sends).map((r) => r.id)).toEqual(['r2', 'a'])
    expect(plainWordsFailures(OFFER_HELD.answered)).toEqual([])
  })

  it('an answer wins over the run’s own hold, and an offer whose link already went in is left alone', () => {
    const rows = withAnsweredHolds([offer({ id: 'r1', stepKey: 'review', body: REVIEW, channelId: null, heldWhy: HELD_NO_NUMBER }), offer({ id: 'r2', stepKey: 'review', body: REVIEW.replace('{rate}', 'https://clicktooling.com/rate?t=ab12') })], new Set(['job-1312']))
    expect(rows.map((r) => r.heldWhy)).toEqual([OFFER_HELD.answered, null])
    expect(withAnsweredHolds([offer({ id: 'r1', stepKey: 'review', body: REVIEW })], new Set())).toEqual([offer({ id: 'r1', stepKey: 'review', body: REVIEW })])
  })
})

// Already texted (v2.6386): an office-made offer took neither of the run's roads, so a text that went after it was
// prepared, or a newer offer on the same step and job, left it sitting ready.
describe('withSentHolds: a text whose step already went, or that a newer one replaced', () => {
  const moved = (over: Partial<OfferRow> = {}) => offer({ id: 'moved', stepKey: 'booked', preparedBy: 'office', preparedAt: '2026-10-19T14:55:00Z', body: 'Dana, your visit moved to Thursday.', ...over })
  const went = { contactId: 'c-dana', stepKey: 'booked', jobKey: 'pipeline:job-1312', sentAt: '2026-10-20T15:10:00Z' }

  it('holds the offer when a text on its step and job went after it was prepared, naming the day, and Send all skips it', () => {
    const rows = withSentHolds([moved(), offer({ id: 'other' })], [went])
    expect(rows.map((r) => [r.id, r.heldWhy])).toEqual([
      ['moved', 'A text for this step already went to them on Tue Oct 20. Put this one away with Not this one.'],
      ['other', null],
    ])
    expect(readyRows(todaysSends(input(rows))).map((r) => r.id)).toEqual(['other'])
    expect(plainWordsFailures(heldSentWords('2026-10-20T15:10:00Z'))).toEqual([])
  })

  it('leaves it ready when the text went before it was prepared, on another job, on another step or to someone else', () => {
    const rows = withSentHolds(
      [moved()],
      [
        { ...went, sentAt: '2026-10-15T19:00:00Z' },
        { ...went, jobKey: 'pipeline:job-2' },
        { ...went, stepKey: 'onway' },
        { ...went, contactId: 'c-sam' },
      ],
    )
    expect(rows[0]?.heldWhy).toBeNull()
  })

  it('names the first day it went when it went twice, and wins over the run’s own hold', () => {
    const rows = withSentHolds([moved({ channelId: null, heldWhy: HELD_NO_NUMBER })], [{ ...went, sentAt: '2026-10-22T12:00:00Z' }, went])
    expect(rows[0]?.heldWhy).toBe(heldSentWords('2026-10-20T15:10:00Z'))
  })

  it('holds the older of two open offers on one step and job, so a visit moved twice sends one text', () => {
    const rows = withSentHolds([moved(), moved({ id: 'moved-again', preparedAt: '2026-10-21T16:18:00Z', body: 'Dana, your visit moved to Friday.' }), moved({ id: 'other-job', jobKey: 'pipeline:job-2' })], [])
    expect(rows.map((r) => [r.id, r.heldWhy])).toEqual([
      ['moved', HELD_NEWER],
      ['moved-again', null],
      ['other-job', null],
    ])
    expect(plainWordsFailures(HELD_NEWER)).toEqual([])
  })
})

// v2.6385: a press refused with the flow's `stepUnknown` code names the step, the person and the door.
describe('offerRefusalWords: a press on a step the flow does not have', () => {
  const row = { step: 'Booked', who: 'Dana Whitfield' }
  it('turns the bare code into the step, the person and the door, in plain words', () => {
    const words = offerRefusalWords('Failed to stop the reminders: stepUnknown', row)
    expect(words).toBe('The step Booked is not on Dana Whitfield’s flow, so there is nothing to stop or hold. Put this text away with Not this one.')
    expect(plainWordsFailures(words)).toEqual([])
  })
  it('leaves every other failure its own words', () => {
    expect(offerRefusalWords('Failed to hold the reminder: dayPassed', row)).toBe('Failed to hold the reminder: dayPassed')
    expect(offerRefusalWords('You appear to be offline.', row)).toBe('You appear to be offline.')
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
