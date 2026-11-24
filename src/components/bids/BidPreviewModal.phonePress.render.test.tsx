// @vitest-environment jsdom
/**
 * The Bid window's top presses on a phone (punch list #426, the live walk of 2026-11-24): **Copy for text**, **Edit
 * bid** and the ✕ stand 44 px tall at a phone's width, the ✕ as wide, and keep their drawn size at a desk.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { stubPhoneWidth } from '../../test/phoneWidth'
import { BidPreviewModal } from './BidPreviewModal'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

vi.mock('../../lib/developments/fetchRecordQuestions', () => ({ fetchRecordQuestions: async () => ({ requests: [], names: new Map<string, string>() }) }))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  stubPhoneWidth(false)
})

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

const draw = () => renderWithProviders(<BidPreviewModal bid={BID} loading={false} error={null} onClose={() => {}} onNavigateToBidsTab={() => {}} onRequestEditBid={() => {}} />)

describe('BidPreviewModal · the top presses on a phone', () => {
  it('at a phone’s width Copy for text, Edit bid and the ✕ stand 44 px tall, and the ✕ is as wide', async () => {
    stubPhoneWidth(true)
    draw()
    const copy = await screen.findByRole('button', { name: 'Copy for text' })
    const edit = screen.getByRole('button', { name: 'Edit bid' })
    const close = screen.getByRole('button', { name: 'Close' })
    expect(copy.style.minHeight).toBe('44px')
    expect(edit.style.minHeight).toBe('44px')
    expect(close.style.minHeight).toBe('44px')
    expect(close.style.minWidth).toBe('44px')
  })

  it('at a desk each keeps the size it was drawn', async () => {
    stubPhoneWidth(false)
    draw()
    const copy = await screen.findByRole('button', { name: 'Copy for text' })
    expect(copy.style.minHeight).toBe('')
    expect(screen.getByRole('button', { name: 'Edit bid' }).style.minHeight).toBe('')
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close.style.minHeight).toBe('')
    expect(close.style.minWidth).toBe('')
  })
})
