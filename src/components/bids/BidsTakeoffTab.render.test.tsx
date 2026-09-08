// @vitest-environment jsdom
/**
 * Render-smoke tests for BidsTakeoffTab — the safety net for its
 * sub-decomposition (see docs/BIDS_TAKEOFF_TAB_ARCHITECTURE.md). Pins
 * crash-on-mount for the main regions BEFORE extractions move code: the
 * no-bid picker, the exact ("By Stage") body, the rough ("Combined") body,
 * and the always-rendered takeoff-book selector. NOT behavior tests.
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

import { BidsTakeoffTab } from './BidsTakeoffTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type Props = Parameters<typeof BidsTakeoffTab>[0]

function makeBid(p: Record<string, unknown> = {}) {
  return {
    id: 'bid-1',
    bid_number: '101',
    project_name: 'Smoke Project',
    builder_name: 'Smoke Builder',
    materials_model: 'exact',
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
    authUser: { id: 'smoke-auth-user-1' },
    loadBids: vi.fn(async () => []),
    activeTab: 'takeoffs',
    costEstimatePOModalTaxPercent: '8.25',
    setCostEstimatePOModalTaxPercent: vi.fn(),
    takeoffCountRows: [],
    takeoffMappings: [],
    setTakeoffMappings: vi.fn(),
    takeoffRoughPartLines: [],
    setTakeoffRoughPartLines: vi.fn(),
    takeoffRoughCatalogLowestByPartId: {},
    setTakeoffRoughCatalogLowestByPartId: vi.fn(),
    materialTemplates: [],
    draftPOs: [],
    takeoffBookVersions: [],
    takeoffBookEntries: [],
    setTakeoffBookEntries: vi.fn(),
    selectedTakeoffBookVersionId: null,
    setSelectedTakeoffBookVersionId: vi.fn(),
    takeoffBookEntriesVersionId: null,
    setTakeoffBookEntriesVersionId: vi.fn(),
    costEstimate: null,
    costEstimateCountRows: [],
    purchaseOrdersForCostEstimate: [],
    costEstimateMaterialTotalRoughIn: 0,
    costEstimateMaterialTotalTopOut: 0,
    costEstimateMaterialTotalTrimSet: 0,
    loadDraftPOs: vi.fn(async () => {}),
    loadTakeoffBookVersions: vi.fn(async () => {}),
    loadTakeoffBookEntries: vi.fn(async () => {}),
    saveBidSelectedTakeoffBookVersion: vi.fn(async () => {}),
    loadPurchaseOrdersForCostEstimate: vi.fn(async () => {}),
    loadCostEstimate: vi.fn(async () => {}),
    ensureCostEstimateForBid: vi.fn(async () => {}),
    loadMaterialTemplates: vi.fn(async () => {}),
    setCostEstimatePO: vi.fn(),
    openMaterialsModelSwitch: vi.fn(),
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
  it('mounts the bid picker when no bid is selected', () => {
    renderWithProviders(<BidsTakeoffTab {...makeProps()} />)
    expect(screen.getByPlaceholderText(PICKER_ANCHOR)).toBeTruthy()
  })

  it('mounts the exact ("By Stage") body with the takeoff-book selector', async () => {
    renderWithProviders(
      <BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: 'exact' }) })} />,
    )
    expect((await screen.findAllByText('Takeoff book')).length).toBeGreaterThan(0)
    expect(screen.queryByPlaceholderText(PICKER_ANCHOR)).toBeNull()
  })

  it('mounts the rough ("Combined") body', async () => {
    renderWithProviders(
      <BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: 'rough' }) })} />,
    )
    expect((await screen.findAllByText('Takeoff book')).length).toBeGreaterThan(0)
  })

  // The new views (v2.2778 / v2.2781) — pinned so Old's retirement cannot take them down unnoticed.
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

  it('asks which view to use when a Combined bid opens, and a pick opens it (v2.3082)', async () => {
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

  it('never asks on a By Stage bid', async () => {
    renderWithProviders(<BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: 'exact' }) })} />)
    expect((await screen.findAllByText('Takeoff book')).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('takeoff-view-chooser')).toBeNull()
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
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('shows the By Stage notice on One at a time / Sheet for an exact bid', async () => {
    window.localStorage.setItem('bids_takeoff_view_v1', 'new2')
    try {
      renderWithProviders(<BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: 'exact' }) })} />)
      expect(await screen.findByText('This bid uses By Stage materials')).toBeTruthy()
    } finally {
      window.localStorage.removeItem('bids_takeoff_view_v1')
    }
  })

  it('mounts with a null materials_model (normalizeMaterialsModel default path)', async () => {
    renderWithProviders(
      <BidsTakeoffTab {...makeProps({ selectedBidForTakeoff: makeBid({ materials_model: null }) })} />,
    )
    expect((await screen.findAllByText('Takeoff book')).length).toBeGreaterThan(0)
  })
})
