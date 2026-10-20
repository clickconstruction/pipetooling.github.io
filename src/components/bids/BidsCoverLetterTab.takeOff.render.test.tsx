// @vitest-environment jsdom
/**
 * Render smoke for the preview editor's "Take off this letter" (v2.5684, punch list #138 PR 2,
 * Wendi): the wording editor gains one button that stops offering the alternate it is open on.
 * The cheap-to-mount kind is a with-and-without group alternate (its split rides the
 * `coverLetterPricingRows` prop, no bundle pricing needed): the button writes
 * `cover_letter_alt_texts.groups[key].offered = false` and closes the editor.
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
  alternate_group_tags: ['Break room'],
  created_at: '2026-07-01T00:00:00Z',
} as unknown as NonNullable<Props['selectedBidForPricing']>

function harness(): ReactElement {
  const props: Props = {
    bids: [bid],
    selectedBidForPricing: bid,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    serviceTypes: [{ id: 'st-1', name: 'Plumbing' }],
    pricingCountRows: [],
    coverLetterPricingRows: {
      revenueSum: 16800,
      fixtureRows: [{ fixture: 'WC', count: 2 }],
      byAlternate: {
        base: { revenueSum: 13580, fixtureRows: [{ fixture: 'WC', count: 2 }] },
        alternates: [{ key: 'group:break room', label: 'Break room', revenueSum: 3220, fixtureRows: [{ fixture: 'Sink', count: 1 }] }],
      },
    },
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
  }
  return <BidsCoverLetterTab {...props} />
}

const altTextWrites = () =>
  updates
    .filter((u) => u.table === 'bids' && u.patch.cover_letter_alt_texts != null)
    .map((u) => u.patch.cover_letter_alt_texts as { groups?: Record<string, { offered?: boolean }> })

beforeEach(() => {
  updates.length = 0
})

describe('BidsCoverLetterTab · Take off this letter (v2.5684)', () => {
  it('the wording editor on a group alternate offers the button; pressing it stops the offer and closes the editor', async () => {
    renderWithProviders(harness())
    const pen = await screen.findByLabelText('Wording for Break room')
    fireEvent.click(pen)
    const off = await screen.findByRole('button', { name: 'Take off this letter' })
    expect(screen.getAllByRole('button', { name: 'Take off this letter' })).toHaveLength(1)
    fireEvent.click(off)
    await waitFor(() => expect(altTextWrites().some((t) => t.groups?.['group:break room']?.offered === false)).toBe(true))
    expect(screen.queryByRole('button', { name: 'Take off this letter' })).toBeNull()
  })

  it('Cancel leaves the offer alone', async () => {
    renderWithProviders(harness())
    fireEvent.click(await screen.findByLabelText('Wording for Break room'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(altTextWrites().some((t) => t.groups?.['group:break room']?.offered === false)).toBe(false)
  })
})
