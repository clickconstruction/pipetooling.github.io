import { describe, expect, it } from 'vitest'
import { bidScoreReadiness, bidsToJudge, laborCompleteness, scoreHoldTitle, SCORE_HOLD_CHIP } from './scoreReadiness'
import { estimateHoldWords } from './estimatorScore'

const row = (h: number, kind = 'fixture') => ({ kind, rough_in_hrs_per_unit: h, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0 })

describe('laborCompleteness', () => {
  it('counts every row that is not a sub’s, and those with hours on any stage', () => {
    const c = laborCompleteness([row(1), row(0), { kind: 'task', rough_in_hrs_per_unit: 0, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: '2.5' }, row(4, 'sub')], 80)
    expect(c).toEqual({ rowsTotal: 3, rowsWithHours: 2, rateSet: true, usable: false })
  })

  it('reads usable at nine rows in ten with a rate, as the breakdown does', () => {
    const rows = [...Array.from({ length: 9 }, () => row(1)), row(0)]
    expect(laborCompleteness(rows, 80).usable).toBe(true)
    expect(laborCompleteness(rows, null).usable).toBe(false)
    expect(laborCompleteness([...rows, row(0)], 80).usable).toBe(false)
  })

  it('reads a bid with no rows as nothing estimated', () => {
    expect(laborCompleteness([], 80)).toEqual({ rowsTotal: 0, rowsWithHours: 0, rateSet: true, usable: false })
  })
})

describe('bidScoreReadiness', () => {
  const priced = { pricedRevenueUsd: 21000, pricedCostUsd: 9000, pricedUncostedUsd: 0 }
  const full = laborCompleteness([row(1), row(2)], 80)

  it('says nothing about a bid with no priced margin', () => {
    expect(bidScoreReadiness({ pricedRevenueUsd: null, pricedCostUsd: null, pricedUncostedUsd: null, labor: null, sent: false })).toEqual({ kind: 'unpriced' })
    expect(bidScoreReadiness({ pricedRevenueUsd: 0, pricedCostUsd: 0, pricedUncostedUsd: 0, labor: full, sent: false }).kind).toBe('unpriced')
  })

  it('is ready when the hours are in and every priced row has a cost', () => {
    expect(bidScoreReadiness({ ...priced, labor: full, sent: false })).toEqual({ kind: 'ready' })
  })

  it('holds a bid whose labor is not estimated, with the rows and the fix', () => {
    const r = bidScoreReadiness({ ...priced, labor: laborCompleteness([row(1), row(0), row(0)], 80), sent: false })
    expect(r).toMatchObject({ kind: 'hold', reason: 'labor', chip: SCORE_HOLD_CHIP })
    if (r.kind !== 'hold') throw new Error('held')
    expect(r.words).toBe('Labor not estimated: 1 of 3 rows has hours. The cost has little or no labor in it, so this bid cannot be scored.')
    expect(r.fix).toBe('Fill the hours on the Labor tab before it goes out.')
    expect(scoreHoldTitle(r)).toBe(`${r.words} ${r.fix}`)
  })

  it('says a Labor tab with no rows in words, never "0 of 0"', () => {
    const r = bidScoreReadiness({ ...priced, labor: laborCompleteness([], null), sent: false })
    if (r.kind !== 'hold') throw new Error('held')
    expect(r.words).toContain('the Labor tab has no rows')
    expect(estimateHoldWords({ ...priced, labor: laborCompleteness([], null) })).toBe('Labor not estimated: the Labor tab has no rows. The priced cost has little or no labor in it.')
  })

  it('holds on priced revenue with no cost once the labor stands', () => {
    const r = bidScoreReadiness({ ...priced, pricedUncostedUsd: 1234.4, labor: full, sent: false })
    expect(r).toMatchObject({ kind: 'hold', reason: 'uncosted' })
    if (r.kind !== 'hold') throw new Error('held')
    expect(r.words).toBe('$1,234 of the price is on rows with no cost, so the margin is partial and this bid cannot be scored.')
  })

  it('reads a sent bid in the past tense: the margin was kept at send', () => {
    const labor = bidScoreReadiness({ ...priced, labor: laborCompleteness([row(0)], 80), sent: true })
    const uncosted = bidScoreReadiness({ ...priced, pricedUncostedUsd: 500, labor: full, sent: true })
    if (labor.kind !== 'hold' || uncosted.kind !== 'hold') throw new Error('held')
    expect(labor.words).toContain('went out with little or no labor in its cost')
    expect(labor.fix).toBe('Its margin was kept when it was sent. Fill the Labor tab before the next bid goes out.')
    expect(uncosted.words).toBe('$500 of the price went out on rows with no cost, so the margin is partial and this bid cannot be scored.')
  })

  it('does not hold on labor it could not read', () => {
    expect(bidScoreReadiness({ ...priced, labor: null, sent: false })).toEqual({ kind: 'ready' })
  })

  it('agrees with the Scores tab’s own hold on every case', () => {
    const cases = [
      { ...priced, labor: full },
      { ...priced, labor: laborCompleteness([row(0)], 80) },
      { ...priced, pricedUncostedUsd: 80, labor: full },
      { ...priced, labor: null },
    ]
    for (const c of cases) expect(bidScoreReadiness({ ...c, sent: true }).kind === 'hold').toBe(estimateHoldWords(c) != null)
  })
})

describe('bidsToJudge', () => {
  it('keeps the bids with a priced margin that are not lost', () => {
    const bids = [
      { id: 'a', outcome: null, priced_revenue_usd: 100, priced_cost_usd: 60 },
      { id: 'b', outcome: 'lost', priced_revenue_usd: 100, priced_cost_usd: 60 },
      { id: 'c', outcome: 'won', priced_revenue_usd: null, priced_cost_usd: null },
      { id: 'd', outcome: 'won', priced_revenue_usd: 100, priced_cost_usd: 0 },
    ]
    expect(bidsToJudge(bids).map((b) => b.id)).toEqual(['a', 'd'])
  })
})
