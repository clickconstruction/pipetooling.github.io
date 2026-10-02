// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BidFlowStrip } from './BidFlowStrip'
import { deriveBidFlow, type BidFlowSource } from '../../lib/bids/bidFlow'

/**
 * The strip unfolded above a workflow tab's title draws no box of its own: the bid's card
 * already frames it (v2.4415). The Bid Board's expanded row keeps its box and its header.
 */

const BID: BidFlowSource = {
  drive_link: 'https://drive.example/folder',
  plans_link: null,
  count_tooling_link: null,
  count_tooling_plans_link: null,
  bid_value: null,
  bid_date_sent: null,
  bid_submission_link: null,
  outcome: null,
}

describe('BidFlowStrip — the full strip', () => {
  it('unfolded above a tab title it has no border, no fill and no header', () => {
    render(<BidFlowStrip variant="full" hideHeader flow={deriveBidFlow(BID)} bidLabel="ZZ Test" />)
    const strip = screen.getByRole('group', { name: /^Bid flow for ZZ Test/ })
    expect(strip.getAttribute('style')).not.toContain('dashed')
    expect(strip.style.borderWidth).toBe('0px')
    expect(strip.style.background).toBe('transparent')
    expect(strip.style.paddingTop).toBe('0px')
    expect(screen.queryByText(/Where this bid is/)).toBeNull()
    expect(screen.getByText('Plans in Drive')).toBeTruthy()
  })

  it('on the Bid Board it keeps its box and says where the bid is', () => {
    render(<BidFlowStrip variant="full" flow={deriveBidFlow(BID)} bidLabel="ZZ Test" />)
    const strip = screen.getByRole('group', { name: /^Bid flow for ZZ Test/ })
    // jsdom drops a border shorthand that holds a var(), so read the attribute as written.
    expect(strip.getAttribute('style')).toContain('1px solid var(--border)')
    expect(strip.getAttribute('style')).toContain('var(--surface)')
    expect(screen.getByText(/Where this bid is/)).toBeTruthy()
  })
})
