// @vitest-environment jsdom
/**
 * The bid room a two-option letter publishes (v2.4723 options, v2.4728 the room's half): a bid
 * WITH versions whose letter carries two base bids offers the GC Option 1 and Option 2, each at
 * its own total and with its own version, never one "Base bid" at the two summed. Until v2.4892
 * the Cover Letter tab built the options for a bid with no versions only, which never has two
 * bases, and handed a bid with versions its raw sections, which the room's payload folds into one
 * summed base: a GC could sign the sum of two alternatives.
 *
 * The sections are priced by a stand-in (each version's ★ at a fixed amount); the plan, the
 * letter document, the options block and the payload are the real kernels. `BidRoomPanel` is a
 * stand-in that prints the sections it was given, and the test builds the payload from them the
 * way the panel does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  BidRoomPanel: (p: { sections: unknown }) => <pre data-testid="room-sections">{JSON.stringify(p.sections)}</pre>,
  BidRoomSetupButton: () => null,
}))
/** Each version's ★ at its own amount: To Plans $120,000, Value Engineered $95,000. */
const PRICE_BY_VERSION: Record<string, number> = { v1: 120000, v2: 95000 }
vi.mock('../../lib/bids/coverLetterDocument', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/bids/coverLetterDocument')>()
  return {
    ...real,
    priceLetterSections: (input: Parameters<typeof real.priceLetterSections>[0]) =>
      input.plans.map((p) => ({
        name: p.name,
        bidVersionId: p.bidVersionId,
        isAlternate: p.isAlternate,
        offeredPricingId: p.offeredPricingId,
        revenueSum: PRICE_BY_VERSION[p.bidVersionId ?? ''] ?? 0,
        fixtureRows: [{ fixture: 'WC', count: p.bidVersionId === 'v1' ? 4 : 3 }],
      })),
  }
})

import { BidsCoverLetterTab } from './BidsCoverLetterTab'
import { buildBidRoomRevisionPayload, type RoomSectionInput } from '../../lib/bids/bidRoomPayload'
import { COVER_LETTER_ALTS_LAYOUT_KEY } from '../../lib/bids/coverLetterSamePage'
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

const versions = [
  { id: 'v1', bid_id: 'bid-1', name: 'To Plans', sort_order: 0, include_in_submission: true, is_alternate: false, starred_price_book_version_id: 'p1', customer_id: null },
  { id: 'v2', bid_id: 'bid-1', name: 'Value Engineered', sort_order: 1, include_in_submission: true, is_alternate: false, starred_price_book_version_id: 'p2', customer_id: null },
] as unknown as Props['bidVersions']

const pricings = [
  { id: 'p1', bid_id: 'bid-1', bid_version_id: 'v1', name: 'Standard', sort_order: 0, include_in_submission: true },
  { id: 'p2', bid_id: 'bid-1', bid_version_id: 'v2', name: 'VE', sort_order: 0, include_in_submission: true },
] as unknown as Props['bidPricings']

function makeProps(): Props {
  return {
    bids: [bid],
    selectedBidForPricing: bid,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    serviceTypes: [{ id: 'st-1', name: 'Plumbing' }],
    pricingCountRows: [{ id: 'cr1', bid_id: 'bid-1', bid_version_id: 'v1', fixture: 'WC', count: 4 }] as unknown as Props['pricingCountRows'],
    coverLetterPricingRows: { revenueSum: 120000, fixtureRows: [], byAlternate: null },
    activePricingName: 'Standard',
    activeBidVersionId: 'v1',
    versionGcFingerprint: '',
    bidPricings: pricings,
    reloadBidPricings: vi.fn(async () => {}),
    bidVersions: versions,
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
  }
}

/** The room payload the panel would publish from the sections the tab handed it. */
async function roomOptions() {
  renderWithProviders(<BidsCoverLetterTab {...makeProps()} />)
  await settle()
  await screen.findByText(/"revenueSum":95000/, { selector: '[data-testid="room-sections"]' }, { timeout: 4000 })
  const sections = JSON.parse(screen.getByTestId('room-sections').textContent ?? '[]') as RoomSectionInput[]
  const payload = buildBidRoomRevisionPayload({
    projectName: 'Elm St Clinic',
    projectAddress: '1 Elm St',
    gcName: 'Acme GC',
    serviceTypeName: 'Plumbing',
    sections,
    inclusions: '',
    exclusions: '',
    terms: '',
  })
  return (payload?.options ?? []).map((o) => ({ name: o.name, is_base: o.is_base, total_cents: o.total_cents, bid_version_id: o.bid_version_id ?? null }))
}

describe('BidsCoverLetterTab → the bid room of a letter with two options', () => {
  afterEach(() => {
    localStorage.removeItem(COVER_LETTER_ALTS_LAYOUT_KEY)
  })

  it('same page: Option 1 and Option 2, each at its own total and version, never one summed base', async () => {
    expect(await roomOptions()).toEqual([
      { name: 'Option 1 — To Plans', is_base: true, total_cents: 12_000_000, bid_version_id: 'v1' },
      { name: 'Option 2 — Value Engineered', is_base: false, total_cents: 9_500_000, bid_version_id: 'v2' },
    ])
  })

  it('separate pages: still two options, since each base bid is its own proposal', async () => {
    localStorage.setItem(COVER_LETTER_ALTS_LAYOUT_KEY, 'separate')
    expect(await roomOptions()).toEqual([
      { name: 'Option 1 — To Plans', is_base: true, total_cents: 12_000_000, bid_version_id: 'v1' },
      { name: 'Option 2 — Value Engineered', is_base: false, total_cents: 9_500_000, bid_version_id: 'v2' },
    ])
  })
})
