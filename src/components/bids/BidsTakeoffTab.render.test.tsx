// @vitest-environment jsdom
/**
 * Render-smoke tests for BidsTakeoffTab — the safety net for its
 * sub-decomposition (see docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md). Pins
 * crash-on-mount for the main regions BEFORE extractions move code: the
 * no-bid picker and the two Combined views (Old retired v2.3588), which a bid
 * still flagged By Stage opens on too (By Stage retired v2.4389). NOT behavior tests.
 *
 * The tab is a props component (its selection + engine live in Bids.tsx), so
 * this is a makeProps exercise over the ~53-prop seam; supabase is stubbed
 * for the tab's own mount-time loads.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const loadStageSplits = vi.fn(async (_supabase: unknown, _bidId: string) => [])
vi.mock('../../lib/bids/materialsByStageIo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/bids/materialsByStageIo')>()),
  loadStageSplitsForBid: (supabase: unknown, bidId: string) => loadStageSplits(supabase, bidId),
}))

import { BidsTakeoffTab } from './BidsTakeoffTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

type Props = Parameters<typeof BidsTakeoffTab>[0]

function makeBid(p: Record<string, unknown> = {}) {
  return {
    id: 'bid-1',
    bid_number: '101',
    project_name: 'Smoke Project',
    builder_name: 'Smoke Builder',
    materials_model: 'rough',
    service_type_id: 'st-1',
    created_at: '2026-07-01T00:00:00Z',
    ...p,
  } as unknown as NonNullable<Props['selectedBidForTakeoff']>
}

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    bids: [],
    selectedBidForTakeoff: null,
    selectedBidVersionId: null,
    selectedBidForCostEstimate: null,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    error: null,
    setError: vi.fn(),
    selectedServiceTypeId: 'st-1',
    serviceTypes: [],
    loadBids: vi.fn(async () => []),
    activeTab: 'takeoffs',
    costEstimatePOModalTaxPercent: '8.25',
    setCostEstimatePOModalTaxPercent: vi.fn(),
    takeoffCountRows: [],
    takeoffRoughPartLines: [],
    setTakeoffRoughPartLines: vi.fn(),
    takeoffRoughCatalogLowestByPartId: {},
    setTakeoffRoughCatalogLowestByPartId: vi.fn(),
    materialTemplates: [],
    takeoffBookVersions: [],
    takeoffBookEntries: [],
    setTakeoffBookEntries: vi.fn(),
    selectedTakeoffBookVersionId: null,
    setSelectedTakeoffBookVersionId: vi.fn(),
    takeoffBookEntriesVersionId: null,
    setTakeoffBookEntriesVersionId: vi.fn(),
    costEstimateCountRows: [],
    costEstimateMaterialTotalRoughIn: 0,
    loadTakeoffBookVersions: vi.fn(async () => {}),
    loadTakeoffBookEntries: vi.fn(async () => {}),
    saveBidSelectedTakeoffBookVersion: vi.fn(async () => {}),
    loadMaterialTemplates: vi.fn(async () => {}),
    onSelectBid: vi.fn(),
    onClose: vi.fn(),
    onEditBid: vi.fn(),
    ledgerPrefixMap: {},
    onlyMyBids: false,
    setOnlyMyBids: vi.fn(),
    isMyBid: vi.fn(() => false),
    ...overrides,
  } as unknown as Props
}

const PICKER_ANCHOR = 'Search bids (bid #, project name, or GC/Builder)...'

describe('BidsTakeoffTab render smoke', () => {
  it('mounts the bid picker when no bid is selected', async () => {
    renderWithProviders(<BidsTakeoffTab {...makeProps()} />)
    await settle()
    expect(screen.getByPlaceholderText(PICKER_ANCHOR)).toBeTruthy()
  })

  it('opens a bid still flagged By Stage on One at a time like any other bid, with no Materials pills (v2.4389)', async () => {
    window.localStorage.removeItem('bids_takeoff_view_v1')
    renderWithProviders(
      <BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: 'exact' }) })} />,
    )
    expect(await screen.findByTestId('takeoff-focus-view')).toBeTruthy()
    expect(screen.getByTestId('takeoff-view-chooser')).toBeTruthy()
    expect(screen.queryByPlaceholderText(PICKER_ANCHOR)).toBeNull()
    expect(screen.queryByRole('button', { name: 'By Stage' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Combined' })).toBeNull()
    expect(screen.queryByText('Create purchase orders for Stages')).toBeNull()
  })

  it('mounts a Combined bid on One at a time by default, with the chooser up on a fresh device (v2.3588)', async () => {
    window.localStorage.removeItem('bids_takeoff_view_v1')
    renderWithProviders(
      <BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: 'rough' }) })} />,
    )
    expect(await screen.findByTestId('takeoff-focus-view')).toBeTruthy()
    expect(screen.getByTestId('takeoff-view-chooser')).toBeTruthy()
    expect(screen.getByRole('tablist', { name: 'Takeoffs view' })).toBeTruthy()
  })

  // The two Combined views (v2.2778 / v2.2781) — pinned through Old's retirement (v2.3588).
  it('mounts One at a time (new1) on a Combined bid', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'new1')
    try {
      renderWithProviders(
        <BidsTakeoffTab
          {...makeProps({
            selectedBidForTakeoff: makeBid({ materials_model: 'rough' }),
            takeoffCountRows: [{ id: 'row-1', bid_id: 'bid-1', fixture: 'WC-1', count: 2, sequence_order: 1 } as unknown as Props['takeoffCountRows'][number]],
          })}
        />,
      )
      expect(await screen.findByTestId('takeoff-focus-view')).toBeTruthy()
      expect(screen.getByTestId('takeoff-coverage-strip')).toBeTruthy()
      expect(screen.queryByText('Apply Matching Fixture Assemblies')).toBeNull()
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('hops One at a time → Sheet view and remembers the pick (v2.2998)', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'new1')
    try {
      renderWithProviders(
        <BidsTakeoffTab
          {...makeProps({
            selectedBidForTakeoff: makeBid({ materials_model: 'rough' }),
            takeoffCountRows: [{ id: 'row-1', bid_id: 'bid-1', fixture: 'WC-1', count: 2, sequence_order: 1 } as unknown as Props['takeoffCountRows'][number]],
          })}
        />,
      )
      expect(await screen.findByTestId('takeoff-focus-view')).toBeTruthy()
      fireEvent.click(screen.getByText('Sheet view'))
      expect(await screen.findByTestId('takeoff-cost-rail-view')).toBeTruthy()
      expect(screen.queryByTestId('takeoff-focus-view')).toBeNull()
      expect(window.localStorage.getItem('bids_takeoff_view_v1')).toBe('new2')
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('asks which view to use the first time a Combined bid opens on a device, and a pick opens it (v2.3082)', async () => {
    window.localStorage.removeItem('bids_takeoff_view_v1')
    try {
      renderWithProviders(
        <BidsTakeoffTab
          {...makeProps({
            selectedBidForTakeoff: makeBid({ materials_model: 'rough' }),
            takeoffCountRows: [{ id: 'row-1', bid_id: 'bid-1', fixture: 'WC-1', count: 2, sequence_order: 1 } as unknown as Props['takeoffCountRows'][number]],
          })}
        />,
      )
      const chooser = await screen.findByTestId('takeoff-view-chooser')
      expect(chooser.textContent).toContain('How do you want to cost this takeoff?')
      expect(chooser.textContent).toContain('BP101 Smoke Project')
      fireEvent.click(screen.getByRole('button', { name: /^Sheet$/ }))
      expect(await screen.findByTestId('takeoff-cost-rail-view')).toBeTruthy()
      expect(screen.queryByTestId('takeoff-view-chooser')).toBeNull()
      expect(window.localStorage.getItem('bids_takeoff_view_v1')).toBe('new2')
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('does not ask again once the device remembers a view — a remembered pick of the retired Old lands on One at a time (v2.3165, v2.3588)', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'old')
    try {
      renderWithProviders(
        <BidsTakeoffTab
          {...makeProps({
            selectedBidForTakeoff: makeBid({ materials_model: 'rough' }),
            takeoffCountRows: [{ id: 'row-1', bid_id: 'bid-1', fixture: 'WC-1', count: 2, sequence_order: 1 } as unknown as Props['takeoffCountRows'][number]],
          })}
        />,
      )
      expect(await screen.findByTestId('takeoff-focus-view')).toBeTruthy()
      expect(screen.queryByTestId('takeoff-view-chooser')).toBeNull()
      expect(screen.queryByTestId('takeoff-cost-rail-view')).toBeNull()
      expect(screen.queryByText('Apply Matching Fixture Assemblies')).toBeNull()
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('mounts Sheet (new2, the cost rail) on a Combined bid', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'new2')
    try {
      renderWithProviders(
        <BidsTakeoffTab
          {...makeProps({
            selectedBidForTakeoff: makeBid({ materials_model: 'rough' }),
            takeoffCountRows: [{ id: 'row-1', bid_id: 'bid-1', fixture: 'WC-1', count: 2, sequence_order: 1 } as unknown as Props['takeoffCountRows'][number]],
          })}
        />,
      )
      expect(await screen.findByTestId('takeoff-cost-rail-view')).toBeTruthy()
      expect(screen.getByText('What Pricing sees')).toBeTruthy()
      expect(screen.queryByTestId('takeoff-view-chooser')).toBeNull()
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('a bid still flagged By Stage follows the view the device remembers (v2.4389)', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'new2')
    try {
      renderWithProviders(
        <BidsTakeoffTab
          {...makeProps({
            selectedBidForTakeoff: makeBid({ materials_model: 'exact' }),
            takeoffCountRows: [{ id: 'row-1', bid_id: 'bid-1', fixture: 'WC-1', count: 2, sequence_order: 1 } as unknown as Props['takeoffCountRows'][number]],
          })}
        />,
      )
      expect(await screen.findByTestId('takeoff-cost-rail-view')).toBeTruthy()
      expect(screen.getByRole('tablist', { name: 'Takeoffs view' })).toBeTruthy()
      expect(screen.queryByText('Create purchase orders for Stages')).toBeNull()
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('mounts a bid with no materials_model as Combined', async () => {
    renderWithProviders(
      <BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: null }) })} />,
    )
    expect(await screen.findByTestId('takeoff-focus-view')).toBeTruthy()
  })

  it('reads the stage boxes again when the version changes, so a version made a moment ago shows the boxes it brought (v2.4393)', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'new2')
    try {
      loadStageSplits.mockClear()
      const bid = makeBid({ materials_model: 'rough' })
      const { rerender } = renderWithProviders(<BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: bid, selectedBidVersionId: 'v-1' })} />)
      await settle()
      expect(loadStageSplits).toHaveBeenCalledTimes(1)
      rerender(<BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: bid, selectedBidVersionId: 'v-2' })} />)
      await settle()
      expect(loadStageSplits).toHaveBeenCalledTimes(2)
      expect(loadStageSplits.mock.calls.map((c) => c[1])).toEqual(['bid-1', 'bid-1'])
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })
})
