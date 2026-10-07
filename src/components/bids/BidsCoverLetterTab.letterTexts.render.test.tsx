// @vitest-environment jsdom
/**
 * Render smoke for the Cover Letter's three per-bid boxes saved on the bid (v2.4737, bid history
 * PR 0a): the saved exclusions seed the box and the room's wording on open; typing inclusions
 * writes that one column after the pause; a box typed before the read keeps its text.
 *
 * Supabase is a hand-made stub: `bids` answers the saved row and records every update; every
 * other table is empty. `BidRoomPanel` prints the wording it is handed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState, type ReactElement } from 'react'

let bidRow: Record<string, unknown> = {}
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
        return Promise.resolve({ data: [{ id: 'bid-1' }], error: null, count: 1 })
      }
      return Promise.resolve({ data: [], error: null, count: 0 })
    }
    builder.maybeSingle = () => Promise.resolve({ data: table === 'bids' ? bidRow : null, error: null })
    builder.single = () => Promise.resolve({ data: table === 'bids' ? bidRow : null, error: null })
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
  BidRoomPanel: (p: { exclusions: string; terms: string }) => (
    <div data-testid="room-props">
      <pre data-testid="room-exclusions">{p.exclusions}</pre>
      <pre data-testid="room-terms">{p.terms}</pre>
    </div>
  ),
  BidRoomSetupButton: () => null,
}))

import { BidsCoverLetterTab } from './BidsCoverLetterTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

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

/** The page's three maps as live state, so the tab's seed and the typing both land. */
function Harness({ typed = {} }: { typed?: { inclusions?: Record<string, string>; exclusions?: Record<string, string>; terms?: Record<string, string> } }): ReactElement {
  const [inclusions, setInclusions] = useState<Record<string, string>>(typed.inclusions ?? {})
  const [exclusions, setExclusions] = useState<Record<string, string>>(typed.exclusions ?? {})
  const [terms, setTerms] = useState<Record<string, string>>(typed.terms ?? {})
  const props: Props = {
    bids: [bid],
    selectedBidForPricing: bid,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    serviceTypes: [{ id: 'st-1', name: 'Plumbing' }],
    pricingCountRows: [],
    coverLetterPricingRows: { revenueSum: 1000, fixtureRows: [], byAlternate: null },
    activePricingName: 'Standard',
    activeBidVersionId: null,
    versionGcFingerprint: '',
    bidPricings: [],
    reloadBidPricings: vi.fn(async () => {}),
    bidVersions: [],
    reloadBidVersions: vi.fn(async () => {}),
    loadBids: vi.fn(async () => []),
    coverLetterInclusionsByBid: inclusions,
    setCoverLetterInclusionsByBid: setInclusions,
    coverLetterExclusionsByBid: exclusions,
    setCoverLetterExclusionsByBid: setExclusions,
    coverLetterTermsByBid: terms,
    setCoverLetterTermsByBid: setTerms,
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

const box = (label: RegExp) => screen.getByLabelText(label) as HTMLTextAreaElement
const bidUpdates = () => updates.filter((u) => u.table === 'bids').map((u) => u.patch)

beforeEach(() => {
  updates.length = 0
  bidRow = { cover_letter_inclusions: null, cover_letter_exclusions: 'Owner-supplied fixtures are excluded.', cover_letter_terms: null, cover_letter_alt_texts: null }
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('BidsCoverLetterTab · the three boxes saved on the bid', () => {
  it('the saved exclusions seed the box and the room on open; a box with nothing saved shows the default', async () => {
    renderWithProviders(<Harness />)
    await waitFor(() => expect(box(/Exclusions and scope/).value).toBe('Owner-supplied fixtures are excluded.'))
    expect(screen.getByTestId('room-exclusions').textContent).toBe('Owner-supplied fixtures are excluded.')
    // Nothing typed, nothing saved: the terms box reads the built-in wording, and nothing was written.
    expect(box(/Terms and warranty/).value).toContain('warranty')
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(bidUpdates()).toEqual([])
  })

  it('typing inclusions writes that one column after the pause, and only once', async () => {
    renderWithProviders(<Harness />)
    await waitFor(() => expect(box(/Exclusions and scope/).value).toBe('Owner-supplied fixtures are excluded.'))
    fireEvent.change(box(/Additional inclusions/), { target: { value: 'Permits\nTrenching' } })
    await act(async () => { vi.advanceTimersByTime(1000) })
    await waitFor(() => expect(bidUpdates()).toEqual([{ cover_letter_inclusions: 'Permits\nTrenching' }]))
    // Saved: another second writes nothing more.
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(bidUpdates()).toHaveLength(1)
  })

  it('a box typed before the read keeps its text; the saved text does not overwrite it', async () => {
    renderWithProviders(<Harness typed={{ exclusions: { 'bid-1': 'Typed first.' } }} />)
    await act(async () => { vi.advanceTimersByTime(50) })
    await waitFor(() => expect(screen.getByTestId('room-exclusions').textContent).toBe('Typed first.'))
    expect(box(/Exclusions and scope/).value).toBe('Typed first.')
    // It differs from what is saved, so it is written back after the pause.
    await act(async () => { vi.advanceTimersByTime(1000) })
    await waitFor(() => expect(bidUpdates()).toEqual([{ cover_letter_exclusions: 'Typed first.' }]))
  })
})
