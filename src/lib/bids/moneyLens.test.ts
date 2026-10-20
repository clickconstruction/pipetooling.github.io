import { describe, expect, it } from 'vitest'
import type { BidMoneyLine } from './bidMoneyLine'
import { buildMoneyLens, moneyLensRollup, moneyStanding, MONEY_LENS_EMPTY_ALL, type MoneyLensBid } from './moneyLens'

const line = (over: Partial<BidMoneyLine> & { bidId: string }, job: Partial<BidMoneyLine['job']> = {}): BidMoneyLine => ({
  job: { id: `j-${over.bidId}`, number: '1032', name: 'Whitfield repipe', status: 'billed', customerId: 'c1', customerName: 'Dana', customerPhone: null, customerEmail: null, createdAt: null, ...job },
  stage: 'Billed Sep 30',
  open: 4200,
  bills: [{ kind: 'bill', id: 'i1', jobId: `j-${over.bidId}`, job: 'Whitfield repipe', number: '1032', open: true, amount: 4200, billedYmd: '2026-09-30', payUrl: null }],
  payUrl: null,
  promise: null,
  pastDays: null,
  staleDays: null,
  payments: [],
  words: [],
  tone: 'amber',
  ...over,
})
const promise = (ymd: string, kind: 'promise' | 'paid_claim' = 'promise') => ({ id: 'p', jobId: 'j', customerId: 'c1', promisedYmd: ymd, saidBy: 'Dana', heardByName: 'Theo', channel: 'text' as const, source: 'office' as const, note: null, createdAt: '2026-10-14T20:00:00Z', kind, method: kind === 'paid_claim' ? ('check_mailed' as const) : null, amount: null })
const bids: MoneyLensBid[] = [
  { id: 'b1', label: 'B512', estimatorName: 'Theo', estimatorUserId: 'u-theo', accountManagerUserId: null },
  { id: 'b2', label: 'B530', estimatorName: 'Kim', estimatorUserId: 'u-kim', accountManagerUserId: null },
  { id: 'b3', label: 'B521', estimatorName: 'Kim', estimatorUserId: 'u-kim', accountManagerUserId: 'u-theo' },
]

describe('moneyStanding', () => {
  it('each standing and its words', () => {
    expect(moneyStanding(line({ bidId: 'b1' }), '2026-10-19')).toEqual({ standing: 'noWord', words: 'no word · 19 d' })
    expect(moneyStanding(line({ bidId: 'b1', promise: promise('2026-10-25'), pastDays: 4 }), '2026-10-29')).toEqual({ standing: 'past', words: '4 days past' })
    expect(moneyStanding(line({ bidId: 'b1', promise: promise('2026-10-25'), pastDays: 1 }), '2026-10-26')).toEqual({ standing: 'past', words: '1 day past' })
    expect(moneyStanding(line({ bidId: 'b1', promise: promise('2026-11-02') }), '2026-10-19')).toEqual({ standing: 'waiting', words: 'waiting · Nov 2' })
    expect(moneyStanding(line({ bidId: 'b1', promise: promise('2026-10-20', 'paid_claim') }), '2026-10-22')).toEqual({ standing: 'claimed', words: 'they say paid' })
    expect(moneyStanding(line({ bidId: 'b1', promise: promise('2026-10-20', 'paid_claim'), staleDays: 9 }), '2026-10-29')).toEqual({ standing: 'stale', words: 'they say paid · nothing landed in 9 days' })
    expect(moneyStanding(line({ bidId: 'b1', open: 0 }), '2026-10-19')).toEqual({ standing: 'paid', words: 'paid' })
    expect(moneyStanding(line({ bidId: 'b1', open: null, bills: [] }), '2026-10-19')).toEqual({ standing: 'paid', words: 'not billed' })
  })
})

describe('buildMoneyLens', () => {
  const lines = [
    line({ bidId: 'b1', promise: promise('2026-10-25'), pastDays: 4 }),
    line({ bidId: 'b2', open: 2900 }),
    line({ bidId: 'b3', promise: promise('2026-11-02') }, { number: '1037' }),
    line({ bidId: 'b4', open: 0 }),
  ]
  it('the chase order, the rollup, and the paid job with no word left out', () => {
    const lens = buildMoneyLens({ lines, bids, authUserId: 'u-theo', today: '2026-10-29', onlyMine: false })
    expect(lens.rows.map((r) => [r.line.bidId, r.standing])).toEqual([
      ['b1', 'past'],
      ['b2', 'noWord'],
      ['b3', 'waiting'],
    ])
    expect(lens).toMatchObject({ open: 3, openTotal: 11300, pastWord: 1, stale: 0 })
    expect(moneyLensRollup(lens)).toBe('3 open · $11,300 · 1 past their word')
    expect(lens.rows[0]!.bidLabel).toBe('B512')
    expect(lens.rows[0]!.estimatorName).toBe('Theo')
  })
  it('Only my bids keeps the ones I estimated or account-manage', () => {
    const lens = buildMoneyLens({ lines, bids, authUserId: 'u-theo', today: '2026-10-29', onlyMine: true })
    expect(lens.rows.map((r) => r.line.bidId)).toEqual(['b1', 'b3'])
    expect(lens.rows.every((r) => r.isMine)).toBe(true)
    expect(buildMoneyLens({ lines, bids, authUserId: null, today: '2026-10-29', onlyMine: true }).rows).toEqual([])
  })
  it('a stale claim counts to ask about, and nothing open says so', () => {
    const lens = buildMoneyLens({ lines: [line({ bidId: 'b1', promise: promise('2026-10-20', 'paid_claim'), staleDays: 9 })], bids, authUserId: null, today: '2026-10-29', onlyMine: false })
    expect(moneyLensRollup(lens)).toBe('1 open · $4,200 · 1 to ask about')
    expect(moneyLensRollup(buildMoneyLens({ lines: [], bids, authUserId: null, today: '2026-10-29', onlyMine: false }))).toBe('nothing open')
    expect(MONEY_LENS_EMPTY_ALL).toMatch(/won job/)
  })
})
