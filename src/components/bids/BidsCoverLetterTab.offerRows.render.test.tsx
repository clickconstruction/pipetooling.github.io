// @vitest-environment jsdom
/**
 * Render smoke for Step 1's version-less offer rows (v2.5680, punch list #138, Wendi): a bid with
 * no versions lists its other prices with a checkbox each — the checkbox IS the offer
 * (`price_book_versions.include_in_submission`), so unticking writes the flag and the letter,
 * the room and the Pricing card follow. The sentence that sent her to the Pricing tab is gone.
 *
 * Supabase is a hand-made stub: every read answers empty, every update is recorded by table.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'

const updates: Array<{ table: string; patch: Record<string, unknown> }> = []

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string, mode: { kind: 'read' } | { kind: 'update'; patch: Record<string, unknown> } = { kind: 'read' }): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    const chain = ['select', 'eq', 'neq', 'is', 'in', 'or', 'not', 'ilike', 'order', 'limit', 'range', 'abortSignal', 'contains', 'filter']
    for (const m of chain) builder[m] = () => builder
    builder.update = (patch: Record<string, unknown>) => makeBuilder(table, { kind: 'update', patch })
    builder.insert = () => makeBuilder(table)
    builder.upsert = () => makeBuilder(table)
    builder.delete = () => makeBuilder(table)
    const result = () => {
      if (mode.kind === 'update') {
        updates.push({ table, patch: mode.patch })
        return Promise.resolve({ data: [{ id: 'x' }], error: null, count: 1 })
      }
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.single = () => Promise.resolve({ data: null, error: null })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => result().then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => makeBuilder(table),
      rpc: () => Promise.resolve({ data: null, error: null }),
      auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }) },
      channel: () => ({ on: () => ({ subscribe: () => undefined }), subscribe: () => undefined }),
      removeChannel: () => undefined,
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('./BidRoomPanel', () => ({
  BidRoomPanel: () => null,
  BidRoomSetupButton: () => null,
}))

import { BidsCoverLetterTab } from './BidsCoverLetterTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type Props = Parameters<typeof BidsCoverLetterTab>[0]

const bid = {
  id: 'bid-1',
  bid_number: '101',
  project_name: 'Oak Hollow Retail Shell',
  address: '4410 Mesquite Bend',
  service_type_id: 'st-1',
  customer_id: 'cust-1',
  customers: { id: 'cust-1', name: 'Ridgeway Builders', address: '2209 Brazos Bend Dr.' },
  bid_date_sent: null,
  selected_price_book_version_id: 'p-star',
  created_at: '2026-07-01T00:00:00Z',
} as unknown as NonNullable<Props['selectedBidForPricing']>

const pricing = (id: string, name: string, sortOrder: number, offered: boolean) => ({
  id,
  name,
  bid_id: 'bid-1',
  bid_version_id: null,
  include_in_submission: offered,
  sort_order: sortOrder,
  created_at: '2026-07-01T00:00:00Z',
})

function harness(bidPricings: unknown[]): ReactElement {
  const props: Props = {
    bids: [bid],
    selectedBidForPricing: bid,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    serviceTypes: [{ id: 'st-1', name: 'Plumbing' }],
    pricingCountRows: [],
    coverLetterPricingRows: { revenueSum: 48750, fixtureRows: [], byAlternate: null },
    activePricingName: 'MARCY',
    activeBidVersionId: null,
    versionGcFingerprint: '',
    bidPricings: bidPricings as Props['bidPricings'],
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
  }
  return <BidsCoverLetterTab {...props} />
}

const offerBox = (name: string) => screen.getByLabelText(`Offer ${name} as an alternate`) as HTMLInputElement
const pricingUpdates = () => updates.filter((u) => u.table === 'price_book_versions').map((u) => u.patch)

beforeEach(() => {
  updates.length = 0
})

describe('BidsCoverLetterTab · the version-less offer rows (v2.5680)', () => {
  it('each other price gets a row — offered checked, not-offered unchecked — and the ★ gets none', async () => {
    renderWithProviders(harness([
      pricing('p-star', 'MARCY', 0, false),
      pricing('p-2', 'Copper water lines', 1, true),
      pricing('p-3', 'Copper water lines copy', 2, false),
    ]))
    await waitFor(() => expect(offerBox('Copper water lines').checked).toBe(true))
    expect(offerBox('Copper water lines copy').checked).toBe(false)
    expect(screen.queryByLabelText('Offer MARCY as an alternate')).toBeNull()
    expect(screen.getByText('not offered')).toBeTruthy()
    // The sentence that sent her to the Pricing tab is gone.
    expect(screen.queryByText(/manage offers on the Pricing tab/)).toBeNull()
  })

  it('the checkbox writes the offered flag both ways', async () => {
    renderWithProviders(harness([
      pricing('p-star', 'MARCY', 0, false),
      pricing('p-2', 'Copper water lines', 1, true),
      pricing('p-3', 'Copper water lines copy', 2, false),
    ]))
    await waitFor(() => expect(offerBox('Copper water lines copy')).toBeTruthy())
    fireEvent.click(offerBox('Copper water lines copy'))
    await waitFor(() => expect(pricingUpdates()).toContainEqual({ include_in_submission: true }))
    fireEvent.click(offerBox('Copper water lines'))
    await waitFor(() => expect(pricingUpdates()).toContainEqual({ include_in_submission: false }))
  })

  it('with no other price, the old pointer sentence stays and no rows render', async () => {
    renderWithProviders(harness([pricing('p-star', 'MARCY', 0, false)]))
    await waitFor(() => expect(screen.getByText(/To offer an alternate, add a price on the Pricing tab/)).toBeTruthy())
    expect(document.querySelector('[data-testid="cover-letter-unsplit-offers"]')).toBeNull()
  })
})
