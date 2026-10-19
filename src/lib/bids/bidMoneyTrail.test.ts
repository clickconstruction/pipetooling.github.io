import { describe, expect, it } from 'vitest'
import type { JobActivityMessage } from '../jobs/jobActivityMessages'
import type { BidMoneyLine } from './bidMoneyLine'
import { buildMoneyTrail, trailDayWords, wordWords } from './bidMoneyTrail'

const word = (over: Record<string, unknown> = {}): BidMoneyLine['words'][number] => ({ id: 'p1', jobId: 'j1', customerId: 'c1', promisedYmd: '2026-10-25', saidBy: 'Dana', heardByName: 'Theo', channel: 'text', source: 'office', note: null, createdAt: '2026-10-14T20:12:00Z', kind: 'promise', method: null, amount: null, ...over }) as BidMoneyLine['words'][number]

const line: BidMoneyLine = {
  bidId: 'b1',
  job: { id: 'j1', number: '1032', name: 'Whitfield repipe', status: 'billed', customerId: 'c1', customerName: 'Dana Whitfield', customerPhone: null, customerEmail: null, createdAt: null },
  stage: 'Billed Sep 30',
  open: 3000,
  bills: [{ kind: 'bill', id: 'i1', jobId: 'j1', job: 'Whitfield repipe', number: '1032', open: true, amount: 3000, billedYmd: '2026-09-30', payUrl: 'https://pay/i1' }],
  payUrl: 'https://pay/i1',
  promise: word({ id: 'w2', kind: 'paid_claim', method: 'check_mailed', promisedYmd: '2026-10-20', createdAt: '2026-10-21T14:40:00Z', note: 'Check #1187' }),
  pastDays: null,
  staleDays: null,
  tone: 'quiet',
  payments: [{ invoice_id: 'i1', job_id: 'j1', amount: 1200, paid_on: '2026-10-02', sequence_order: 0 }],
  words: [word({ id: 'w2', kind: 'paid_claim', method: 'check_mailed', promisedYmd: '2026-10-20', createdAt: '2026-10-21T14:40:00Z', note: 'Check #1187' }), word()],
}

const msg = (over: Partial<JobActivityMessage> = {}): JobActivityMessage => ({ id: 'm1', contactId: 'c1', contact: { name: 'Dana Whitfield', goesBy: 'Dana', kind: 'customer' }, channel: 'text', direction: 'in', at: '2026-10-14T20:11:00Z', who: '', body: 'Check goes out the 25th.', tied: true, ...over })

describe('buildMoneyTrail', () => {
  it('bills, payments, words and lines on one timeline, newest first, notes and events left out', () => {
    const trail = buildMoneyTrail(line, [msg(), msg({ id: 'm2', direction: 'out', who: 'Theo', at: '2026-10-14T19:58:00Z', body: 'Bill went out Tuesday.' }), msg({ id: 'm3', channel: 'note', at: '2026-10-15T10:00:00Z' }), msg({ id: 'm4', channel: 'call', at: '2026-10-16T10:00:00Z', summary: 'She will mail a check.' })])
    expect(trail.map((t) => [t.kind, t.who, t.words])).toEqual([
      ['word', 'They said', 'says they paid Oct 20 · a check in the mail · Dana · by text · heard by Theo · “Check #1187”'],
      ['line', 'Dana', 'call · She will mail a check.'],
      ['word', 'They said', 'will pay by Oct 25 · Dana · by text · heard by Theo'],
      ['line', 'Dana', 'text · Check goes out the 25th.'],
      ['line', 'Theo', 'text · Bill went out Tuesday.'],
      ['payment', 'Payment', '$1,200 landed'],
      ['bill', 'Bill sent', '$3,000 · open · pay page'],
    ])
    expect(trail[6]!.href).toBe('https://pay/i1')
    expect(trail[3]!.theirs).toBe(true)
    expect(trail[4]!.theirs).toBe(false)
    expect(trailDayWords(trail[6]!.ymd)).toBe('Sep 30, 2026')
  })
  it('with no lines read, the money alone', () => {
    expect(buildMoneyTrail(line, null).map((t) => t.kind)).toEqual(['word', 'word', 'payment', 'bill'])
  })
  it('a word’s words', () => {
    expect(wordWords(word({ saidBy: null, heardByName: null, channel: null }))).toBe('will pay by Oct 25')
  })
})
