import { describe, expect, it } from 'vitest'

import type { BidPricingHistoryRow } from '../../types/database-functions'
import { bidsLikeThisView, formatCompactDollars, LIKE_THIS_LIST_MAX, tabLowNote, tallyDecidedBids, tallyParts } from './bidsLikeThis'

let seq = 0
/** A decided bid at `value`; a loss is on price unless `over` says otherwise. No cost estimate unless given. */
function bid(outcome: 'won' | 'lost', value: number, over: Partial<BidPricingHistoryRow> = {}): BidPricingHistoryRow {
  seq += 1
  return { bid_id: `h${seq}`, project_name: `Project ${seq}`, outcome, loss_reason: null, loss_category: outcome === 'lost' ? 'price' : null, bid_value: value, est_cost: 0, ...over }
}
const view = (history: BidPricingHistoryRow[] | null, over: { price?: number | null; margin?: number | null; gc?: string | null; gcName?: string | null; currentBidId?: string } = {}) =>
  bidsLikeThisView({ history, currentBidId: over.currentBidId ?? 'current', currentPrice: over.price === undefined ? 100_000 : over.price, currentMargin: over.margin ?? null, gcCustomerId: over.gc ?? null, gcName: over.gcName })

describe('formatCompactDollars', () => {
  it('reads $950, $115k and $1.2M', () => {
    expect(formatCompactDollars(950)).toBe('$950')
    expect(formatCompactDollars(114_500)).toBe('$115k')
    expect(formatCompactDollars(458_202)).toBe('$458k')
    expect(formatCompactDollars(999_499)).toBe('$999k')
    expect(formatCompactDollars(999_500)).toBe('$1M')
    expect(formatCompactDollars(1_230_000)).toBe('$1.2M')
  })
})

describe('tabLowNote', () => {
  it('says nothing with no recorded low', () => {
    expect(tabLowNote(100_000, null)).toBeNull()
    expect(tabLowNote(100_000, 0)).toBeNull()
    expect(tabLowNote(0, 50_000)).toBeNull()
  })

  it('says how far over the low we were: the low itself, a percent, or a multiple from double', () => {
    expect(tabLowNote(39_920, 39_919)).toBe('low bid $39,919 · we were the low')
    expect(tabLowNote(38_000, 39_919)).toBe('low bid $39,919 · we were the low')
    expect(tabLowNote(134_000, 100_000)).toBe('low bid $100,000 · we were 34% over')
    expect(tabLowNote(229_101, 112_000)).toBe('low bid $112,000 · we were 2.0× the low')
  })
})

describe('tallyDecidedBids', () => {
  it('counts won, lost on price and the GC losing the project apart from every other loss', () => {
    const t = tallyDecidedBids([
      bid('won', 1),
      bid('lost', 1),
      bid('lost', 1, { loss_category: null, loss_reason: 'price was high' }),
      bid('lost', 1, { loss_category: 'gc_lost' }),
      bid('lost', 1, { loss_category: 'no_answer' }),
      bid('lost', 1, { loss_category: 'no_answer' }),
      bid('lost', 1, { loss_category: 'project_died' }),
      bid('lost', 1, { loss_category: null }),
    ])
    expect(t).toEqual({
      total: 8,
      won: 1,
      lostPrice: 2,
      gcLost: 1,
      other: 4,
      otherReasons: [
        { label: 'No answer', count: 2 },
        { label: 'No reason recorded', count: 1 },
        { label: 'Project died / on hold', count: 1 },
      ],
    })
    expect(tallyParts(t)).toEqual(['1 won', '2 lost on price', '1 the GC lost the project', '4 other'])
  })

  it('leaves the zero parts out', () => {
    expect(tallyParts(tallyDecidedBids([bid('lost', 1, { loss_category: 'gc_lost' })]))).toEqual(['1 the GC lost the project'])
  })
})

describe('bidsLikeThisView — when the block shows', () => {
  it('stays away with no history, an empty one, or nothing like this bid', () => {
    expect(view(null)).toBeNull()
    expect(view([])).toBeNull()
    // one decided bid, far from this size, no GC, no margins
    expect(view([bid('won', 900_000)])).toBeNull()
  })

  it('never counts the bid on screen or a bid with no value', () => {
    expect(view([bid('won', 100_000, { bid_id: 'current' }), bid('won', 0)])).toBeNull()
  })
})

describe('bidsLikeThisView — this size', () => {
  it('is half to double the price on the Workbench, ends included', () => {
    const v = view([bid('won', 50_000), bid('won', 200_000), bid('won', 49_999), bid('won', 200_001)])
    expect(v?.size?.low).toBe(50_000)
    expect(v?.size?.high).toBe(200_000)
    expect(v?.size?.tally.total).toBe(2)
  })

  it('has no size fact with no price yet, or with no decided bid this size', () => {
    const rows = [bid('won', 100_000, { customer_id: 'gc1' })]
    expect(view(rows, { price: null, gc: 'gc1' })?.size).toBeNull()
    expect(view(rows, { price: 0, gc: 'gc1' })?.size).toBeNull()
    expect(view(rows, { price: 900_000, gc: 'gc1' })?.size).toBeNull()
  })

  it('counts the bids decided on our number in the chip, red when price losses lead and green when wins do', () => {
    const lossy = view([bid('won', 90_000), bid('lost', 100_000), bid('lost', 110_000), bid('lost', 120_000, { loss_category: 'gc_lost' })])
    expect(lossy?.size?.chip).toEqual({ text: 'This size · 1 won · 2 lost on price', tone: 'bad' })
    const winning = view([bid('won', 90_000), bid('won', 95_000), bid('lost', 110_000)])
    expect(winning?.size?.chip).toEqual({ text: 'This size · 2 won · 1 lost on price', tone: 'good' })
    expect(view([bid('won', 90_000), bid('lost', 110_000)])?.size?.chip.tone).toBe('neutral')
  })

  it('says so when no bid this size was decided on price', () => {
    const v = view([bid('lost', 90_000, { loss_category: 'gc_lost' }), bid('lost', 95_000, { loss_category: 'no_answer' })])
    expect(v?.size?.chip).toEqual({ text: 'This size · 2 decided, none on price', tone: 'neutral' })
    expect(v?.size?.rows).toEqual([])
  })

  it('names the bids won or lost on price, closest in size first — by ratio, not by dollars', () => {
    const v = view([
      bid('lost', 190_000, { project_name: 'Far above' }),
      bid('won', 60_000, { project_name: 'Below' }),
      bid('lost', 105_000, { project_name: 'Close', bid_tab_low: 50_000 }),
      bid('lost', 101_000, { project_name: 'GC lost it', loss_category: 'gc_lost' }),
      bid('won', 120_000, { project_name: '  ' }),
    ])
    // 60k is 1.67× away, 190k is 1.9× away — the dollars would have put them the other way round
    expect(v?.size?.rows.map((r) => r.name)).toEqual(['Close', '—', 'Below', 'Far above'])
    expect(v?.size?.rows[0]).toEqual({ bidId: expect.any(String), name: 'Close', value: 105_000, outcome: 'lostPrice', tabNote: 'low bid $50,000 · we were 2.1× the low' })
    expect(v?.size?.rows[1]?.outcome).toBe('won')
    expect(v?.size?.moreRows).toBe(0)
  })

  it('stops the list at six and counts the rest', () => {
    const v = view(Array.from({ length: LIKE_THIS_LIST_MAX + 3 }, (_, i) => bid('lost', 100_000 + i * 1_000)))
    expect(v?.size?.rows).toHaveLength(LIKE_THIS_LIST_MAX)
    expect(v?.size?.moreRows).toBe(3)
  })
})

describe('bidsLikeThisView — this GC', () => {
  it('counts every decided bid for the GC, whatever its size', () => {
    const v = view(
      [bid('won', 900_000, { customer_id: 'gc1' }), bid('lost', 5_000, { customer_id: 'gc1' }), bid('lost', 5_000, { customer_id: 'gc1', loss_category: 'gc_lost' }), bid('won', 100_000, { customer_id: 'gc2' })],
      { gc: 'gc1' },
    )
    expect(v?.gc?.chip).toEqual({ text: 'This GC · 1 won of 3', tone: 'neutral' })
    expect(v?.gc?.sentence).toBe('With this GC: 3 decided bids. 1 won, 1 lost on price, 1 the GC lost the project.')
  })

  it('reads in the singular', () => {
    expect(view([bid('lost', 5_000, { customer_id: 'gc1', loss_category: 'no_answer' })], { gc: 'gc1' })?.gc?.sentence).toBe('With this GC: 1 decided bid. 1 other.')
  })

  it('a GC with no decided bid earns a chip only beside another fact', () => {
    expect(view([bid('won', 100_000, { customer_id: 'gc2' })], { gc: 'gc1' })?.gc).toEqual({
      tally: expect.objectContaining({ total: 0 }),
      chip: { text: 'This GC · no decided bids yet', tone: 'neutral' },
      sentence: null,
    })
    expect(view([bid('won', 900_000, { customer_id: 'gc2' })], { gc: 'gc1' })).toBeNull()
  })

  it('says the GC by name, cut short on the chip and whole in the sentence', () => {
    const rows = [bid('won', 100_000, { customer_id: 'gc1' }), bid('lost', 100_000, { customer_id: 'gc1' })]
    expect(view(rows, { gc: 'gc1', gcName: 'Journeyman' })?.gc?.chip.text).toBe('Journeyman · 1 won of 2')
    const long = view(rows, { gc: 'gc1', gcName: '  PlanHub - Subcontractor Prime Opportunity ' })
    expect(long?.gc?.chip.text).toBe('PlanHub - Subcontractor Pri… · 1 won of 2')
    expect(long?.gc?.sentence).toBe('With PlanHub - Subcontractor Prime Opportunity: 2 decided bids. 1 won, 1 lost on price.')
    expect(view([bid('won', 100_000, { customer_id: 'gc2' })], { gc: 'gc1', gcName: 'Journeyman' })?.gc?.chip.text).toBe('Journeyman · no decided bids yet')
    expect(view(rows, { gc: 'gc1', gcName: '  ' })?.gc?.chip.text).toBe('This GC · 1 won of 2')
  })

  it('has no GC fact on a bid with no GC', () => {
    expect(view([bid('won', 100_000, { customer_id: 'gc1' })])?.gc).toBeNull()
  })
})

describe('bidsLikeThisView — the margin', () => {
  /** A past bid priced at `marginPct` over a cost of 1,000. */
  const atMargin = (outcome: 'won' | 'lost', marginPct: number) => bid(outcome, 1000 / (1 - marginPct / 100), { est_cost: 1000 })

  it('stays away below three bids with a usable cost estimate, and shows without a size fact', () => {
    expect(view([atMargin('won', 40), atMargin('lost', 50)], { margin: 0.4, price: null })).toBeNull()
    const v = view([atMargin('won', 40), atMargin('won', 30), atMargin('lost', 50)], { margin: 0.45, price: null })
    expect(v?.size).toBeNull()
    expect(v?.margin?.chip).toEqual({ text: '45% · above all 2 wins', tone: 'warn' })
  })

  it('has the scale but no chip with no margin on the Workbench yet', () => {
    const v = view([atMargin('won', 40), atMargin('won', 30), atMargin('lost', 50)], { margin: null })
    expect(v?.margin?.chip).toBeNull()
    expect(v?.margin?.won).toHaveLength(2)
  })
})
