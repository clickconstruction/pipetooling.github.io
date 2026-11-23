// @vitest-environment jsdom
/**
 * Render-smoke tests for the customer page's Permits tab (v2.8302) and the door on Profile that
 * replaced the Names on permits card. The tab hands the bid window's own panel this customer's
 * row with every other row of the same keyed name, says when it read more than one, and shows
 * this row alone when the customer list cannot be read. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const { io, panel } = vi.hoisted(() => ({
  io: { loadCustomerNames: vi.fn() },
  panel: { props: [] as Array<{ customerIds: readonly string[]; customerName: string; currentBidId: string | null; onItsOwnPage?: boolean }> },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/research/bidSiteIo', () => ({ loadCustomerNames: io.loadCustomerNames }))
vi.mock('../bids/BidGcPermits', () => ({
  BidGcPermits: (props: { customerIds: readonly string[]; customerName: string; currentBidId: string | null; onItsOwnPage?: boolean }) => {
    panel.props.push(props)
    return <div data-testid="panel">{props.customerIds.join(',')}</div>
  },
}))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { CustomerPermitsDoor, CustomerPermitsTab } from './CustomerPermitsTab'

installDomShims()

beforeEach(() => {
  io.loadCustomerNames.mockReset()
  panel.props = []
})

describe('CustomerPermitsTab', () => {
  it('hands the panel this row and every other row of the same name, as its own page, and says so', async () => {
    io.loadCustomerNames.mockResolvedValue([
      { id: 'c-1', name: 'Larkfield Construction' },
      { id: 'c-2', name: 'Larkfield Construction, LLC' },
      { id: 'c-3', name: 'Larkfield Homes' },
    ])
    renderWithProviders(<CustomerPermitsTab customerId="c-1" customerName="Larkfield Construction" />)
    expect(screen.getByRole('status').textContent).toContain('Reading what the city has')
    await waitFor(() => expect(screen.getByTestId('panel').textContent).toBe('c-1,c-2'))
    const last = panel.props[panel.props.length - 1]
    expect(last?.customerName).toBe('Larkfield Construction')
    expect(last?.currentBidId).toBeNull()
    expect(last?.onItsOwnPage).toBe(true)
    expect(screen.getByTestId('customer-permits-tab').textContent).toContain('Read together with 1 other customer row of the same name.')
  })

  it('says nothing about other rows when the name stands alone', async () => {
    io.loadCustomerNames.mockResolvedValue([{ id: 'c-1', name: 'Larkfield Construction' }])
    renderWithProviders(<CustomerPermitsTab customerId="c-1" customerName="Larkfield Construction" />)
    await waitFor(() => expect(screen.getByTestId('panel').textContent).toBe('c-1'))
    expect(screen.getByTestId('customer-permits-tab').textContent).not.toContain('Read together')
  })

  it('shows this row alone, with the reason, when the customer list cannot be read', async () => {
    io.loadCustomerNames.mockRejectedValue({ message: 'permission denied for table customers', code: '42501' })
    renderWithProviders(<CustomerPermitsTab customerId="c-1" customerName="Larkfield Construction" />)
    await waitFor(() => expect(screen.getByTestId('panel').textContent).toBe('c-1'))
    const words = screen.getByTestId('customer-permits-tab').textContent ?? ''
    expect(words).toContain('these are this row’s bids alone')
    // The reason is the one `formatErrorMessage` gives a refusal, never the fallback.
    expect(words).toContain('You don\'t have access to this record.')
  })
})

describe('CustomerPermitsDoor', () => {
  it('keeps the old card’s name on Profile and opens the Permits tab', () => {
    const onOpen = vi.fn()
    renderWithProviders(<CustomerPermitsDoor onOpen={onOpen} />)
    expect(screen.getByTestId('customer-permit-names').textContent).toContain('Names on permits')
    fireEvent.click(screen.getByRole('button', { name: 'Open Permits →' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})
