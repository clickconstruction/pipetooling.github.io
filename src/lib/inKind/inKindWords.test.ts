import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { parseInKindAddResult } from './inKindLedger'
import {
  IN_KIND_A_JOB_WHY,
  IN_KIND_OVERHEAD_WHY,
  IN_KIND_WINDOW_NOTE,
  addLinePress,
  addedWords,
  aheadWords,
  byHandWords,
  candidateJobWords,
  countsAsWords,
  dayWords,
  heldWords,
  jobLabel,
  jobLine,
  kindWords,
  leftWords,
  lineWentWords,
  parseAmount,
  placedWords,
  takeBackWords,
  termsSentence,
  unappliedWords,
  unbilledWords,
  usd,
} from './inKindWords'

const rent = { what_given: 'Rent credit, the shop.', monthly_amount: 1500, monthly_due: 3000, starts_on: '2026-05-01' }
const concrete = { what_given: 'Concrete, as delivered', monthly_amount: null, monthly_due: null, starts_on: null }

describe('the words are plain', () => {
  const held = { job_id: 'j4', invoice_id: 'i4', hcp_number: '1113', click_number: null, job_name: 'Kitchen repipe', open: 500, why: 'stripe' as const }
  const sentences = [
    termsSentence(rent),
    termsSentence(concrete),
    leftWords({ left: 9375.4, openJobCount: 8 }),
    leftWords({ left: 0, openJobCount: 0 }),
    aheadWords(900) ?? '',
    unbilledWords({ unbilled: 250, unbilledJobCount: 1 }) ?? '',
    byHandWords({ byHand: 8000, byHandCount: 14 }) ?? '',
    byHandWords({ byHand: 500, byHandCount: 1 }) ?? '',
    placedWords({ pays_off: true, left_after: 0 }),
    placedWords({ pays_off: false, left_after: 1092.9 }),
    heldWords(held),
    unappliedWords(274.5, 4725.5) ?? '',
    unappliedWords(100, 0) ?? '',
    takeBackWords(3000, 2).body,
    takeBackWords(885, 1).body,
    takeBackWords(900, 0).body,
    IN_KIND_OVERHEAD_WHY,
    IN_KIND_A_JOB_WHY,
    IN_KIND_WINDOW_NOTE,
    candidateJobWords({ status: 'billed', revenue: 100, payments_made: 0, in_kind_arrangement_id: 'other' }, 'mine').words,
    lineWentWords(0, [], 0),
    lineWentWords(900, [], 900),
  ]
  it.each(sentences)('%s', (s) => {
    expect(s).not.toBe('')
    expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('termsSentence', () => {
  it('says a monthly deal with its amount, its first month and the whole bill', () => {
    expect(termsSentence(rent)).toBe('Rent credit, the shop. $1,500.00 a month since May 2026. A month with nothing paid credits $3,000.00.')
  })
  it('leaves the whole bill out when it is not known', () => {
    expect(termsSentence({ ...rent, monthly_due: null })).toBe('Rent credit, the shop. $1,500.00 a month since May 2026.')
  })
  it('says a deal with no schedule takes a line when something is given', () => {
    expect(termsSentence(concrete)).toBe('Concrete, as delivered. A line is added when something is given.')
  })
})

describe('the small words', () => {
  it('names a job by its number, else its name', () => {
    expect(jobLabel({ hcp_number: '1101', click_number: 'C9', job_name: 'Shop' })).toBe('1101')
    expect(jobLabel({ hcp_number: '', click_number: 'C9', job_name: 'Shop' })).toBe('C9')
    expect(jobLabel({ hcp_number: null, click_number: null, job_name: 'Shop' })).toBe('Shop')
    expect(jobLabel({})).toBe('A job')
    expect(jobLine({ hcp_number: '1101', job_name: 'Shop restroom' })).toBe('1101 Shop restroom')
  })
  it('says the kind of deal', () => {
    expect(kindWords({ monthly_amount: 1500, starts_on: '2026-05-01', ended_at: null })).toBe('Every month')
    expect(kindWords({ monthly_amount: null, starts_on: null, ended_at: null })).toBe('As it comes')
    expect(kindWords({ monthly_amount: 1500, starts_on: '2026-05-01', ended_at: '2026-11-01T00:00:00Z' })).toBe('Ended')
  })
  it('formats money and reads a typed amount', () => {
    expect(usd(1500)).toBe('$1,500.00')
    expect(usd(680.5)).toBe('$680.50')
    expect(parseAmount('1,596.00')).toBe(1596)
    expect(parseAmount('$885')).toBe(885)
    expect(parseAmount('.5')).toBe(0.5)
    expect(Number.isNaN(parseAmount(''))).toBe(true)
    expect(Number.isNaN(parseAmount('12.345'))).toBe(true)
    expect(Number.isNaN(parseAmount('abc'))).toBe(true)
    expect(Number.isNaN(parseAmount('-5'))).toBe(true)
  })
  it('writes a day', () => {
    expect(dayWords('2026-11-04')).toBe('Nov 4, 2026')
    expect(dayWords(null)).toBe('')
  })
  it('names the save press with its amount', () => {
    expect(addLinePress(885)).toBe('Add the line for $885.00')
    expect(addLinePress(0)).toBe('Add the line')
  })
  it('says what is not billed yet', () => {
    expect(unbilledWords({ unbilled: 250, unbilledJobCount: 1 })).toBe('$250.00 more is on 1 job not billed yet.')
    expect(unbilledWords({ unbilled: 350, unbilledJobCount: 2 })).toBe('$350.00 more is on 2 jobs not billed yet.')
    expect(unbilledWords({ unbilled: 0, unbilledJobCount: 0 })).toBeNull()
  })
  it('says nothing when nothing is ahead, by hand or unplaced', () => {
    expect(aheadWords(0)).toBeNull()
    expect(byHandWords({ byHand: 0, byHandCount: 0 })).toBeNull()
    expect(unappliedWords(0, 100)).toBeNull()
  })
  it('says what a line counts as', () => {
    expect(countsAsWords(null, false)).toBe('Overhead')
    expect(countsAsWords({ hcp_number: '1158', job_name: 'Oak Hollow' }, true)).toBe('1158 Oak Hollow')
    expect(countsAsWords(null, true)).toBe('A job')
  })
  it('reads a job in the list of jobs a deal could pay', () => {
    expect(candidateJobWords({ status: 'billed', revenue: 1480, payments_made: 799.5, in_kind_arrangement_id: null }, null)).toEqual({ words: '$680.50 open.', locked: false })
    expect(candidateJobWords({ status: 'paid', revenue: 100, payments_made: 100, in_kind_arrangement_id: 'mine' }, 'mine')).toEqual({ words: 'Paid.', locked: false })
    expect(candidateJobWords({ status: 'working', revenue: 100, payments_made: 0, in_kind_arrangement_id: null }, null)).toEqual({ words: 'Not billed yet.', locked: false })
    expect(candidateJobWords({ status: 'billed', revenue: 100, payments_made: 0, in_kind_arrangement_id: 'other' }, 'mine').locked).toBe(true)
  })
})

describe('addedWords', () => {
  const placed = (hcp: string, pays_off: boolean) => ({ job_id: hcp, invoice_id: 'i', hcp_number: hcp, click_number: null, job_name: null, amount: 100, left_after: pays_off ? 0 : 5, pays_off })
  it('names the one bill it paid off', () => {
    expect(addedWords(parseInKindAddResult({ ok: true, applied: [placed('1120', true), placed('1126', false)] }), 1500)).toBe('The line for $1,500.00 is added. 1120 is Paid.')
  })
  it('counts several', () => {
    expect(addedWords(parseInKindAddResult({ ok: true, applied: [placed('1', true), placed('2', true)] }), 5000)).toBe('The line for $5,000.00 is added. 2 bills are Paid.')
  })
  it('says when it is on no bill', () => {
    expect(addedWords(parseInKindAddResult({ ok: true, applied: [], unapplied: 900 }), 900)).toBe('The line for $900.00 is added. It is on no bill yet.')
  })
  it('is short when a bill is only paid down', () => {
    expect(addedWords(parseInKindAddResult({ ok: true, applied: [placed('1126', false)] }), 885)).toBe('The line for $885.00 is added.')
  })
})

describe('takeBackWords', () => {
  it('names the act and the amount on its press', () => {
    expect(takeBackWords(3000, 2).confirmLabel).toBe('Take back $3,000.00')
    expect(takeBackWords(3000, 2).title).toBe('Take this line back?')
  })
})

describe('lineWentWords', () => {
  it('names the bills a line went to and what is on none', () => {
    expect(lineWentWords(1500, [{ label: '1120', amount: 680.5 }, { label: '1126', amount: 819.5 }], 0)).toBe('Went to 1120 $680.50, 1126 $819.50.')
    expect(lineWentWords(5000, [{ label: '1109', amount: 3420 }], 1580)).toBe('Went to 1109 $3,420.00. $1,580.00 of it is on no bill.')
    expect(lineWentWords(900, [], 900)).toBe('It is on no bill yet.')
    expect(lineWentWords(0, [], 0)).toBe('The whole bill was paid, so this month has no credit.')
  })
})
