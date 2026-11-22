import { describe, expect, it } from 'vitest'
import type { BidMoneyLine } from '../bids/bidMoneyLine'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import {
  dayKeptWords,
  dayStillPromised,
  heardDayOnLine,
  heardDaySheetLine,
  heardDayTip,
  heardDayWords,
  jobLabelOf,
  lineNotMarkedWords,
  linesMarkedFor,
  lineStillMarkedWords,
  lineTakesWord,
  markNotThereYet,
  NO_JOB_WORDS,
  NO_STANDING_WORDS,
  wordChannel,
  wordLanding,
} from './wordFromLine'

const line = (id: string, open: number | null, number = '1032', name = 'Whitfield repipe'): BidMoneyLine => ({
  bidId: null,
  job: { id, number, name, status: open == null ? 'working' : 'billed', customerId: 'c1', customerName: 'Dana', customerPhone: null, customerEmail: null, createdAt: null },
  stage: 'Billed',
  open,
  bills: [],
  payUrl: null,
  promise: null,
  pastDays: null,
  staleDays: null,
  payments: [],
  words: [],
  tone: 'quiet',
})

describe('lineTakesWord', () => {
  it('a customer’s own call, voicemail, missed call, text or email; never ours, a note, or another kind of person', () => {
    for (const channel of ['call', 'voicemail', 'missed', 'text', 'email']) expect(lineTakesWord({ direction: 'in', channel }, { kind: 'customer' })).toBe(true)
    expect(lineTakesWord({ direction: 'out', channel: 'text' }, { kind: 'customer' })).toBe(false)
    expect(lineTakesWord({ direction: 'in', channel: 'note' }, { kind: 'customer' })).toBe(false)
    expect(lineTakesWord({ direction: 'in', channel: 'text' }, { kind: 'trade' })).toBe(false)
  })
})

describe('wordChannel', () => {
  it('a text is by text, an email by email, every call by phone', () => {
    expect(wordChannel('text')).toBe('text')
    expect(wordChannel('email')).toBe('email')
    expect(wordChannel('call')).toBe('phone')
    expect(wordChannel('voicemail')).toBe('phone')
    expect(wordChannel('missed')).toBe('phone')
  })
})

describe('wordLanding', () => {
  it('the line’s own job first, even with nothing open', () => {
    const got = wordLanding([line('j1', 4200), line('j2', null)], 'j2')
    expect(got).toMatchObject({ kind: 'job', why: 'tied' })
    expect((got as { line: BidMoneyLine }).line.job.id).toBe('j2')
  })
  it('the one job with money open, when the line is on none of theirs', () => {
    const got = wordLanding([line('j1', 4200), line('j2', 0), line('j3', null)], 'j9')
    expect(got).toMatchObject({ kind: 'job', why: 'only' })
    expect((got as { line: BidMoneyLine }).line.job.id).toBe('j1')
  })
  it('several with money open: the person picks among them only', () => {
    const got = wordLanding([line('j1', 4200), line('j2', 900), line('j3', 0)], null)
    expect(got.kind).toBe('pick')
    expect((got as { lines: BidMoneyLine[] }).lines.map((l) => l.job.id)).toEqual(['j1', 'j2'])
  })
  it('none open says so, and no jobs of theirs says that', () => {
    expect(wordLanding([line('j1', 0), line('j2', null)], null)).toEqual({ kind: 'none', words: NO_JOB_WORDS })
    expect(wordLanding([], null)).toEqual({ kind: 'none', words: NO_STANDING_WORDS })
  })
  it('the label', () => {
    expect(jobLabelOf(line('j1', 1))).toBe('#1032 · Whitfield repipe')
    expect(jobLabelOf(line('j1', 1, '', ''))).toBe('Job')
  })
})

/**
 * The day they said (v2.8255). Dana texts on Tue Oct 6 2026, 2:14 PM in Chicago; the office reads it that afternoon.
 * Made-up people and words.
 */
describe('heardDayOnLine', () => {
  const AT = '2026-10-06T19:14:00Z'
  const NOW = new Date('2026-10-06T19:40:00Z')
  const CUSTOMER = { kind: 'customer' }
  const text = (body: string, over: Partial<{ direction: string; channel: string; at: string }> = {}) => ({ direction: 'in', channel: 'text', at: AT, body, ...over })

  it('reads the day a customer’s text names, from the text’s own day', () => {
    expect(heardDayOnLine(text('We can pay Friday. Thanks for the patience.'), CUSTOMER, NOW)).toEqual({ ymd: '2026-10-09', label: 'Fri Oct 9', said: 'Friday', from: 'text' })
    expect(heardDayOnLine(text('Check goes out the 25th.'), CUSTOMER, NOW)?.ymd).toBe('2026-10-25')
    // Read three days later, "tomorrow" is still the day after the text.
    expect(heardDayOnLine(text('I will drop it off tomorrow'), CUSTOMER, new Date('2026-10-07T15:00:00Z'))?.ymd).toBe('2026-10-07')
  })
  it('reads a voicemail’s transcript as the line keeps it, in quotes', () => {
    expect(heardDayOnLine(text('"Hi, it’s Dana. Thursday after two works for us."', { channel: 'voicemail' }), CUSTOMER, NOW)).toEqual({ ymd: '2026-10-08', label: 'Thu Oct 8', said: 'Thursday', from: 'voicemail' })
    expect(heardDayOnLine(text('Voicemail.', { channel: 'voicemail' }), CUSTOMER, NOW)).toBeNull()
  })
  it('offers nothing once the day has gone by, or when no day is said', () => {
    expect(heardDayOnLine(text('We can pay Friday.'), CUSTOMER, new Date('2026-10-12T15:00:00Z'))).toBeNull()
    expect(heardDayOnLine(text('Thanks, got the invoice.'), CUSTOMER, NOW)).toBeNull()
    // The day itself still stands on the day.
    expect(heardDayOnLine(text('We can pay Friday.'), CUSTOMER, new Date('2026-10-09T22:00:00Z'))?.ymd).toBe('2026-10-09')
  })
  it('reads no day from a call’s summary, an email, a missed call, our own text, or another kind of person', () => {
    for (const channel of ['call', 'email', 'missed']) expect(heardDayOnLine(text('We can pay Friday.', { channel }), CUSTOMER, NOW)).toBeNull()
    expect(heardDayOnLine(text('We can come Friday.', { direction: 'out' }), CUSTOMER, NOW)).toBeNull()
    expect(heardDayOnLine(text('We can pay Friday.'), { kind: 'trade' }, NOW)).toBeNull()
  })
  it('the words: the day marked as a value beside the press, the hover, and the sheet’s line', () => {
    const offer = heardDayOnLine(text('We can pay Friday.'), CUSTOMER, NOW)!
    expect(heardDayWords(offer)).toBe('They said ⟪day|Fri Oct 9⟫.')
    expect(heardDayTip(offer)).toBe('Opens the sheet with Fri Oct 9 filled in. Nothing is written until you save.')
    expect(heardDaySheetLine(offer)).toBe('Fri Oct 9 is read from their text. Change it if they meant another day.')
    expect(heardDaySheetLine({ ...offer, from: 'voicemail' })).toBe('Fri Oct 9 is read from their voicemail. Change it if they meant another day.')
    expect([plainSentence(heardDayWords(offer)), heardDayTip(offer), heardDaySheetLine(offer)].flatMap(plainWordsFailures)).toEqual([])
  })
})

/** The mark a word leaves on its line (`write_down_payment`). */
describe('the mark on the line', () => {
  const mark = (message_id: string, kind: string | null, state: string, day: string | null) => ({ message_id, kind, state, day })
  it('Never said that takes the day off every line that carries it as a payment, and no other', () => {
    const promises = [
      mark('m1', 'payment', 'written', '2026-10-09'),
      mark('m2', 'payment', 'written', '2026-10-09'),
      mark('m3', 'payment', 'written', '2026-10-16'),
      mark('m4', 'decision', 'written', '2026-10-09'),
      mark('m5', null, 'offered', '2026-10-09'),
      mark('m6', null, 'no', '2026-10-09'),
      mark('m7', 'said', 'written', '2026-10-09'),
    ]
    expect(linesMarkedFor(promises, '2026-10-09')).toEqual(['m1', 'm2'])
    expect(linesMarkedFor(promises, '2026-10-10')).toEqual([])
    expect(linesMarkedFor([], '2026-10-09')).toEqual([])
  })
  it('the day stays on the thread while another promise of theirs still names it (v2.8307)', () => {
    const word = (kind: 'promise' | 'paid_claim', promisedYmd: string) => ({ kind, promisedYmd }) as BidMoneyLine['words'][number]
    const other = { ...line('j2', 900, '1040'), words: [word('promise', '2026-10-16'), word('promise', '2026-10-09')] }
    expect(dayStillPromised([line('j1', 4200), other], '2026-10-09')).toBe(true)
    expect(dayStillPromised([line('j1', 4200), other], '2026-10-10')).toBe(false)
    // A paid claim names the day they say they paid: nothing to wait for.
    expect(dayStillPromised([{ ...line('j2', 900), words: [word('paid_claim', '2026-10-09')] }], '2026-10-09')).toBe(false)
    expect(dayStillPromised([line('j1', 4200)], '2026-10-09')).toBe(false)
    expect(dayStillPromised([], '2026-10-09')).toBe(false)
    expect(dayKeptWords('2026-10-09')).toBe('Their line still shows Fri Oct 9. Another promise of theirs names that day.')
    expect(plainWordsFailures(dayKeptWords('2026-10-09'))).toEqual([])
  })
  it('a client ahead of the push skips the mark without a word', () => {
    expect(markNotThereYet('Could not find the function public.write_down_payment(p_day, p_message_id) in the schema cache')).toBe(true)
    expect(markNotThereYet('PGRST202')).toBe(true)
    expect(markNotThereYet('Someone has said what that day is already.')).toBe(false)
  })
  it('a refusal says the job took the word, and gives the database’s own reason', () => {
    expect(lineNotMarkedWords('Someone has said what that day is already.')).toBe('The promise is saved on the job. Their line was not marked. Someone has said what that day is already.')
    expect(lineNotMarkedWords('  ')).toBe('The promise is saved on the job. Their line was not marked.')
    expect(lineStillMarkedWords('Only the office team can write down a promise.')).toBe('The word is off the job. Their line still shows the day. Only the office team can write down a promise.')
    expect([lineNotMarkedWords(''), lineStillMarkedWords('')].flatMap(plainWordsFailures)).toEqual([])
  })
})
