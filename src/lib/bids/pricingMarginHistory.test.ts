import { describe, expect, it } from 'vitest'

import type { BidPricingHistoryRow } from '../../types/database-functions'
import { marginHistoryScaleLeft, marginHistoryVerdict, marginOfHistoryRow, pricingMarginHistoryView, type MarginHistoryBid } from './pricingMarginHistory'

let seq = 0
/** A past bid priced at `marginPct` over a cost of 1,000. */
function bid(outcome: 'won' | 'lost', marginPct: number, over: Partial<BidPricingHistoryRow> = {}): BidPricingHistoryRow {
  seq += 1
  const est_cost = 1000
  return { bid_id: `h${seq}`, project_name: `Project ${seq}`, outcome, loss_reason: null, loss_category: outcome === 'lost' ? 'price' : null, bid_value: est_cost / (1 - marginPct / 100), est_cost, ...over }
}
const withM = (rows: BidPricingHistoryRow[]): MarginHistoryBid[] => rows.map((h) => ({ ...h, m: marginOfHistoryRow(h) as number }))

const view = (history: BidPricingHistoryRow[] | null, currentMargin: number | null = 0.4, over: { currentBidId?: string; gcCustomerId?: string | null } = {}) =>
  pricingMarginHistoryView({ history, currentBidId: over.currentBidId ?? 'current', currentMargin, gcCustomerId: over.gcCustomerId ?? null })

describe('marginOfHistoryRow', () => {
  it('is (value − cost) ÷ value, and null with no value', () => {
    expect(marginOfHistoryRow({ bid_value: 2000, est_cost: 1200 })).toBeCloseTo(0.4)
    expect(marginOfHistoryRow({ bid_value: 1000, est_cost: 1500 })).toBeCloseTo(-0.5)
    expect(marginOfHistoryRow({ bid_value: 0, est_cost: 100 })).toBeNull()
  })
})

describe('marginHistoryScaleLeft', () => {
  it('runs 20 % to 65 % and draws anything outside at the nearer end', () => {
    expect(marginHistoryScaleLeft(20)).toBe('0%')
    expect(marginHistoryScaleLeft(65)).toBe('100%')
    expect(marginHistoryScaleLeft(42.5)).toBe('50%')
    expect(marginHistoryScaleLeft(5)).toBe('0%')
    expect(marginHistoryScaleLeft(90)).toBe('100%')
  })
})

describe('pricingMarginHistoryView — when the block shows', () => {
  it('stays away with no history, an empty one, or fewer than three bids won or lost on price', () => {
    expect(view(null)).toBeNull()
    expect(view([])).toBeNull()
    expect(view([bid('won', 40), bid('lost', 50)])).toBeNull()
    expect(view([bid('won', 40), bid('lost', 50), bid('won', 35)])).not.toBeNull()
  })

  it('never counts the bid on screen or a bid with no cost estimate', () => {
    const rows = [bid('won', 40), bid('won', 35), bid('won', 30, { bid_id: 'current' }), bid('won', 45, { est_cost: 0, bid_value: 500 })]
    expect(view(rows)).toBeNull()
    expect(view([...rows, bid('won', 38)])?.won.map((h) => Math.round(h.m * 100))).toEqual([40, 35, 38])
  })

  it('leaves out a margin outside −20 %…95 % — a barely-filled estimate', () => {
    const v = view([bid('won', 40), bid('won', 35), bid('won', 30), bid('won', 96), bid('won', -25)])
    expect(v?.won).toHaveLength(3)
  })

  it('counts a loss as "on price" by its category, or by the word in an old free-text reason', () => {
    const v = view([
      bid('won', 40),
      bid('won', 35),
      bid('lost', 50),
      bid('lost', 52, { loss_category: null, loss_reason: 'Their Price was lower' }),
      bid('lost', 55, { loss_category: 'schedule', loss_reason: 'could not start in time' }),
      bid('lost', 57, { loss_category: undefined, loss_reason: null }),
    ])
    expect(v?.lostPrice.map((h) => Math.round(h.m * 100))).toEqual([50, 52])
  })
})

describe('marginHistoryVerdict', () => {
  const won = withM([bid('won', 30), bid('won', 40), bid('won', 45)])
  const lost = withM([bid('lost', 42), bid('lost', 55)])

  it('says nothing with no current margin or no wins', () => {
    expect(marginHistoryVerdict(null, won, lost)).toBeNull()
    expect(marginHistoryVerdict(0.4, [], lost)).toBeNull()
  })

  it('is the winning range while no price loss sits at or below the margin', () => {
    expect(marginHistoryVerdict(0.4, won, lost)).toEqual({
      text: 'In your winning range — 2 of 3 wins priced at or below 40% (estimated margins).',
      color: 'var(--text-green-600)',
    })
  })

  it('is mixed territory once a price loss sits at or below it, and counts the losses', () => {
    expect(marginHistoryVerdict(0.44, won, lost)?.text).toBe('Mixed territory — wins exist here, but 1 price-loss sit at or below 44%.')
    expect(marginHistoryVerdict(0.44, won, withM([bid('lost', 41), bid('lost', 43)]))?.text).toBe('Mixed territory — wins exist here, but 2 price-losses sit at or below 44%.')
    expect(marginHistoryVerdict(0.44, won, lost)?.color).toBe('var(--text-amber-700)')
  })

  it('is above every win past the highest one, naming it and every price loss', () => {
    expect(marginHistoryVerdict(0.5, won, lost)).toEqual({
      text: 'Above every recorded win (max 45%) — 2 bids lost on price in this range.',
      color: 'var(--text-red-700)',
    })
    expect(marginHistoryVerdict(0.5, won, withM([bid('lost', 42)]))?.text).toContain('1 bid lost on price')
  })

  it('gives half a point of tolerance at the edge', () => {
    // 45.4 % against a highest win of 45 % is still "above" (the edge is the win itself) …
    expect(marginHistoryVerdict(0.454, won, [])?.text).toContain('Above every recorded win')
    // … while a win at 45 % counts as "at or below" a margin of 44.6 %
    expect(marginHistoryVerdict(0.446, won, [])?.text).toBe('In your winning range — 3 of 3 wins priced at or below 45% (estimated margins).')
  })
})

describe('pricingMarginHistoryView — recorded bid tabs', () => {
  const three = () => [bid('won', 40), bid('won', 35), bid('won', 30)]

  it('marks each recorded tab low at the margin that would have matched it', () => {
    // cost 1,000 against a low of 1,600 → 37.5 %
    const v = view([...three(), bid('lost', 50, { bid_tab_low: 1600, project_name: 'Elm St', customer_id: 'gc1' })])
    expect(v?.tabMarks).toEqual([{ label: 'Elm St', matchPct: 37.5, customerId: 'gc1' }])
  })

  it('takes a tab from any outcome, skips the bid on screen, and skips a low at or under our cost', () => {
    const v = view([
      ...three(),
      bid('lost', 50, { loss_category: 'schedule', bid_tab_low: 2000 }),
      bid('won', 41, { bid_id: 'current', bid_tab_low: 2000 }),
      bid('won', 42, { bid_tab_low: 900 }),
      bid('won', 43, { bid_tab_low: null }),
    ])
    expect(v?.tabMarks.map((t) => t.matchPct)).toEqual([50])
  })

  it('counts the tabs the current margin would have matched or beaten', () => {
    const rows = [...three(), bid('won', 40, { bid_tab_low: 1600 }), bid('won', 40, { bid_tab_low: 2000 })]
    expect(view(rows, 0.4)?.tabsMatched).toBe(1)
    expect(view(rows, 0.37)?.tabsMatched).toBe(2)
    expect(view(rows, 0.6)?.tabsMatched).toBe(0)
  })

  it('has no tabs line with no tabs or no current margin', () => {
    expect(view(three(), 0.4)?.tabsMatched).toBeNull()
    expect(view([...three(), bid('won', 40, { bid_tab_low: 1600 })], null)?.tabsMatched).toBeNull()
  })

  it('gives this GC its own line once it has two tabs — the range, rounded and in order', () => {
    const rows = [
      ...three(),
      bid('won', 40, { bid_tab_low: 2000, customer_id: 'gc1' }),
      bid('won', 40, { bid_tab_low: 1600, customer_id: 'gc1' }),
      bid('won', 40, { bid_tab_low: 1500, customer_id: 'gc2' }),
    ]
    expect(view(rows, 0.4, { gcCustomerId: 'gc1' })?.gcTabs).toEqual({ count: 2, lowPct: 38, highPct: 50 })
    expect(view(rows, 0.4, { gcCustomerId: 'gc2' })?.gcTabs).toBeNull()
    expect(view(rows, 0.4, { gcCustomerId: null })?.gcTabs).toBeNull()
    expect(view(rows, null, { gcCustomerId: 'gc1' })?.gcTabs).toBeNull()
  })
})
