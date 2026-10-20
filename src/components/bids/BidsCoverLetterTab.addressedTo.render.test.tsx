// @vitest-environment jsdom
/**
 * The Addressed to row (to-do #133): every GC the bid goes to can be the letter's addressee.
 * A bid with recorded same-letter recipients (`bid_gc_recipients`) shows the row; picking a
 * shared chip swaps ONLY the letter's name-and-address block (the amount and wording stay),
 * says so in the note, and folds the bid room (a room carries opens and a signature, so two
 * builders never share one). A single-GC bid never sees the row.
 *
 * Supabase is the empty stub except `bid_gc_recipients`, which serves the two riders;
 * `BidRoomPanel` is a stand-in so the fold is observable.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const RECIPIENT_ROWS: unknown[] = []

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const base = makeSupabaseStub()
  const rowBuilder = (rows: unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
    b.then = (...args: Parameters<Promise<unknown>['then']>) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(...args)
    return b
  }
  return {
    supabase: {
      ...base,
      from: (table: string) => (table === 'bid_gc_recipients' ? rowBuilder(RECIPIENT_ROWS) : (base.from as (t: string) => unknown)(table)),
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('./BidRoomPanel', () => ({
  BidRoomPanel: () => <div data-testid="room-props" />,
  BidRoomSetupButton: () => null,
}))

import { BidsCoverLetterTab } from './BidsCoverLetterTab'
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
    coverLetterPricingRows: { revenueSum: 1000, fixtureRows: [], byAlternate: null },
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

function seedRecipients(rows: unknown[]) {
  RECIPIENT_ROWS.length = 0
  RECIPIENT_ROWS.push(...rows)
}

describe('BidsCoverLetterTab → Addressed to', () => {
  it('a shared chip swaps only the address block, says so, and folds the room', async () => {
    seedRecipients([
      { customer_id: 'gc-2', customers: { name: 'Harbor Point Construction', address: '900 Lakeway Commons, Marble Falls TX' } },
      { customer_id: 'gc-3', customers: { name: 'Caldwell & Sons', address: null } },
    ])
    const { container } = renderWithProviders(<BidsCoverLetterTab {...makeProps()} />)
    await settle()
    const row = await screen.findByTestId('cover-letter-addressed-to')
    expect(row.textContent).toContain('Harbor Point Construction')
    expect(row.textContent).toContain('Caldwell & Sons')
    // A rider with no address on file says so on its chip; nothing holds the batch.
    expect(row.textContent).toContain('no address on file')
    expect(screen.getByTestId('room-props')).toBeTruthy()
    // Print all (PR 2): one addressed copy per GC — the bid GC plus the two riders.
    expect(screen.getByRole('button', { name: /Print 3 letters/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Harbor Point Construction/ }))
    await settle()
    const preview = container.querySelector('.cl-preview')
    expect(preview?.innerHTML).toContain('Harbor Point Construction')
    expect(preview?.innerHTML).toContain('900 Lakeway Commons')
    // The amount stays the letter's — only the address block moved.
    expect(preview?.innerHTML).toContain('$1,000.00')
    expect(screen.getByTestId('cover-letter-addressed-note').textContent).toContain('gets the same letter as Acme GC')
    expect(screen.getByTestId('cover-letter-room-folded')).toBeTruthy()
    expect(screen.queryByTestId('room-props')).toBeNull()

    // Back to the bid's GC: letterhead and room return.
    fireEvent.click(screen.getByRole('button', { name: /Acme GC/ }))
    await settle()
    expect(container.querySelector('.cl-preview')?.innerHTML).toContain('Acme GC')
    expect(screen.queryByTestId('cover-letter-addressed-note')).toBeNull()
    expect(screen.getByTestId('room-props')).toBeTruthy()
  })

  it('a single-GC bid never sees the row', async () => {
    seedRecipients([])
    renderWithProviders(<BidsCoverLetterTab {...makeProps()} />)
    await settle()
    expect(screen.queryByTestId('cover-letter-addressed-to')).toBeNull()
    expect(screen.queryByRole('button', { name: /letters/ })).toBeNull()
    expect(screen.getByTestId('room-props')).toBeTruthy()
  })
})
