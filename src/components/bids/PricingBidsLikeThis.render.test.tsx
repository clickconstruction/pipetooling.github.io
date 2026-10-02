// @vitest-environment jsdom
/**
 * Render smoke for "Bids like this" (region P2 of the Pricing map): nothing until there is a
 * bid like this one; one line of chips when folded; the outcome bar, the named bids, the GC's
 * record and the margin scale when unfolded; and the fold is remembered on the device.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PricingBidsLikeThis } from './PricingBidsLikeThis'
import type { BidPricingHistoryRow } from '../../types/database-functions'

let seq = 0
/** A past bid priced at `marginPct` over a cost of 1,000; a loss is on price unless `over` says otherwise. */
function bid(outcome: 'won' | 'lost', marginPct: number, over: Partial<BidPricingHistoryRow> = {}): BidPricingHistoryRow {
  seq += 1
  return { bid_id: `h${seq}`, project_name: `Project ${seq}`, outcome, loss_reason: null, loss_category: outcome === 'lost' ? 'price' : null, bid_value: 1000 / (1 - marginPct / 100), est_cost: 1000, ...over }
}
const FOLD_KEY = 'pt.pricing.bidsLikeThis.expanded'
const open = () => fireEvent.click(screen.getByRole('button', { name: /Compare/ }))

beforeEach(() => window.localStorage.clear())
afterEach(() => cleanup())

describe('PricingBidsLikeThis', () => {
  it('renders nothing while the history loads or holds nothing like this bid', () => {
    const { container, rerender } = render(<PricingBidsLikeThis history={null} currentBidId="b1" currentPrice={1700} currentMargin={0.4} gcCustomerId={null} />)
    expect(container.textContent).toBe('')
    rerender(<PricingBidsLikeThis history={[bid('won', 40, { bid_value: 900_000 })]} currentBidId="b1" currentPrice={1700} currentMargin={0.4} gcCustomerId={null} />)
    expect(container.textContent).toBe('')
  })

  it('folded: the title, a chip per fact and the Compare button — no panel', () => {
    // values 1,429 / 1,818 / 2,000 against a price of 1,700 → all three are this size
    const history = [bid('won', 30, { customer_id: 'gc1' }), bid('won', 45), bid('lost', 50)]
    render(<PricingBidsLikeThis history={history} currentBidId="b1" currentPrice={1700} currentMargin={0.4} gcCustomerId="gc1" />)
    expect(screen.getByText('Bids like this')).toBeTruthy()
    expect(screen.getByText('This size · 2 won · 1 lost on price')).toBeTruthy()
    expect(screen.getByText('This GC · 1 won of 1')).toBeTruthy()
    expect(screen.getByText('40% · in your winning range')).toBeTruthy()
    const button = screen.getByRole('button', { name: /Compare 3 bids/ })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText(/What happened to/)).toBeNull()
    expect(screen.queryByText(/Estimated margin/)).toBeNull()
  })

  it('unfolded: the outcome bar, the named bids, the GC’s record and the margin scale', () => {
    const history = [
      bid('won', 30, { project_name: 'Oak Ave', customer_id: 'gc1' }),
      bid('won', 45),
      bid('lost', 50, { project_name: 'Pine Rd', bid_tab_low: 1600 }),
      bid('lost', 40, { project_name: 'Elm St', loss_category: 'gc_lost' }),
      bid('lost', 40, { loss_category: 'no_answer' }),
    ]
    const { container } = render(<PricingBidsLikeThis history={history} currentBidId="b1" currentPrice={1700} currentMargin={0.4} gcCustomerId="gc1" />)
    open()
    expect(screen.getByRole('button', { name: /Hide/ }).getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('What happened to 5 decided bids between $850 and $3k')
    expect(container.textContent).toContain('2 won')
    expect(container.textContent).toContain('1 lost on price')
    expect(container.textContent).toContain('1 the GC lost the project')
    expect(screen.getByTitle('1 No answer')).toBeTruthy()
    // the named list: decided on our number only
    expect(screen.getByText('Won or lost on price, closest in size first')).toBeTruthy()
    expect(screen.getByTitle('Oak Ave')).toBeTruthy()
    expect(screen.getByTitle('Pine Rd')).toBeTruthy()
    expect(screen.queryByTitle('Elm St')).toBeNull()
    expect(screen.getByText('low bid $1,600 · we were 25% over')).toBeTruthy()
    expect(screen.getByText('With this GC: 1 decided bid. 1 won.')).toBeTruthy()
    // the margin slice
    expect(screen.getByText('Thin evidence')).toBeTruthy()
    expect(screen.getByTitle('Won: Oak Ave at ~30%')).toBeTruthy()
    expect(screen.getByTitle('Lost on price: Pine Rd at ~50%')).toBeTruthy()
    expect(screen.getByTitle('Tab low on Pine Rd: ~38% would have matched it')).toBeTruthy()
    expect(screen.getByText('1 of 2 wins were priced at 40% or higher. No bid lost on price this low.')).toBeTruthy()
    expect(container.textContent).toContain('At 40%, this number would have matched or beaten the low on 0 of 1 recorded tab.')
    expect(screen.getByText('3 of the 3 bids won or lost on price have a usable cost estimate.')).toBeTruthy()
  })

  it('names the GC when the bid has a name for it', () => {
    const history = [bid('won', 30, { customer_id: 'gc1' }), bid('won', 45), bid('lost', 50)]
    render(<PricingBidsLikeThis history={history} currentBidId="b1" currentPrice={1700} currentMargin={0.4} gcCustomerId="gc1" gcName="Journeyman" />)
    expect(screen.getByText('Journeyman · 1 won of 1')).toBeTruthy()
    open()
    expect(screen.getByText('With Journeyman: 1 decided bid. 1 won.')).toBeTruthy()
  })

  it('the scale fits its dots: a history at 79–95% draws ticks there, not at 20–60%', () => {
    const history = [bid('won', 79), bid('lost', 84), bid('lost', 89), bid('lost', 94)]
    render(<PricingBidsLikeThis history={history} currentBidId="b1" currentPrice={null} currentMargin={0.82} gcCustomerId={null} />)
    expect(screen.getByText('82% · above your one win')).toBeTruthy()
    open()
    expect(screen.getByText('90%')).toBeTruthy()
    expect(screen.queryByText('20%')).toBeNull()
    expect(screen.getByText('82% is above your one win (79%). 3 bids lost on price at 84–94%.')).toBeTruthy()
  })

  it('renders nothing on a bid with no price and no margin yet', () => {
    const { container } = render(<PricingBidsLikeThis history={[bid('won', 30), bid('won', 45), bid('lost', 50)]} currentBidId="b1" currentPrice={0} currentMargin={null} gcCustomerId="gc9" gcName="City of Seguin" />)
    expect(container.textContent).toBe('')
  })

  it('with no margin on the Workbench there is no margin chip and no pointer', () => {
    render(<PricingBidsLikeThis history={[bid('won', 30), bid('won', 45), bid('lost', 50)]} currentBidId="b1" currentPrice={1700} currentMargin={null} gcCustomerId={null} />)
    expect(screen.queryByText(/winning range|above|below/)).toBeNull()
    open()
    expect(screen.getAllByText('40%')).toHaveLength(1)
  })

  it('remembers the fold on the device', () => {
    const history = [bid('won', 30), bid('won', 45), bid('lost', 50)]
    const first = render(<PricingBidsLikeThis history={history} currentBidId="b1" currentPrice={1700} currentMargin={0.4} gcCustomerId={null} />)
    open()
    expect(window.localStorage.getItem(FOLD_KEY)).toBe('1')
    first.unmount()
    render(<PricingBidsLikeThis history={history} currentBidId="b2" currentPrice={1700} currentMargin={0.4} gcCustomerId={null} />)
    expect(screen.getByText(/What happened to/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Hide/ }))
    expect(window.localStorage.getItem(FOLD_KEY)).toBe('0')
    expect(screen.queryByText(/What happened to/)).toBeNull()
  })
})
