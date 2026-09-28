// @vitest-environment jsdom
/**
 * Render smoke for "This number vs your history" (region P2 of the Pricing map): nothing
 * until three past bids were won or lost on price; then the verdict, a dot per bid, the
 * pointer at the current margin, and the tab lines only when tabs were recorded.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { PricingMarginHistory } from './PricingMarginHistory'
import type { BidPricingHistoryRow } from '../../types/database-functions'

let seq = 0
function bid(outcome: 'won' | 'lost', marginPct: number, over: Partial<BidPricingHistoryRow> = {}): BidPricingHistoryRow {
  seq += 1
  return { bid_id: `h${seq}`, project_name: `Project ${seq}`, outcome, loss_reason: null, loss_category: outcome === 'lost' ? 'price' : null, bid_value: 1000 / (1 - marginPct / 100), est_cost: 1000, ...over }
}

afterEach(() => cleanup())

describe('PricingMarginHistory', () => {
  it('renders nothing while the history loads or is too thin', () => {
    const { container, rerender } = render(<PricingMarginHistory history={null} currentBidId="b1" currentMargin={0.4} gcCustomerId={null} />)
    expect(container.textContent).toBe('')
    rerender(<PricingMarginHistory history={[bid('won', 40), bid('lost', 50)]} currentBidId="b1" currentMargin={0.4} gcCustomerId={null} />)
    expect(container.textContent).toBe('')
  })

  it('draws the verdict, a dot per bid and the pointer; no tab lines without a recorded tab', () => {
    const history = [bid('won', 30, { project_name: 'Oak Ave' }), bid('won', 45), bid('lost', 50, { project_name: 'Pine Rd' })]
    render(<PricingMarginHistory history={history} currentBidId="b1" currentMargin={0.4} gcCustomerId={null} />)
    expect(screen.getByText(/This number vs your history/)).toBeTruthy()
    expect(screen.getByText('In your winning range — 1 of 2 wins priced at or below 40% (estimated margins).')).toBeTruthy()
    expect(screen.getByTitle('Won: Oak Ave at ~30%')).toBeTruthy()
    expect(screen.getByTitle('Lost on price: Pine Rd at ~50%')).toBeTruthy()
    // the scale's 40% tick and the pointer's own label
    expect(screen.getAllByText('40%')).toHaveLength(2)
    expect(screen.queryByText(/margin to match a recorded tab low/)).toBeNull()
    expect(screen.queryByText(/would have matched or beaten/)).toBeNull()
  })

  it('with no current margin there is no verdict and no pointer', () => {
    render(<PricingMarginHistory history={[bid('won', 30), bid('won', 45), bid('lost', 50)]} currentBidId="b1" currentMargin={null} gcCustomerId={null} />)
    expect(screen.queryByText(/winning range|Mixed territory|Above every/)).toBeNull()
    expect(screen.getAllByText('40%')).toHaveLength(1)
  })

  it('with recorded tabs: a mark per tab, the count the margin would have matched, and this GC’s range', () => {
    const history = [
      bid('won', 30),
      bid('won', 45),
      bid('lost', 50),
      bid('won', 40, { bid_tab_low: 2000, customer_id: 'gc1', project_name: 'Elm St' }),
      bid('won', 40, { bid_tab_low: 1600, customer_id: 'gc1' }),
    ]
    const { container } = render(<PricingMarginHistory history={history} currentBidId="b1" currentMargin={0.4} gcCustomerId="gc1" />)
    expect(screen.getByTitle('Tab low on Elm St: ~50% would have matched it')).toBeTruthy()
    expect(screen.getByText(/margin to match a recorded tab low/)).toBeTruthy()
    expect(container.textContent).toContain('At 40%, this number would have matched or beaten the low on 1 of 2 recorded tabs.')
    expect(container.textContent).toContain('This GC\'s 2 tabs needed 38–50% to match the low.')
  })

  it('one tab reads in the singular and another GC’s tabs earn no line', () => {
    const history = [bid('won', 30), bid('won', 45), bid('lost', 50), bid('won', 40, { bid_tab_low: 2000, customer_id: 'gc2' })]
    const { container } = render(<PricingMarginHistory history={history} currentBidId="b1" currentMargin={0.4} gcCustomerId="gc1" />)
    expect(container.textContent).toContain('1 of 1 recorded tab.')
    expect(container.textContent).not.toContain('This GC')
  })
})
