// @vitest-environment jsdom
/**
 * Render tests for BidsCallQueueTab (v2.2105) — Followup's new one-queue view:
 * header totals, the fixed To do / Done table per builder, row expansion with
 * the loss-reason chips, and the filter chips narrowing the list.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { BidsCallQueueTab } from './BidsCallQueueTab'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

function bid(over: Partial<BidWithBuilder>): BidWithBuilder {
  return {
    id: Math.random().toString(36).slice(2),
    bid_number: '100',
    project_name: 'Some Project',
    bid_value: 100000,
    outcome: null,
    bid_date_sent: '2026-08-01',
    last_contact: null,
    loss_category: null,
    loss_reason: null,
    bid_tab_low: null,
    bid_tab_high: null,
    bid_tab_rank_from_low: null,
    bid_tab_bidder_count: null,
    customer_id: 'gc-knight',
    gc_builder_id: null,
    service_type_id: 'st1',
    customers: { id: 'gc-knight', name: 'Knight Contracting', contact_info: { phone: '6025550000' } },
    bids_gc_builders: null,
    ...over,
  } as unknown as BidWithBuilder
}

function renderTab(bids: BidWithBuilder[]) {
  const onOpenBuilderCard = vi.fn()
  render(
    <BidsCallQueueTab
      bids={bids}
      gcPacketsByBid={{}}
      ledgerPrefixMap={{}}
      lastContactFromEntries={{}}
      narrowViewport640={false}
      authUserId="u1"
      onError={() => {}}
      onReloadBids={() => {}}
      onOpenBuilderCard={onOpenBuilderCard}
    />,
  )
  return { onOpenBuilderCard }
}

describe('BidsCallQueueTab', () => {
  it('renders the header totals and the fixed three-row table', () => {
    renderTab([
      bid({ project_name: 'Jakes Burgers', bid_date_sent: '2026-06-01' }), // pending, quiet, tab gettable
      bid({ project_name: 'Animal Hospital', outcome: 'lost', bid_value: 300000 }), // needs reason + tab
    ])
    expect(screen.getByText(/1 builder worth a call/)).toBeTruthy()
    expect(screen.getByText('Knight Contracting')).toBeTruthy()
    expect(screen.getByText(/Chase/)).toBeTruthy()
    expect(screen.getByText(/Loss reasons/)).toBeTruthy()
    expect(screen.getByText(/Bid tabs/)).toBeTruthy()
    expect(screen.getByText('0 of 1 fresh')).toBeTruthy()
    expect(screen.getByText('0 of 1 recorded')).toBeTruthy()
    expect(screen.getByText(/Start call/)).toBeTruthy()
  })

  it('clicking the Loss reasons row opens the expansion with the six chips', () => {
    renderTab([bid({ project_name: 'Animal Hospital', outcome: 'lost' })])
    fireEvent.click(screen.getByText(/Loss reasons/))
    expect(screen.getByText('Price too high')).toBeTruthy()
    expect(screen.getByText('GC lost the project')).toBeTruthy()
  })

  it('filter chips narrow the list', () => {
    const alphaGc = { id: 'gc-a', name: 'Alpha GC', contact_info: null } as unknown as BidWithBuilder['customers']
    const betaGc = { id: 'gc-b', name: 'Beta GC', contact_info: null } as unknown as BidWithBuilder['customers']
    renderTab([
      bid({ customer_id: 'gc-a', customers: alphaGc, outcome: 'lost' }),
      bid({
        customer_id: 'gc-b',
        customers: betaGc,
        outcome: null,
        bid_date_sent: '2026-08-20',
        last_contact: '2026-08-21T00:00:00Z',
        bid_tab_low: 90000,
      }),
    ])
    expect(screen.getByText('Alpha GC')).toBeTruthy()
    expect(screen.getByText('Beta GC')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Need a reason/ }))
    expect(screen.getByText('Alpha GC')).toBeTruthy()
    expect(screen.queryByText('Beta GC')).toBeNull()
  })

  it('empty trade shows the quiet empty state', () => {
    renderTab([])
    expect(screen.getByText(/queue fills as bids go out/)).toBeTruthy()
  })
})
