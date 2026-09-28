// @vitest-environment jsdom
/**
 * Render smoke for the Cover Letter tab's hand-off to the bid room: the room is given the
 * wording the printed letter resolves to, never the raw text. With no org default saved and
 * nothing typed for the bid, the letter prints the built-in Terms and Exclusions — and the room
 * used to be handed two empty strings, which the public page hides.
 *
 * `BidRoomPanel` is replaced by a stand-in that prints the props it was given; the panel itself
 * has its own smoke (`BidRoomPanel.render.test.tsx`). Supabase is the empty stub, so no org
 * default is ever loaded.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('./BidRoomPanel', () => ({
  BidRoomPanel: (p: { exclusions: string; terms: string }) => (
    <div data-testid="room-props">
      <pre data-testid="room-exclusions">{p.exclusions}</pre>
      <pre data-testid="room-terms">{p.terms}</pre>
    </div>
  ),
  BidRoomSetupButton: () => null,
}))

import { BidsCoverLetterTab } from './BidsCoverLetterTab'
import { DEFAULT_EXCLUSIONS, DEFAULT_TERMS_AND_WARRANTY } from '../../lib/bidDocuments/coverLetter'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

type Props = Parameters<typeof BidsCoverLetterTab>[0]

const bid = {
  id: 'bid-1',
  bid_number: '101',
  project_name: 'Elm St Clinic',
  address: '1 Elm St',
  service_type_id: 'st-1',
  customer_id: 'cust-1',
  customers: { id: 'cust-1', name: 'Acme GC', address: '9 Main St' },
  bid_date_sent: null,
  created_at: '2026-07-01T00:00:00Z',
} as unknown as NonNullable<Props['selectedBidForPricing']>

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    bids: [bid],
    selectedBidForPricing: bid,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    serviceTypes: [{ id: 'st-1', name: 'Plumbing' }],
    pricingCountRows: [],
    coverLetterPricingRows: { revenueSum: 1000, fixtureRows: [] },
    activePricingName: 'Standard',
    activeBidVersionId: null,
    versionGcFingerprint: '',
    bidPricings: [],
    reloadBidPricings: vi.fn(async () => {}),
    bidVersions: [],
    reloadBidVersions: vi.fn(async () => {}),
    loadBids: vi.fn(async () => []),
    coverLetterInclusionsByBid: {},
    setCoverLetterInclusionsByBid: vi.fn(),
    coverLetterExclusionsByBid: {},
    setCoverLetterExclusionsByBid: vi.fn(),
    coverLetterTermsByBid: {},
    setCoverLetterTermsByBid: vi.fn(),
    coverLetterIncludeDesignDrawingPlanDateByBid: {},
    setCoverLetterIncludeDesignDrawingPlanDateByBid: vi.fn(),
    coverLetterCustomAmountByBid: {},
    setCoverLetterCustomAmountByBid: vi.fn(),
    coverLetterUseCustomAmountByBid: {},
    setCoverLetterUseCustomAmountByBid: vi.fn(),
    coverLetterIncludeSignatureByBid: {},
    setCoverLetterIncludeSignatureByBid: vi.fn(),
    coverLetterIncludeFixturesPerPlanByBid: {},
    setCoverLetterIncludeFixturesPerPlanByBid: vi.fn(),
    onSelectBid: vi.fn(),
    onClose: vi.fn(),
    onEditBid: vi.fn(),
    onSaveBidSubmissionQuickAdd: vi.fn(async () => {}),
    ledgerPrefixMap: {} as Props['ledgerPrefixMap'],
    onlyMyBids: false,
    setOnlyMyBids: vi.fn(),
    isMyBid: () => true,
    ...overrides,
  }
}

describe('BidsCoverLetterTab → bid room wording', () => {
  it('nothing typed and no org default: the room gets the built-in Terms and Exclusions the letter prints', async () => {
    renderWithProviders(<BidsCoverLetterTab {...makeProps()} />)
    await settle()
    expect((await screen.findByTestId('room-exclusions')).textContent).toBe(DEFAULT_EXCLUSIONS)
    expect(screen.getByTestId('room-terms').textContent).toBe(DEFAULT_TERMS_AND_WARRANTY)
  })

  it('the bid’s own wording reaches the room as typed', async () => {
    renderWithProviders(
      <BidsCoverLetterTab
        {...makeProps({
          coverLetterExclusionsByBid: { 'bid-1': 'Owner-supplied fixtures are excluded.' },
          coverLetterTermsByBid: { 'bid-1': 'Pricing is good for fifteen (15) days.' },
        })}
      />,
    )
    await settle()
    expect((await screen.findByTestId('room-exclusions')).textContent).toBe('Owner-supplied fixtures are excluded.')
    expect(screen.getByTestId('room-terms').textContent).toBe('Pricing is good for fifteen (15) days.')
  })

  it('an emptied box: the room gets the built-in wording, as the letter does', async () => {
    renderWithProviders(
      <BidsCoverLetterTab
        {...makeProps({
          coverLetterExclusionsByBid: { 'bid-1': '' },
          coverLetterTermsByBid: { 'bid-1': '   ' },
        })}
      />,
    )
    await settle()
    expect((await screen.findByTestId('room-exclusions')).textContent).toBe(DEFAULT_EXCLUSIONS)
    expect(screen.getByTestId('room-terms').textContent).toBe(DEFAULT_TERMS_AND_WARRANTY)
  })
})
