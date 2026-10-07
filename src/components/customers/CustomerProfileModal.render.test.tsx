// @vitest-environment jsdom
/**
 * Render smokes for the Customer profile window's two views (punch list #97): a door that
 * names the Timeline opens it, the switch goes back to the Profile and the device remembers
 * the pick, and a window opened with no view opens on the one last picked.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderSettled, settle } from '../../test/renderSmokeMocks'
import { emptyCustomerTimelineInput } from '../../lib/customers/customerTimeline'
import { CUSTOMER_PROFILE_VIEW_KEY } from '../../lib/customers/customerProfileView'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => null }))
vi.mock('../../contexts/BidPreviewModalContext', () => ({ useBidPreview: () => null }))
vi.mock('../../contexts/EditCustomerModalContext', () => ({ useEditCustomerModal: () => ({ openEditCustomerModal: vi.fn() }) }))
vi.mock('../../lib/fetchJobActivityEventsForJobLedger', () => ({ fetchJobActivityEventsForJobLedger: async () => ({ data: [], error: null }) }))
vi.mock('../../lib/customers/fetchCustomerProfile', () => ({
  fetchCustomerProfile: async () => ({
    customer: { id: 'c1', name: 'Ridgeway Builders', customer_type: 'commercial', archived_at: null, address: '', date_met: null, created_at: '2024-11-12T16:00:00Z', contact_info: null },
    contactPersons: [],
    extraAddresses: [],
    jobs: [],
    projects: [],
    bids: [],
    estimates: [],
    gcJobCount: 0,
    gcLastStatementSentAt: null,
  }),
}))
vi.mock('../../lib/customers/fetchCustomerTimeline', async (orig) => ({
  ...(await orig<typeof import('../../lib/customers/fetchCustomerTimeline')>()),
  fetchCustomerTimeline: async () => ({
    input: emptyCustomerTimelineInput({ id: 'c1', name: 'Ridgeway Builders', createdAt: '2024-11-12T16:00:00Z', dateMet: null }),
    missing: [],
    capped: [],
    jobCapHit: false,
  }),
}))

import CustomerProfileModal from './CustomerProfileModal'

beforeAll(installDomShims)
beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('CustomerProfileModal views', () => {
  it('opens the Timeline a door names, goes back to the Profile, and remembers the pick', async () => {
    await renderSettled(<CustomerProfileModal customerId="c1" onClose={vi.fn()} initialView="timeline" />, { loaded: () => screen.findByText('Owes us') })
    expect(screen.getByRole('dialog', { name: 'Customer timeline' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    await settle()
    expect(await screen.findByText('Open balance')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Customer profile' })).toBeTruthy()
    expect(window.localStorage.getItem(CUSTOMER_PROFILE_VIEW_KEY)).toBe('profile')
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }))
    expect(await screen.findByText('Owes us')).toBeTruthy()
    expect(window.localStorage.getItem(CUSTOMER_PROFILE_VIEW_KEY)).toBe('timeline')
  })

  it('opens on the view last picked on this device when the door names none', async () => {
    window.localStorage.setItem(CUSTOMER_PROFILE_VIEW_KEY, 'timeline')
    await renderSettled(<CustomerProfileModal customerId="c1" onClose={vi.fn()} />, { loaded: () => screen.findByText('Owes us') })
    // No jobs yet: the story is the day the customer was added.
    expect(screen.getByText('Customer added')).toBeTruthy()
    expect(document.querySelector('[data-tile="owed"]')?.textContent).toContain('nothing open')
  })
})
