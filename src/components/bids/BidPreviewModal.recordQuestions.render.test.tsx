// @vitest-environment jsdom
/**
 * The Bid window carries its own Questions on this bid (punch list #208 PR 4b): the section above the
 * notes with Ask the estimators and Ask Dispatch, and the sheet opening on this bid.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { BidPreviewModal } from './BidPreviewModal'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const read = vi.fn(async () => ({ requests: [], names: new Map<string, string>() }))
vi.mock('../../lib/developments/fetchRecordQuestions', () => ({ fetchRecordQuestions: (...args: unknown[]) => read(...(args as [])) }))

beforeAll(installDomShims)
afterEach(cleanup)

const BID = {
  id: 'bid-1',
  bid_number: '418',
  project_name: 'Lodge',
  address: null,
  service_type_id: null,
  customer_id: null,
  customers: null,
  bids_gc_builders: null,
  outcome: null,
  bid_due_date: null,
  bid_date_sent: null,
  bid_value: null,
  notes: null,
  itb_links: null,
  plans_link: null,
  estimator: null,
  account_manager: null,
  development: null,
} as unknown as BidWithBuilder

describe('BidPreviewModal · Questions on this bid', () => {
  it('draws the section with its presses and opens the sheet on this bid', async () => {
    renderWithProviders(<BidPreviewModal bid={BID} loading={false} error={null} onClose={() => {}} onNavigateToBidsTab={() => {}} onRequestEditBid={() => {}} />)
    const section = await screen.findByTestId('record-questions-bid')
    expect(within(section).getByText('Questions on this bid')).toBeTruthy()
    await waitFor(() => expect(read).toHaveBeenCalledWith({ kind: 'bid', id: 'bid-1' }, null))
    expect(await within(section).findByText(/Nothing asked about this bid yet\./)).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: 'Ask Dispatch' }))
    const sheet = await screen.findByRole('dialog', { name: 'Ask a question' })
    const about = within(sheet).getByTestId('ask-about') as HTMLSelectElement
    expect(Array.from(about.options).map((o) => o.textContent)).toEqual(['B418 Lodge'])
    expect(within(sheet).getByTestId('ask-lane-dispatch').getAttribute('aria-checked')).toBe('true')
  })
})
