import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { OFFER_HELD } from '../flows/nudgeDispatch'
import { goesLine, HELD_IN_KIND, HELD_NEWER, HELD_NO_NUMBER, heldSentWords, heldStaleWords, morningSendOn, offerRefusalWords, payJobsOf, rateJobsOf, readyRows, staleOn, todaysSends, todaysSendsNeed, heldCause, TODAYS_SENDS_WORDS, withAnsweredHolds, withInKindHolds, withSentHolds, type OfferRow, type TodaysSendsInput } from './offers'

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
  aboutOn: null,
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

// Work paid in kind (v2.8277, punch list #301): the app's pay reminder on a job an arrangement pays is held, never pressed.
describe('withInKindHolds: the app’s pay reminder on a job an in kind arrangement pays', () => {
  const PAY = 'Dana, a reminder that $1,700.00 is open on bill 1. Thank you.'
  const pay = (over: Partial<OfferRow> = {}) => offer({ stepKey: 'paid', body: PAY, ...over })

  it('names the Pipeline jobs of the app’s pay reminders, once each, and no other offer’s job', () => {
    expect(
      payJobsOf([
        pay(),
        pay({ id: 'o2' }),
        pay({ id: 'o3', jobKey: 'pipeline:job-2' }),
        pay({ id: 'o4', jobKey: 'project:p-1' }),
        pay({ id: 'o5', jobKey: null }),
        pay({ id: 'o6', jobKey: 'pipeline:job-3', preparedBy: 'office' }),
        offer({ id: 'o7', jobKey: 'pipeline:job-4' }),
      ]),
    ).toEqual(['job-1312', 'job-2'])
    expect(payJobsOf([])).toEqual([])
  })

  it('holds the covered job’s reminder with the door, leaves a bill paid with money, and Send all skips it', () => {
    const rows = withInKindHolds([pay({ id: 'covered' }), pay({ id: 'money', jobKey: 'pipeline:job-2' }), offer({ id: 'other step' })], new Set(['job-1312']))
    expect(rows.map((r) => [r.id, r.heldWhy])).toEqual([
      ['covered', HELD_IN_KIND],
      ['money', null],
      ['other step', null],
    ])
    const sends = todaysSends(input(rows))
    expect(sends.find((r) => r.id === 'covered')?.held).toBe(HELD_IN_KIND)
    expect(readyRows(sends).map((r) => r.id)).toEqual(['money', 'other step'])
    expect(plainWordsFailures(HELD_IN_KIND)).toEqual([])
  })

  it('wins over the run’s own hold, since a number on file is not the fix', () => {
    const rows = withInKindHolds([pay({ channelId: null, heldWhy: HELD_NO_NUMBER })], new Set(['job-1312']))
    expect(rows.map((r) => r.heldWhy)).toEqual([HELD_IN_KIND])
  })

  it('leaves a text a person wrote for the Paid step, another step on the same job, and every row when no job is on a deal', () => {
    const rows = [pay({ id: 'office', preparedBy: 'office', sendOn: '2026-11-23' }), offer({ id: 'booked', stepKey: 'booked' })]
    expect(withInKindHolds(rows, new Set(['job-1312']))).toEqual(rows)
    expect(withInKindHolds([pay()], new Set())).toEqual([pay()])
  })
})

// A moved visit's text expires with its visit (v2.6387): the row carries the day its words are about.
describe('a text about a day that has passed', () => {
  // Mon Nov 2 2026, 1:12 PM Central is 19:12Z.
  const NOW = new Date('2026-11-02T19:12:00Z')
  const moved = (over: Partial<OfferRow> = {}) => offer({ id: 'moved', stepKey: 'booked', preparedBy: 'office', preparedAt: '2026-10-19T14:55:00Z', body: 'Dana, your visit moved to Thursday, October 22, 2026, 8:00 AM to 12:00 PM.', ...over })

  it('is held with the day and the door, Send all skips it, and the line counts it held', () => {
    const rows = todaysSends(input([moved({ aboutOn: '2026-10-22' }), offer({ id: 'other' })]), NOW)
    expect(rows.map((r) => [r.id, r.held])).toEqual([
      ['other', null],
      ['moved', 'This text names a visit on Thu Oct 22. That day has passed. Put this one away with Not this one.'],
    ])
    expect(readyRows(rows).map((r) => r.id)).toEqual(['other'])
    expect(plainSentence(todaysSendsNeed(rows)!.title)).toBe('1 text to send')
    expect(plainWordsFailures(heldStaleWords('2026-10-22'))).toEqual([])
  })

  it('is ready on the day itself and before it, and a text about no day is never stale', () => {
    expect(staleOn({ aboutOn: '2026-11-02' }, '2026-11-02')).toBe(false)
    expect(staleOn({ aboutOn: '2026-11-10' }, '2026-11-02')).toBe(false)
    expect(staleOn({ aboutOn: '2026-11-01' }, '2026-11-02')).toBe(true)
    expect(staleOn({ aboutOn: null }, '2026-11-02')).toBe(false)
    const rows = todaysSends(input([moved({ aboutOn: '2026-11-02' }), moved({ id: 'later', aboutOn: '2026-11-10' }), moved({ id: 'no-day' })]), NOW)
    expect(rows.map((r) => r.held)).toEqual([null, null, null])
  })

  it('reads the day in the app’s zone: late on the visit day in Central time it is still that day', () => {
    // 11:30 PM Central on Oct 22 is 04:30Z on Oct 23.
    expect(todaysSends(input([moved({ aboutOn: '2026-10-22' })]), new Date('2026-10-23T04:30:00Z'))[0]?.held).toBeNull()
    expect(todaysSends(input([moved({ aboutOn: '2026-10-22' })]), new Date('2026-10-23T14:30:00Z'))[0]?.held).toBe(heldStaleWords('2026-10-22'))
  })

  it('wins over the run’s own hold and over a missing number: there is nothing to fix on it', () => {
    const rows = todaysSends(input([moved({ aboutOn: '2026-10-22', channelId: null }), moved({ id: 'held', aboutOn: '2026-10-22', heldWhy: OFFER_HELD['opted out'] })]), NOW)
    expect(rows.map((r) => r.held)).toEqual([heldStaleWords('2026-10-22'), heldStaleWords('2026-10-22')])
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

describe('todaysSendsNeed: the Dashboard’s row, built from the texts (punch list #424)', () => {
  // Sat Oct 17 2026, 11:00 AM Central. The offers were written that morning unless a test says otherwise.
  const NOW = new Date('2026-10-17T16:00:00Z')
  const values = (text: string) => sentenceParts(text).flatMap((p) => (typeof p === 'string' ? [] : [`${p.kind}=${p.text}`]))

  it('nothing waits: no row', () => {
    expect(todaysSendsNeed([], NOW)).toBeNull()
  })

  it('counts the texts that can go, names who they go to, and gives a timed and a held text a chip each', () => {
    const rows = todaysSends(
      input(
        [
          offer({ id: 'a' }),
          offer({ id: 'b', contactId: 'c-sam', channelId: 'ch-9', stepKey: 'booked' }),
          offer({ id: 'c', contactId: 'c-lee', channelId: 'ch-3', preparedBy: 'office', sendOn: '2026-10-20', sendAt: '2026-10-20T14:00:00Z' }),
          offer({ id: 'd', contactId: 'c-pat', channelId: null }),
        ],
        { names: { 'c-dana': 'Dana Whitfield', 'c-sam': 'Sam Ortiz', 'c-lee': 'Lee Park', 'c-pat': 'Pat Novak' } },
      ),
      NOW,
    )
    const need = todaysSendsNeed(rows, NOW)!
    // The count is the texts a person can send, not every text on the list.
    expect(need.count).toBe(2)
    expect(plainSentence(need.title)).toBe('2 texts to send')
    expect(values(need.title)).toEqual(['n=2'])
    expect(values(need.names)).toEqual(['who=Dana Whitfield', 'who=Sam Ortiz'])
    expect(need.peek).toBeNull()
    expect(need.chips.map((c) => `${c.kind}: ${plainSentence(c.text)}`)).toEqual(['timed: 1 · Tue 9:00 AM', 'held: 1 held · no number'])
    expect(values(need.chips[1]!.text)).toEqual(['n=1', 'why=no number'])
    expect(need).toMatchObject({ press: 'Read them', severity: 'amber' })
    // One plain line for a place that draws no values apart: Walk the list, a fold.
    expect(need.detail).toBe('Dana Whitfield · Sam Ortiz · 1 · Tue 9:00 AM · 1 held · no number')
    expect(need.detail).not.toMatch(/[⟪⟫]/)
  })

  it('one text shows the text itself, with its person and its step', () => {
    const need = todaysSendsNeed(todaysSends(input([offer()]), NOW), NOW)!
    expect(plainSentence(need.title)).toBe('1 text to send')
    expect(plainSentence(need.names)).toBe('Dana Whitfield · Approved')
    expect(need.peek).toBe('Dana, any word on the estimate? Happy to walk through it.')
    expect(need.press).toBe('Read it')
    expect(need.chips).toEqual([])
  })

  it('names three, counts the rest, and says how long the oldest has waited once it is two days', () => {
    const names = { 'c-1': 'Ann Bell', 'c-2': 'Bo Cruz', 'c-3': 'Cy Dunn', 'c-4': 'Di Egan', 'c-5': 'Ed Frey' }
    const rows = todaysSends(input(Object.keys(names).map((c, i) => offer({ id: `o${i}`, contactId: c, preparedAt: i === 0 ? '2026-10-13T14:00:00Z' : '2026-10-17T14:00:00Z' })), { names }), NOW)
    const need = todaysSendsNeed(rows, NOW)!
    // The spaces round the last dot do not break, so the count of the rest stays with the last name.
    expect(plainSentence(need.names)).toBe('Ann Bell · Bo Cruz · Cy Dunn\u00a0·\u00a0+2')
    expect(need.detail).toBe('Ann Bell · Bo Cruz · Cy Dunn · +2 · oldest 4 days')
    expect(values(need.names).slice(-1)).toEqual(['more=+2'])
    expect(need.chips.map((c) => `${c.kind}: ${plainSentence(c.text)}`)).toEqual(['old: oldest 4 days'])
    // Written yesterday is not old yet.
    const fresh = todaysSendsNeed(todaysSends(input([offer({ preparedAt: '2026-10-16T14:00:00Z' }), offer({ id: 'o2', contactId: 'c-sam', channelId: 'ch-9' })]), NOW), NOW)!
    expect(fresh.chips).toEqual([])
  })

  it('none can go: the held texts are the row, each name with its cause', () => {
    const rows = todaysSends(
      input([offer({ id: 'a', channelId: null }), offer({ id: 'b', contactId: 'c-sam', channelId: 'ch-9', heldWhy: OFFER_HELD['opted out'] }), offer({ id: 'c', contactId: 'c-lee', channelId: 'ch-3', heldWhy: OFFER_HELD.answered })], {
        names: { 'c-dana': 'Dana Whitfield', 'c-sam': 'Sam Ortiz', 'c-lee': 'Lee Park' },
      }),
      NOW,
    )
    const need = todaysSendsNeed(rows, NOW)!
    expect(plainSentence(need.title)).toBe('3 texts cannot go')
    expect(need.names).toBe('')
    expect(need.chips.map((c) => plainSentence(c.text))).toEqual(['Dana Whitfield · no number', 'Lee Park · already answered', '+1'])
    expect(need).toMatchObject({ count: 3, press: 'Fix them', severity: 'amber' })
    expect(todaysSendsNeed(todaysSends(input([offer({ channelId: null })]), NOW), NOW)!.press).toBe('Fix it')
  })

  it('only timed texts wait: a grey row that needs nobody, with the time in its title', () => {
    const one = todaysSendsNeed(todaysSends(input([offer({ preparedBy: 'office', sendOn: '2026-10-20', sendAt: '2026-10-20T14:00:00Z', stepKey: 'booked' })]), NOW), NOW)!
    expect(plainSentence(one.title)).toBe('1 text goes Tue 9:00 AM')
    expect(values(one.title)).toEqual(['n=1', 'when=Tue 9:00 AM'])
    expect(plainSentence(one.names)).toBe('Dana Whitfield · Booked')
    expect(one).toMatchObject({ count: 1, press: 'See it', severity: 'gray', chips: [] })
    const two = todaysSendsNeed(todaysSends(input([offer({ id: 'a', preparedBy: 'office', sendOn: '2026-10-20', sendAt: '2026-10-20T14:00:00Z' }), offer({ id: 'b', contactId: 'c-sam', channelId: 'ch-9', preparedBy: 'office', sendOn: '2026-10-19' })]), NOW), NOW)!
    expect(plainSentence(two.title)).toBe('2 texts go later')
    expect(two.press).toBe('See them')
  })

  it('a held text’s cause is a word or two, whatever the hold’s sentence', () => {
    expect(heldCause(HELD_NO_NUMBER)).toBe('no number')
    expect(heldCause('(830) 555-0121 sent STOP. Call instead.')).toBe('sent STOP')
    expect(heldCause(OFFER_HELD['opted out'])).toBe('sent STOP')
    expect(heldCause(`${OFFER_HELD['prefers email']} It would go to (830) 555-0121.`)).toBe('wants email')
    expect(heldCause(OFFER_HELD.answered)).toBe('already answered')
    expect(heldCause(HELD_IN_KIND)).toBe('paid in kind')
    expect(heldCause(HELD_NEWER)).toBe('a newer text waits')
    expect(heldCause(heldSentWords('2026-10-16T15:00:00Z'))).toBe('already sent')
    expect(heldCause(heldStaleWords('2026-10-15'))).toBe('the visit has passed')
    expect(heldCause('The line still has {amount}. Send it from the customer’s thread, where the box fills it, or change the step’s line.')).toBe('a blank to fill')
    // Words the app did not write, such as the carrier's: the row points at the window.
    expect(heldCause('Quo turned the text away.')).toBe('see why')
  })
})

describe('a text handed to a time (v2.6774)', () => {
  it('waits with its time, is not ready to press, and the row names when it goes', () => {
    const now = Date.parse('2026-11-09T21:32:00Z')
    const rows = todaysSends(input([offer({ id: 'later', preparedBy: 'office', sendOn: '2026-11-10', sendAt: '2026-11-10T15:00:00Z' }), offer({ id: 'morning', contactId: 'c-sam', channelId: 'ch-9', preparedBy: 'office', sendOn: '2026-11-10' })]))
    expect(rows.find((r) => r.id === 'later')).toMatchObject({ goesOn: '2026-11-10', goesAt: Date.parse('2026-11-10T15:00:00Z'), office: true, held: null })
    expect(rows.find((r) => r.id === 'morning')).toMatchObject({ goesAt: null, office: true })
    expect(goesLine(rows.find((r) => r.id === 'later')!, now)).toBe('Goes Tomorrow 9:00 AM')
    expect(goesLine(rows.find((r) => r.id === 'morning')!, now)).toBe('Goes in the morning of Tue Nov 10.')
    expect(readyRows(rows)).toEqual([])
    expect(plainSentence(todaysSendsNeed(rows, new Date(now))!.title)).toBe('2 texts go later')
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
