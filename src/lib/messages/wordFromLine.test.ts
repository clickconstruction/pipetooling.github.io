import { describe, expect, it } from 'vitest'
import type { BidMoneyLine } from '../bids/bidMoneyLine'
import { jobLabelOf, lineTakesWord, NO_JOB_WORDS, NO_STANDING_WORDS, wordChannel, wordLanding } from './wordFromLine'

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
