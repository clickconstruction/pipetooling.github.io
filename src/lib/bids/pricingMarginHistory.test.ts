import { describe, expect, it } from 'vitest'

import type { BidPricingHistoryRow } from '../../types/database-functions'
import { isPriceLoss, marginHistoryScale, marginHistoryScaleLeft, marginHistoryVerdict, marginOfHistoryRow, pricingMarginHistoryView, type MarginHistoryBid } from './pricingMarginHistory'

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

describe('marginHistoryScale', () => {
  it('fits what it draws: two points of padding, snapped out to tens', () => {
    expect(marginHistoryScale([57.8, 79.1, 94.9, 82])).toEqual({ min: 50, max: 100, ticks: [50, 60, 70, 80, 90, 100] })
    expect(marginHistoryScale([31, 44])).toEqual({ min: 20, max: 50, ticks: [20, 30, 40, 50] })
  })

  it('is never narrower than thirty points, and widens upward first', () => {
    expect(marginHistoryScale([40])).toEqual({ min: 30, max: 60, ticks: [30, 40, 50, 60] })
    expect(marginHistoryScale([97])).toEqual({ min: 70, max: 100, ticks: [70, 80, 90, 100] })
  })

  it('stays inside −20…100 and thins its ticks once it is wider than sixty points', () => {
    expect(marginHistoryScale([-60, 140])).toEqual({ min: -20, max: 100, ticks: [-20, 0, 20, 40, 60, 80, 100] })
    expect(marginHistoryScale([5, 88]).ticks).toEqual([0, 20, 40, 60, 80])
  })

  it('has a default with nothing to draw and ignores a margin that is not a number', () => {
    expect(marginHistoryScale([])).toEqual({ min: 20, max: 50, ticks: [20, 30, 40, 50] })
    expect(marginHistoryScale([Number.NaN, 40])).toEqual(marginHistoryScale([40]))
  })
})

describe('marginHistoryScaleLeft', () => {
  it('places a margin on the fitted scale and draws anything outside at the nearer end', () => {
    const scale = { min: 50, max: 100 }
    expect(marginHistoryScaleLeft(50, scale)).toBe('0%')
    expect(marginHistoryScaleLeft(100, scale)).toBe('100%')
    expect(marginHistoryScaleLeft(75, scale)).toBe('50%')
    expect(marginHistoryScaleLeft(20, scale)).toBe('0%')
    expect(marginHistoryScaleLeft(120, scale)).toBe('100%')
  })
})

describe('isPriceLoss', () => {
  it('is the category, or the word in an old free-text reason with no category; a win never is', () => {
    expect(isPriceLoss({ outcome: 'lost', loss_category: 'price', loss_reason: null })).toBe(true)
    expect(isPriceLoss({ outcome: 'lost', loss_category: null, loss_reason: 'Their Price was lower' })).toBe(true)
    expect(isPriceLoss({ outcome: 'lost', loss_category: 'gc_lost', loss_reason: null })).toBe(false)
    // a recorded category is not overruled by a word in the note
    expect(isPriceLoss({ outcome: 'lost', loss_category: 'gc_lost', loss_reason: 'GC lost it, our price was fine' })).toBe(false)
    expect(isPriceLoss({ outcome: 'won', loss_category: 'price', loss_reason: 'price' })).toBe(false)
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
  const oneWin = withM([bid('won', 79)])

  it('says nothing with no current margin, or with neither a win nor a price loss', () => {
    expect(marginHistoryVerdict(null, won, lost)).toBeNull()
    expect(marginHistoryVerdict(0.4, [], [])).toBeNull()
  })

  it('is the winning range among the wins while no price loss sits at or below the margin', () => {
    expect(marginHistoryVerdict(0.4, won, lost)).toEqual({
      chip: 'in your winning range',
      sentence: '2 of 3 wins were priced at 40% or higher. No bid lost on price this low.',
      tone: 'good',
    })
  })

  it('warns once a price loss sits at or below it, and counts the losses', () => {
    expect(marginHistoryVerdict(0.44, won, lost)).toEqual({
      chip: 'wins and price losses here',
      sentence: '1 of 3 wins were priced at 44% or higher. 1 bid lost on price at or below it.',
      tone: 'warn',
    })
    expect(marginHistoryVerdict(0.44, won, withM([bid('lost', 41), bid('lost', 43)]))?.sentence).toContain('2 bids lost on price at or below it.')
  })

  it('is above every win past the highest one, naming it and the spread of the price losses', () => {
    expect(marginHistoryVerdict(0.5, won, lost)).toEqual({
      chip: 'above all 3 wins',
      sentence: '50% is above every win (highest 45%). 2 bids lost on price at 42–55%.',
      tone: 'warn',
    })
    expect(marginHistoryVerdict(0.5, won, withM([bid('lost', 42)]))?.sentence).toBe('50% is above every win (highest 45%). 1 bid lost on price at 42%.')
    expect(marginHistoryVerdict(0.5, won, [])?.sentence).toBe('50% is above every win (highest 45%).')
  })

  it('never calls a margin below every win a winning range', () => {
    expect(marginHistoryVerdict(0.25, won, lost)).toEqual({
      chip: 'below all 3 wins',
      sentence: '25% is below every win (lowest 30%). No bid lost on price this low.',
      tone: 'neutral',
    })
    // the case that read "In your winning range — 0 of 1 wins" before v2.4418
    expect(marginHistoryVerdict(0.54, oneWin, withM([bid('lost', 79), bid('lost', 84)]))).toEqual({
      chip: 'below your one win',
      sentence: '54% is below your one win (79%). No bid lost on price this low.',
      tone: 'neutral',
    })
    expect(marginHistoryVerdict(0.25, won, withM([bid('lost', 20)]))?.tone).toBe('warn')
  })

  it('speaks of one win as one win', () => {
    expect(marginHistoryVerdict(0.82, oneWin, withM([bid('lost', 79), bid('lost', 95)]))).toEqual({
      chip: 'above your one win',
      sentence: '82% is above your one win (79%). 2 bids lost on price at 79–95%.',
      tone: 'warn',
    })
    expect(marginHistoryVerdict(0.79, oneWin, [])).toEqual({ chip: 'level with your one win', sentence: '79% is level with your one win. No bid lost on price this low.', tone: 'good' })
  })

  it('with price losses and no win, says so', () => {
    expect(marginHistoryVerdict(0.5, [], lost)).toEqual({
      chip: 'where bids lost on price',
      sentence: 'No win has a usable cost estimate. 1 bid lost on price at or below 50%.',
      tone: 'warn',
    })
    expect(marginHistoryVerdict(0.3, [], lost)).toEqual({
      chip: 'below every price loss',
      sentence: 'No win has a usable cost estimate. Every price loss was above 30% (lowest 42%).',
      tone: 'neutral',
    })
  })

  it('gives half a point of tolerance at the edges', () => {
    // 45.4 % against a highest win of 45 % is still among the wins …
    expect(marginHistoryVerdict(0.454, won, [])?.chip).toBe('in your winning range')
    // … 45.6 % is above them …
    expect(marginHistoryVerdict(0.456, won, [])?.chip).toBe('above all 3 wins')
    // … and 29.6 % against a lowest win of 30 % is not below them.
    expect(marginHistoryVerdict(0.296, won, [])?.chip).toBe('in your winning range')
  })
})

describe('pricingMarginHistoryView — the scale, the count and the thin flag', () => {
  it('fits the scale to the dots, the tab marks and the current margin', () => {
    const rows = [bid('won', 79), bid('lost', 84), bid('lost', 89), bid('lost', 60, { loss_category: 'gc_lost', bid_tab_low: 2400 })]
    // the tab low of 2,400 over a cost of 1,000 → 58 %
    expect(view(rows, 0.82)?.scale).toEqual({ min: 50, max: 100, ticks: [50, 60, 70, 80, 90, 100] })
    expect(view(rows, 0.3)?.scale.min).toBe(20)
  })

  it('counts every bid won or lost on price, with a usable cost estimate or not', () => {
    const rows = [bid('won', 40), bid('won', 35), bid('lost', 50), bid('won', 99), bid('lost', 45, { est_cost: 0, bid_value: 500 }), bid('lost', 45, { loss_category: 'gc_lost' }), bid('won', 30, { bid_id: 'current' })]
    const v = view(rows)
    expect(v?.won.length).toBe(2)
    expect(v?.lostPrice.length).toBe(1)
    expect(v?.decidedOnNumber).toBe(5)
  })

  it('is thin below ten dots', () => {
    const nine = Array.from({ length: 9 }, (_, i) => bid('won', 30 + i))
    expect(view(nine)?.thin).toBe(true)
    expect(view([...nine, bid('lost', 50)])?.thin).toBe(false)
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
