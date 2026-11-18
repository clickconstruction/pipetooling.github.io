// @vitest-environment jsdom
/**
 * Render smoke for BidsPricingTab, the Pricing Workbench: the safety net for its sub-decomposition
 * (docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md, decomposition queue row 1). No test mounted the tab
 * before this one. The tab is a props component (its selection and its engine live in Bids.tsx), so
 * this is a makeProps exercise over the 70-prop seam with supabase stubbed for the tab's own reads.
 *
 * The bid on screen is small and priced: three counted fixtures, two with a price and a takeoff
 * cost, one with neither. The grid's rows come from the same kernel the page uses
 * (`scenarioPricingRows`), so the figures the strip shows are the app's own arithmetic on this
 * fixture. The cases pin that each block of the Workbench draws and that the doors between them
 * open: the picker, the loading and retry panel, the strip's figures, the rows with their kind
 * chips and splits, the tools, the cards, the frozen-price chip on a sent bid, and the two windows
 * the tab draws itself. A cut that moves one of these out must leave every case green.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

/** What a case hands the tab's two outside reads: the header chip, and the robot's pulled rows. */
const smoke = vi.hoisted(() => ({
  rfqChip: null as null | { kind: 'quotes'; tone: 'blue' | 'green'; label: string },
  robotRows: [] as Array<Record<string, unknown>>,
  robotPrice: [] as Array<[string, string]>,
}))
// The real quote desk, with the chip a case can set (the desk's own read is its hook's test).
vi.mock('../../hooks/usePricingQuoteDesk', async (importActual) => {
  const actual = await importActual<typeof import('../../hooks/usePricingQuoteDesk')>()
  return {
    ...actual,
    usePricingQuoteDesk: (args: Parameters<typeof actual.usePricingQuoteDesk>[0]) => {
      const desk = actual.usePricingQuoteDesk(args)
      return smoke.rfqChip ? { ...desk, rfqChip: smoke.rfqChip } : desk
    },
  }
})
vi.mock('../../hooks/useRobotFixtures', () => ({
  useRobotFixtures: () => ({
    state: smoke.robotRows.length > 0 ? { kind: 'ready', pull: { id: 'pull-1' }, rows: smoke.robotRows } : { kind: 'none' },
    reload: () => {},
    take: async () => ({ added: 0, updated: 0 }),
    untake: async () => ({ removed: 0, restored: 0, kept: 0 }),
    untakeRows: async () => ({ removed: 0, restored: 0, kept: 0 }),
    setAside: async () => ({ set_aside: 0 }),
    putBack: async () => ({ put_back: 0, landed: 0 }),
    price: async (bidId: string, pricingId: string) => {
      smoke.robotPrice.push([bidId, pricingId])
      return { priced_by_book: 0, priced_by_robot: 1 }
    },
  }),
}))

import { BidsPricingTab } from './BidsPricingTab'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { scenarioPricingRows } from '../../lib/bids/scenarioPricingRows'

type Props = Parameters<typeof BidsPricingTab>[0]
type Bid = NonNullable<Props['selectedBidForPricing']>

const PRICING_ID = 'price-base'

function makeBid(p: Record<string, unknown> = {}): Bid {
  return {
    id: 'bid-1',
    bid_number: '101',
    project_name: 'ZZ Test Clinic',
    builder_name: 'ZZ Test Builder',
    service_type_id: 'st-1',
    customer_id: null,
    bid_date_sent: null,
    bid_value: null,
    distance_from_office: null,
    alternate_group_tags: [],
    sov_material_factor: null,
    created_at: '2026-07-01T00:00:00Z',
    ...p,
  } as unknown as Bid
}

/** Three counted fixtures. The marks ride on the rows, as the engine's `select('*')` hands them over. */
const COUNT_ROWS = [
  { id: 'cr-wc', bid_id: 'bid-1', bid_version_id: null, fixture: 'Water closet', count: 6, group_tag: null, sequence_order: 0, kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: null, split_taxable: null },
  { id: 'cr-lav', bid_id: 'bid-1', bid_version_id: null, fixture: 'Lavatory', count: 4, group_tag: null, sequence_order: 1, kind: null, tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null },
  { id: 'cr-fd', bid_id: 'bid-1', bid_version_id: null, fixture: 'Floor drain', count: 3, group_tag: null, sequence_order: 2, kind: null, tags: null, split_material_cents: null, split_markup_pct: null, split_taxable: null },
] as unknown as Props['pricingCountRows']

/** Six water closets at $800 and four lavatories at $500: $6,800. The floor drain has no price. */
const CUSTOM_PRICES = [
  { id: 'cp-wc', bid_id: 'bid-1', count_row_id: 'cr-wc', price_book_version_id: PRICING_ID, unit_price: 800 },
  { id: 'cp-lav', bid_id: 'bid-1', count_row_id: 'cr-lav', price_book_version_id: PRICING_ID, unit_price: 500 },
] as unknown as Props['bidCountRowCustomPrices']

const LABOR_ROWS = [
  { id: 'lr-wc', cost_estimate_id: 'ce-1', fixture: 'Water closet', count: 6, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 0.5, trim_set_hrs_per_unit: 0.5, is_fixed: false, sequence_order: 0 },
  { id: 'lr-lav', cost_estimate_id: 'ce-1', fixture: 'Lavatory', count: 4, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 0.5, trim_set_hrs_per_unit: 0.5, is_fixed: false, sequence_order: 1 },
] as unknown as Props['pricingLaborRows']

const COST_ESTIMATE = { id: 'ce-1', bid_id: 'bid-1', labor_rate: 50, driving_cost_rate: 0.7, hours_per_trip: 2 } as unknown as NonNullable<Props['pricingCostEstimate']>
const MATERIALS_BY_ROW: Record<string, number> = { 'cr-wc': 1200, 'cr-lav': 400 }
const PRICINGS = [{ id: PRICING_ID, name: 'Base price', bid_id: 'bid-1', bid_version_id: null, sort_order: 0, source_template_id: null, is_offered: false }] as unknown as Props['priceBookVersions']

function gridRows(over: { countRows?: Props['pricingCountRows']; customPrices?: Props['bidCountRowCustomPrices'] } = {}) {
  return scenarioPricingRows({
    scenarioId: PRICING_ID,
    countRows: over.countRows ?? COUNT_ROWS,
    entries: [],
    assignments: [],
    customPrices: over.customPrices ?? CUSTOM_PRICES,
    hides: [],
    costs: { laborRows: LABOR_ROWS, totalMaterials: 1600, laborRate: 50, taxPercent: 8.25, materialsFromTakeoffByCountRowId: MATERIALS_BY_ROW, materialsOverrideUnitByCountRowId: new Map<string, number>() },
  } as unknown as Parameters<typeof scenarioPricingRows>[0])
}

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    bids: [],
    selectedBidForPricing: null,
    narrowViewport640: false,
    bidPreview: null as unknown as Props['bidPreview'],
    error: null,
    setError: vi.fn(),
    selectedServiceTypeId: 'st-1',
    fixtureTypes: [],
    getOrCreateFixtureTypeId: vi.fn(async () => ({ id: 'ft-1' })),
    loadBids: vi.fn(async () => []),
    costEstimatePOModalTaxPercent: '8.25',
    setCostEstimatePOModalTaxPercent: vi.fn(),
    onCommitTaxPercent: vi.fn(),
    onPatchBid: vi.fn(),
    canPackageAndSendBidPricing: true,
    estimatorUsers: [],
    ledgerPrefixMap: {},
    profileName: 'ZZ Test Estimator',
    priceBookVersions: [],
    priceBookEntries: [],
    setPriceBookEntries: vi.fn(),
    bidPricingAssignments: [],
    bidCountRowCustomPrices: [],
    bidCountRowSubmissionHides: [],
    selectedBidVersionId: null,
    bidVersions: [],
    onSwitchBidVersion: vi.fn(),
    reloadBidVersions: vi.fn(async () => {}),
    selectedPricingVersionId: null,
    setSelectedPricingVersionId: vi.fn(),
    pricingPricesReady: true,
    pricingCountRows: [],
    bidCountRowCustomCosts: [],
    reloadBidCustomCosts: vi.fn(async () => {}),
    pricingCostEstimate: null,
    pricingLaborRows: [],
    pricingEquipmentRows: [],
    pricingPermitRows: [],
    pricingSubcontractorRows: [],
    pricingWasteRows: [],
    pricingOtherRows: [],
    pricingMaterialTotalRoughIn: null,
    pricingMaterialTotalTopOut: null,
    pricingMaterialTotalTrimSet: null,
    pricingLaborRate: null,
    pricingLaborRateSource: 'none',
    pricingFixtureMaterialsFromTakeoff: {},
    teamLaborDataForBids: [],
    templatePriceBookVersions: [],
    defaultPriceBookTemplateId: null,
    loadTemplatePriceBookVersions: vi.fn(async () => {}),
    rememberLastPriceBookTemplate: vi.fn(),
    loadBidPricings: vi.fn(async () => []),
    loadPriceBookEntries: vi.fn(async () => {}),
    loadBidPricingAssignments: vi.fn(async () => {}),
    reloadPricingForBid: vi.fn(async () => {}),
    resolvePanel: 'content',
    onRetryResolve: vi.fn(),
    saveBidSelectedPriceBookVersion: vi.fn(async () => true),
    pricingRowsForGrid: null,
    pricingPackageSource: null,
    onSelectBid: vi.fn(),
    onClose: vi.fn(),
    onEditBid: vi.fn(),
    onNavigateBidToTab: vi.fn(),
    onNavigateBidToTabRow: vi.fn(),
    onlyMyBids: false,
    setOnlyMyBids: vi.fn(),
    isMyBid: vi.fn(() => false),
    ...overrides,
  } as unknown as Props
}

/** The priced bid on the Workbench. */
function pricedProps(overrides: Partial<Props> = {}, bid: Bid = makeBid()): Props {
  return makeProps({
    bids: [bid],
    selectedBidForPricing: bid,
    priceBookVersions: PRICINGS,
    selectedPricingVersionId: PRICING_ID,
    pricingCountRows: COUNT_ROWS,
    bidCountRowCustomPrices: CUSTOM_PRICES,
    pricingCostEstimate: COST_ESTIMATE,
    pricingLaborRows: LABOR_ROWS,
    pricingMaterialTotalRoughIn: 1600,
    pricingMaterialTotalTopOut: 0,
    pricingMaterialTotalTrimSet: 0,
    pricingLaborRate: 50,
    pricingLaborRateSource: 'override',
    pricingFixtureMaterialsFromTakeoff: MATERIALS_BY_ROW,
    pricingRowsForGrid: gridRows(),
    ...overrides,
  })
}

const grid = () => document.querySelector('[data-tour="workbench-rows"]') as HTMLElement
const strip = () => document.querySelector('[data-tour="workbench-summary"]') as HTMLElement
const gridRowCount = () => grid().querySelectorAll('tbody tr').length
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const TWO_PRICES = [...PRICINGS, { id: 'price-alt', name: 'Alternate 1', bid_id: 'bid-1', bid_version_id: null, sort_order: 1, source_template_id: null, is_offered: true }] as unknown as Props['priceBookVersions']

beforeEach(() => {
  smoke.rfqChip = null
  smoke.robotRows = []
  smoke.robotPrice = []
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('BidsPricingTab render smoke', () => {
  it('with no bid picked it draws the picker and no Workbench', async () => {
    renderWithProviders(<BidsPricingTab {...makeProps()} />)
    await settle()
    expect(screen.getByPlaceholderText('Search bids (bid #, project name, or GC/Builder)...')).toBeTruthy()
    expect(strip()).toBeNull()
    expect(grid()).toBeNull()
  })

  it("while the bid's prices resolve it says so, and draws no rows", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ resolvePanel: 'skeleton' })} />)
    await settle()
    expect(screen.getByRole('status', { name: "Loading this bid's packets and prices" })).toBeTruthy()
    expect(grid()).toBeNull()
    expect(strip()).toBeNull()
  })

  it('a resolve that failed offers Retry, and Retry reports', async () => {
    const onRetryResolve = vi.fn()
    renderWithProviders(<BidsPricingTab {...pricedProps({ resolvePanel: 'error', onRetryResolve })} />)
    await settle()
    expect(screen.getByText(/Couldn't load this bid's packets and prices/)).toBeTruthy()
    fireEvent.click(button('Retry'))
    expect(onRetryResolve).toHaveBeenCalledTimes(1)
    expect(grid()).toBeNull()
  })

  it('a bid with nothing counted draws the start panel, never the strip', async () => {
    const bid = makeBid()
    renderWithProviders(<BidsPricingTab {...makeProps({ bids: [bid], selectedBidForPricing: bid })} />)
    await settle()
    expect(screen.getByText(/ZZ Test Clinic/)).toBeTruthy()
    expect(strip()).toBeNull()
    expect(grid()).toBeNull()
  })

  it("the strip shows the bid's revenue, profit, margin and multiple", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    // 6 x $800 + 4 x $500 = $6,800. Cost: $1,600 material + $132 tax + 20 h x $50 = $2,732.
    const text = strip().textContent ?? ''
    expect(text).toContain('Revenue$6,800.00')
    expect(text).toContain('Profit$4,068.00')
    expect(text).toContain('Margin60%')
    expect(text).toContain('Multiple2.5×')
    expect(within(strip()).getByTitle('All 2 costed rows have a sale price')).toBeTruthy()
  })

  it('the strip carries its tools: the brush, Markup, Tax and the solver', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    for (const name of [/Margin ›/, /Markup ›/, /Tax ›/, /Solver ›/]) expect(within(strip()).getByRole('button', { name })).toBeTruthy()
  })

  it('the grid draws a row per counted fixture with its cost, its price cell and its kind', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    expect(gridRowCount()).toBe(3)
    const rows = [...grid().querySelectorAll('tbody tr')].map((tr) => tr.textContent ?? '')
    expect(rows[0]).toContain('Water closet')
    expect(rows[0]).toContain('$316.50')
    expect(rows[1]).toContain('Lavatory')
    expect(rows[1]).toContain('$208.25')
    expect(rows[2]).toContain('Floor drain')
    expect(rows[2]).toContain('no cost')
    expect((screen.getByLabelText('Sale price per unit for Water closet') as HTMLInputElement).value).toBe('$800.00')
    expect((screen.getByLabelText('Sale price per unit for Lavatory') as HTMLInputElement).value).toBe('$500.00')
    expect((screen.getByLabelText('Sale price per unit for Floor drain') as HTMLInputElement).value).toBe('')
    // A saved kind on the first row, the app's guess on the other two: all three read Fixture.
    expect(within(grid()).getAllByRole('group', { name: /^Kind of / }).map((el) => (el.textContent ?? '').replace('▾', ''))).toEqual(['Fixture', 'Fixture', 'Fixture'])
    expect(within(grid()).getByRole('button', { name: /restrooms/ })).toBeTruthy()
    expect(screen.getByLabelText('Add a tag to Lavatory')).toBeTruthy()
  })

  it("a row's chevron opens its split, and the header opens and closes every row's", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Open the split of Water closet: material, tax, labor'))
    expect(gridRowCount()).toBe(6)
    const child = [...grid().querySelectorAll('tbody tr')].slice(1, 4).map((tr) => tr.textContent ?? '')
    expect(child[0]).toContain('Material')
    expect(child[1]).toContain('Sales tax')
    expect(child[2]).toContain('Labor')
    // $1,200 of takeoff material at the company's 50%: $1,800 for the row.
    expect(child[0]).toContain('$1,800.00')
    expect((screen.getByLabelText('The material markup, percent, on Water closet') as HTMLInputElement).value).toBe('50')
    expect(window.localStorage.getItem('pt.pricing.split.open.bid-1')).toBe('["cr-wc"]')
    // Two rows open to Material, Sales tax and Labor; the row with no price opens to one line.
    fireEvent.click(button(/Expand all/))
    expect(gridRowCount()).toBe(10)
    expect(JSON.parse(window.localStorage.getItem('pt.pricing.split.open.bid-1') ?? '[]')).toEqual(['cr-wc', 'cr-lav', 'cr-fd'])
    fireEvent.click(button(/Collapse all/))
    expect(gridRowCount()).toBe(3)
  })

  it('the Markup and Tax tools open with their scopes and close', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(button(/Markup ›/))
    expect(strip().textContent).toContain('Material markup')
    expect(button(/Markup ›/).getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(button(/Markup ›/))
    expect(button(/Markup ›/).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button(/Tax ›/))
    expect(strip().textContent).toContain('0 of 2 rows are tax-free now')
    fireEvent.click(button(/Tax ›/))
    expect(button(/Tax ›/).getAttribute('aria-expanded')).toBe('false')
  })

  it('the book-match bar names the open price and opens the price book', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    expect(button(/0 unassigned rows match the book/)).toBeTruthy()
    fireEvent.click(button(/Base price · 0 entries/))
    await settle()
    expect(screen.getAllByText(/Price book/).length).toBeGreaterThan(1)
  })

  it("the three cards and the profit bar draw the bid's own totals", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    const body = document.body.textContent ?? ''
    expect(body).toContain('Traditional breakdown')
    expect(body).toContain('The bid$2,732.00$6,800.00$4,068.0059.8%')
    expect(body).toContain('Kind breakdown')
    expect(body).toContain('Fixtures3 rows')
    expect(body).toContain('Tag breakdown')
    expect(body).toContain('restrooms1 row')
    expect(body).toContain('Where the profit lives')
    expect((screen.getByLabelText("This bid's material markup, percent") as HTMLInputElement).value).toBe('50')
  })

  it("a row's ⓘ opens its margin breakdown", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Margin breakdown for Water closet'))
    await settle()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain('Water closet')
  })

  it('an unsent bid has no frozen-price chip', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    expect(screen.queryByTestId('pricing-lock-chip')).toBeNull()
    expect(screen.queryByTestId('pricing-sent-vs-today')).toBeNull()
  })

  it('a sent bid wears the lock chip and the Sent line, and Revise unlocks it for this session', async () => {
    const sent = makeBid({ bid_date_sent: '2026-06-02', bid_value: 6500 })
    renderWithProviders(<BidsPricingTab {...pricedProps({}, sent)} />)
    await settle()
    const chip = screen.getByTestId('pricing-lock-chip')
    expect(chip.textContent).toContain('🔒')
    expect(screen.getByTestId('pricing-sent-vs-today').textContent).toContain('$6,500')
    fireEvent.click(within(chip).getByRole('button', { name: 'Revise…' }))
    await settle()
    expect(screen.getByTestId('pricing-lock-chip').textContent).toContain('✎')
    expect(within(screen.getByTestId('pricing-lock-chip')).getByRole('button', { name: 'Lock again' })).toBeTruthy()
    expect(window.sessionStorage.length).toBe(1)
  })

  it('the header chip shows what the quote desk says', async () => {
    smoke.rfqChip = { kind: 'quotes', tone: 'blue', label: 'Quotes (2)' }
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    expect(button('Quotes (2)').id).toBe('pricing-price-requests')
  })

  it('without the quote desk saying anything there is no header chip', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    expect(document.getElementById('pricing-price-requests')).toBeNull()
  })

  it('robot rows that landed before a book was picked get their door, and the door prices them', async () => {
    smoke.robotRows = [{ id: 'rr-1', taken_at: '2026-06-01T00:00:00Z', count_row_id: 'cr-fd', taken_as: 'added', priced_as: 'unpriced', robot_unit_price: 412 }]
    const reloadPricingForBid = vi.fn(async () => {})
    renderWithProviders(<BidsPricingTab {...pricedProps({ reloadPricingForBid })} />)
    await settle()
    fireEvent.click(button(/Price 1 robot row at the robot's prices/))
    await settle()
    expect(smoke.robotPrice).toEqual([['bid-1', PRICING_ID]])
    expect(reloadPricingForBid).toHaveBeenCalledWith('bid-1')
  })

  it("the ✎ on a price card opens the Price window; Cancel closes it and nothing is renamed", async () => {
    const loadBidPricings = vi.fn(async () => [])
    renderWithProviders(<BidsPricingTab {...pricedProps({ priceBookVersions: TWO_PRICES, loadBidPricings })} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Edit Alternate 1'))
    const win = screen.getByRole('dialog', { name: 'Price' })
    expect((within(win).getByLabelText('Name') as HTMLInputElement).value).toBe('Alternate 1')
    // The base price cannot be deleted from here; another price can.
    expect((within(win).getByRole('button', { name: 'Delete' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(within(win).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Price' })).toBeNull()
    expect(loadBidPricings).not.toHaveBeenCalled()
  })

  it('＋ Add price opens its door, and Another price opens the name window', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ priceBookVersions: TWO_PRICES })} />)
    await settle()
    fireEvent.click(button(/Add\s*price/))
    fireEvent.click(button(/Another price for/))
    const win = screen.getByRole('dialog', { name: /Another price for/ })
    expect(within(win).getByText('Name this price option')).toBeTruthy()
    expect(within(win).getAllByRole('option').map((o) => o.textContent)).toEqual(['Base price · ★ base', 'Alternate 1'])
    fireEvent.click(within(win).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: /Another price for/ })).toBeNull()
  })

  it('a rename typed in the Price window and saved closes the window and reads the prices again', async () => {
    const loadBidPricings = vi.fn(async () => [])
    renderWithProviders(<BidsPricingTab {...pricedProps({ priceBookVersions: TWO_PRICES, loadBidPricings })} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Edit Alternate 1'))
    const win = screen.getByRole('dialog', { name: 'Price' })
    fireEvent.change(within(win).getByLabelText('Name'), { target: { value: 'Value option' } })
    expect((within(win).getByLabelText('Name') as HTMLInputElement).value).toBe('Value option')
    fireEvent.click(within(win).getByRole('button', { name: 'Save' }))
    await settle()
    expect(screen.queryByRole('dialog', { name: 'Price' })).toBeNull()
    expect(loadBidPricings).toHaveBeenCalledWith('bid-1')
  })

  it('the Another price window shows what is typed, starts from the open price and offers it at once', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ priceBookVersions: TWO_PRICES })} />)
    await settle()
    fireEvent.click(button(/Add\s*price/))
    fireEvent.click(button(/Another price for/))
    const win = screen.getByRole('dialog', { name: /Another price for/ })
    const box = within(win).getByPlaceholderText('Alternate 2') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'Value option' } })
    expect(box.value).toBe('Value option')
    expect((within(win).getByRole('combobox') as HTMLSelectElement).value).toBe(PRICING_ID)
    expect((within(win).getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })
})
