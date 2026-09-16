// @vitest-environment jsdom
/**
 * Render smokes for BidPriceRequestsTable's add path (v2.3495) — picking a
 * house appends a card with its own day and its own quote link, and the Save
 * button counts what it is about to write. The batch arithmetic itself is the
 * kernel's job and is tested in `src/lib/bids/bidPriceRequests.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidPriceRequestsTable } from './BidPriceRequestsTable'

const inserted: unknown[] = []

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'robert', email: 'robert@x.test' }, profileName: 'Robert', role: 'dev' }),
}))

vi.mock('../../lib/supplyHousePickerRows', () => ({
  fetchSupplyHousePickerRows: () =>
    Promise.resolve([
      { id: 'ferguson', name: 'Ferguson' },
      { id: 'moore', name: 'Moore Supply' },
    ]),
}))

vi.mock('../../lib/userDisplayNames', () => ({
  fetchUserDisplayNames: () => Promise.resolve([]),
  userDisplayLabel: () => 'Robert',
}))

vi.mock('../../lib/supabase', () => {
  const listResult = (data: unknown[]) => {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'order', 'not', 'is']) builder[m] = () => builder
    ;(builder as { then: unknown }).then = (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => ({
        ...listResult([]),
        insert: (rows: unknown) => {
          if (table === 'bid_rfqs') inserted.push(rows)
          return Promise.resolve({ error: null })
        },
      }),
    },
  }
})

function renderTable() {
  return renderWithProviders(
    <BidPriceRequestsTable bidId="bid-1" serviceTypeId={null} pricingHref="/bids?tab=pricing&bidId=bid-1" />,
  )
}

describe('BidPriceRequestsTable — the add block (v2.3495)', () => {
  it('mounts with no requests and offers the add button', async () => {
    renderTable()
    expect(await screen.findByText('No price requests on this bid yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add a request' })).toBeTruthy()
  })

  it('picks a house, shows its own day and quote link, then counts a second house', async () => {
    renderTable()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a request' }))

    // The picker opens straight away on the first house.
    fireEvent.click(await screen.findByRole('button', { name: /Ferguson/ }))
    expect(await screen.findByLabelText('When the Ferguson request went out')).toBeTruthy()
    expect(screen.getByLabelText('Quote link for Ferguson')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add request' })).toBeTruthy()

    // The second house comes from the explicit door.
    fireEvent.click(screen.getByRole('button', { name: '+ Add another supply house' }))
    fireEvent.click(await screen.findByRole('button', { name: /Moore Supply/ }))

    expect(await screen.findByLabelText('Quote link for Moore Supply')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add 2 requests' })).toBeTruthy()

    // Removing one puts the count back.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Moore Supply' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add request' })).toBeTruthy())
  })

  it('Cancel closes the block and writes nothing', async () => {
    renderTable()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a request' }))
    fireEvent.click(await screen.findByRole('button', { name: /Ferguson/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add a request' })).toBeTruthy())
    expect(screen.queryByLabelText('Quote link for Ferguson')).toBeNull()
    expect(inserted).toHaveLength(0)
  })
})
