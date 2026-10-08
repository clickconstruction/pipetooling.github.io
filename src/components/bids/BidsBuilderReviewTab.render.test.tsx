// @vitest-environment jsdom
/**
 * Render smoke for Followup → By builder: the **Bid map** button shows only for roles the Map opens for
 * (v2.4897). The page passes `canOpenMap` from the route's own rule, `isPathAllowedForRole(role, '/map')`;
 * a superintendent keeps By builder but `/map` bounces them, so the button would have been a dead door.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { BidsBuilderReviewTab } from './BidsBuilderReviewTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { isPathAllowedForRole } from '../../lib/layoutRouteAccess'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { UserRole } from '../../hooks/useAuth'

vi.mock('../../lib/supabase', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'is', 'not']) builder[m] = () => builder
  builder.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok, bad)
  return { supabase: { from: () => builder, rpc: () => Promise.resolve({ data: [], error: null }) } }
})

const CUSTOMER = { id: 'c1', name: 'Knight Contracting', address: '4400 Sample Pkwy, Kyle, TX', master_user_id: 'u1' }
const BID = {
  id: 'b1',
  customer_id: 'c1',
  address: '4400 Sample Pkwy, Kyle, TX',
  project_name: 'Sample Pkwy',
  outcome: 'won',
  customers: { name: 'Knight Contracting' },
  bids_gc_builders: null,
} as unknown as BidWithBuilder

function renderTab(canOpenMap: boolean) {
  return renderWithProviders(
    <BidsBuilderReviewTab
      bids={[BID]}
      gcPacketsByBid={{}}
      customers={[CUSTOMER] as never}
      customerContacts={[]}
      customerContactPersons={[]}
      lastContactFromEntries={{}}
      authUser={{ id: 'u1' }}
      narrowViewport640={false}
      deepLinkHighlightCustomerId={null}
      deepLinkHighlightGen={0}
      onLoadCustomers={() => {}}
      onReloadCustomerContacts={() => {}}
      onReloadContactPersons={() => {}}
      onReloadBids={() => {}}
      onError={() => {}}
      onEditBid={() => {}}
      onNewBidWithCustomer={() => {}}
      canOpenMap={canOpenMap}
      onSetCustomers={() => {}}
      newCustomerModal={null}
      editCustomerModal={null}
    />,
  )
}

describe('BidsBuilderReviewTab — Bid map follows the Map route (v2.4897)', () => {
  it.each<[UserRole, boolean]>([
    ['dev', true],
    ['master_technician', true],
    ['assistant', true],
    ['controller', true],
    ['estimator', true],
    ['superintendent', false],
  ])('%s: Bid map %s', async (role, shown) => {
    const canOpenMap = isPathAllowedForRole(role, '/map', false)
    expect(canOpenMap).toBe(shown)
    renderTab(canOpenMap)
    expect(await screen.findByText('Knight Contracting')).toBeTruthy()
    expect(screen.queryByTitle("See this builder's bids on the map, colored by won / lost / pending") !== null).toBe(shown)
  })
})
