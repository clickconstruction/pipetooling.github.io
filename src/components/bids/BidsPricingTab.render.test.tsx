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
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

/** The rows a case hands the tab's own reads, by table, and every write the tab sends, in order. */
const db = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  writes: [] as Array<{ table: string; op: string; payload: unknown }>,
}))
// The shared stub, with `from` answering a table's rows and recording a write once it is awaited.
// A table with no rows answers as the shared stub does: an empty list, or null for a single row.
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const WRITES = ['insert', 'update', 'upsert', 'delete']
  return {
    supabase: {
      ...makeSupabaseStub(),
      from: (table: string) => {
        let op: string | null = null
        let payload: unknown
        let single = false
        let logged = false
        const answer = () => {
          if (op && !logged) {
            logged = true
            db.writes.push({ table, op, payload })
          }
          const rows = op ? [] : (db.tables[table] ?? [])
          return { data: single ? (rows[0] ?? null) : rows, error: null, count: rows.length }
        }
        const builder: unknown = new Proxy(
          {},
          {
            get(_target, prop) {
              if (prop === 'then') return (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(answer()).then(resolve, reject)
              return (...args: unknown[]) => {
                if (!op && WRITES.includes(String(prop))) {
                  op = String(prop)
                  payload = args[0]
                }
                if (prop === 'single' || prop === 'maybeSingle') single = true
                return builder
              }
            },
          },
        )
        return builder
      },
    },
  }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

/** What a case hands the tab's two outside reads: the header chip, and the robot's pulled rows. */
const smoke = vi.hoisted(() => ({
  rfqChip: null as null | { kind: 'quotes'; tone: 'blue' | 'green'; label: string } | { kind: 'desk'; tone: 'amber' | 'red' | 'green'; label: string },
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
import { getPricingTapeSink, setPricingTapeOpen } from '../../lib/bids/pricingTapeBridge'
import { TAPE_DRAG_TYPE, parseTapeLine } from '../../lib/bids/tapeDrag'
import { moneyText } from '../../test/moneyText'

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

function gridRows(over: { scenarioId?: string; countRows?: Props['pricingCountRows']; customPrices?: Props['bidCountRowCustomPrices'] } = {}) {
  return scenarioPricingRows({
    scenarioId: over.scenarioId ?? PRICING_ID,
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
  db.tables = {}
  db.writes = []
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

  it('a price being typed moves the bar before it is saved', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    // $1,000 on six water closets, with the lavatories still at $500: $8,000, less the same $2,732.
    fireEvent.change(screen.getByLabelText('Sale price per unit for Water closet'), { target: { value: '$1,000' } })
    const text = strip().textContent ?? ''
    expect(text).toContain('Revenue$8,000.00')
    expect(text).toContain('Profit$5,268.00')
  })

  it("a stashed solve comes back as proposals: the bar follows it, and a clicked-off row holds its saved price", async () => {
    // $900 on the water closets and $250 on the floor drains count; the lavatories' $650 was clicked off, so their $500 stands.
    window.localStorage.setItem('bids_wb_preview_v2:price-base', JSON.stringify({ prices: { 'cr-wc': 900, 'cr-lav': 650, 'cr-fd': 250 }, at: 1790000000000, vetoed: ['cr-lav'] }))
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    const text = strip().textContent ?? ''
    expect(text).toContain('Revenue$8,150.00')
    expect(text).toContain('Profit$5,418.00')
    // The rows' own cells keep the saved prices until Apply.
    expect((screen.getByLabelText('Sale price per unit for Water closet') as HTMLInputElement).value).toBe('$800.00')
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

  it("a row's tags and kind are set under its name: + opens the box, Enter adds a tag, a press takes one off, the chip sets the kind", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Add a tag to Lavatory'))
    const box = screen.getByPlaceholderText('a tag, then Enter') as HTMLInputElement
    expect(box.getAttribute('aria-label')).toBe('Add a tag to Lavatory')
    fireEvent.change(box, { target: { value: 'Level 2' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await settle()
    expect(within(grid()).getByRole('button', { name: /level 2/ })).toBeTruthy()

    fireEvent.click(within(grid()).getByRole('button', { name: /restrooms/ }))
    await settle()
    expect(within(grid()).queryByRole('button', { name: /restrooms/ })).toBeNull()

    const kindOfDrain = () => within(grid()).getByRole('group', { name: 'Kind of Floor drain' })
    expect(kindOfDrain().textContent).toContain('Fixture')
    fireEvent.click(within(kindOfDrain()).getByRole('combobox'))
    fireEvent.click(await screen.findByRole('option', { name: /Pipe/ }))
    await settle()
    expect(kindOfDrain().textContent).toContain('Pipe')
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

  // The split's child rows (punch list #46 row 1, the second medium cut). Pinned on the tab as it stood, before
  // the rows moved to `PricingSplitRows`: every cell of every line, in each shape the split takes.
  const splitLines = () =>
    [...grid().querySelectorAll('tbody tr')]
      .filter((tr) => !tr.id.startsWith('wb-row-'))
      .map((tr) => (tr.id ? `#${tr.id} ` : '') + [...tr.querySelectorAll('td')].map((td) => (td.textContent ?? '').trim() + [...td.querySelectorAll('input')].map((x) => `[${(x as HTMLInputElement).value}]`).join('')).join(' ¦ '))

  it('the split’s lines carry their own dollars: cost, price, revenue, profit and margin a part', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(button(/Expand all/))
    await settle()
    expect(splitLines()).toEqual([
      // Six water closets at $800. Material is the takeoff's $200 a unit plus 50%, tax is 8.25% of that, labor is what is left.
      '#wb-split-cr-wc  ¦ ├Materialthe takeoff +%[50] ¦ 6 ¦ $200.00 ¦  ¦ [300.00] ¦ $1,800.00 ¦ $600.00 ¦ 33% ¦ ',
      ' ¦ ├Sales tax8.25% on material ¦ 6 ¦ $16.50 ¦  ¦ $24.75 ¦ $148.50 ¦ $49.50 ¦ 33% ¦ ',
      ' ¦ └Laborwhat is left ¦ 6 ¦ $100.00 ¦  ¦ $475.25 ¦ $2,851.50 ¦ $2,251.50 ¦ 79% ¦ ',
      '#wb-split-cr-lav  ¦ ├Materialthe takeoff +%[50] ¦ 4 ¦ $100.00 ¦  ¦ [150.00] ¦ $600.00 ¦ $200.00 ¦ 33% ¦ ',
      ' ¦ ├Sales tax8.25% on material ¦ 4 ¦ $8.25 ¦  ¦ $12.38 ¦ $49.50 ¦ $16.50 ¦ 33% ¦ ',
      ' ¦ └Laborwhat is left ¦ 4 ¦ $100.00 ¦  ¦ $337.63 ¦ $1,350.50 ¦ $950.50 ¦ 70% ¦ ',
      '#wb-split-cr-fd  ¦ └No price on this row yet, so nothing to split.',
    ])
    const material = screen.getByLabelText('Material per unit in the price of Water closet') as HTMLInputElement
    expect(material.title).toBe('The rule: the takeoff +50%. Type over it for this row.')
    expect((screen.getByLabelText('The material markup, percent, on Water closet') as HTMLInputElement).title).toBe("The bid's markup. Type one for this row alone.")
    const taxed = screen.getAllByTitle('Taxed — press to make this row tax-free')
    expect(taxed.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['8.25% on material', 'true'], ['8.25% on material', 'true']])
    // A part's margin wears the grid's own colours: 33% is amber, labor's 79% is green.
    const marginColour = (tr: Element) => ([...tr.querySelectorAll('td')][8] as HTMLElement).style.color
    const wc = [...grid().querySelectorAll('tbody tr')].slice(1, 4)
    expect(wc.map(marginColour)).toEqual(['var(--text-amber-700)', 'var(--text-amber-700)', 'var(--text-green-600)'])
    // The material box is the grid's quiet cell at the price column's width, dashed while the rule prices it.
    expect([material.style.width, material.style.textAlign, material.style.borderBottomStyle]).toEqual(['6rem', 'right', 'dashed'])
  })

  it('the Sales tax line’s press makes a row tax-free, writes it on the row, and labor takes what is left', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Open the split of Water closet: material, tax, labor'))
    fireEvent.click(screen.getByTitle('Taxed — press to make this row tax-free'))
    await settle()
    expect(db.writes).toEqual([{ table: 'bids_count_rows', op: 'update', payload: { kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: null, split_taxable: false } }])
    expect(splitLines()).toEqual([
      '#wb-split-cr-wc  ¦ ├Materialthe takeoff +%[50] ¦ 6 ¦ $200.00 ¦  ¦ [300.00] ¦ $1,800.00 ¦ $600.00 ¦ 33% ¦ ',
      // The tax we still pay on the material shows as a loss on its own line: no tax is charged, $99 is owed.
      ' ¦ ├Sales taxtax-free ¦ 6 ¦ $16.50 ¦  ¦ $0.00 ¦ $0.00 ¦ −$99.00 ¦  ¦ ',
      ' ¦ └Laborwhat is left ¦ 6 ¦ $100.00 ¦  ¦ $500.00 ¦ $3,000.00 ¦ $2,400.00 ¦ 80% ¦ ',
    ])
    const free = screen.getByTitle('Tax-free — press to tax its material')
    expect(free.getAttribute('aria-pressed')).toBe('false')
    // The struck-through price says the tax is off, where a taxed line's is plain.
    const taxLine = [...grid().querySelectorAll('tbody tr')][2] as HTMLElement
    expect([...taxLine.querySelectorAll('span')].some((x) => x.style.textDecoration === 'line-through')).toBe(true)
  })

  it('a material price typed on a split line is kept on the row, and clearing it with Enter goes back to the rule', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Open the split of Water closet: material, tax, labor'))
    const box = () => screen.getByLabelText('Material per unit in the price of Water closet') as HTMLInputElement
    fireEvent.change(box(), { target: { value: '250' } })
    fireEvent.blur(box())
    await settle()
    // $250 a unit for six: $1,500, kept in cents.
    expect(db.writes).toEqual([{ table: 'bids_count_rows', op: 'update', payload: { kind: 'fixture', tags: ['restrooms'], split_material_cents: 150000, split_markup_pct: null, split_taxable: null } }])
    expect(splitLines()).toEqual([
      '#wb-split-cr-wc  ¦ ├Materialtyped ¦ 6 ¦ $200.00 ¦  ¦ [250.00] ¦ $1,500.00 ¦ $300.00 ¦ 20% ¦ ',
      ' ¦ ├Sales tax8.25% on material ¦ 6 ¦ $16.50 ¦  ¦ $20.63 ¦ $123.75 ¦ $24.75 ¦ 20% ¦ ',
      ' ¦ └Laborwhat is left ¦ 6 ¦ $100.00 ¦  ¦ $529.38 ¦ $3,176.25 ¦ $2,576.25 ¦ 81% ¦ ',
    ])
    expect(box().title).toBe('Typed for this row — clear it to go back to the rule')
    // A typed price is underlined solid, in the cell's own width.
    expect([box().style.width, box().style.borderBottomStyle]).toEqual(['6rem', 'solid'])
    // A typed material has no markup box: the rule is not what prices it.
    expect(screen.queryByLabelText('The material markup, percent, on Water closet')).toBeNull()
    db.writes = []
    box().focus()
    fireEvent.change(box(), { target: { value: '' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    await settle()
    expect(db.writes).toEqual([{ table: 'bids_count_rows', op: 'update', payload: { kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: null, split_taxable: null } }])
    expect(splitLines()[0]).toBe('#wb-split-cr-wc  ¦ ├Materialthe takeoff +%[50] ¦ 6 ¦ $200.00 ¦  ¦ [300.00] ¦ $1,800.00 ¦ $600.00 ¦ 33% ¦ ')
  })

  it('a markup typed on a split line moves the line as it is typed, and is kept on the row when the box is left', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Open the split of Water closet: material, tax, labor'))
    const box = () => screen.getByLabelText('The material markup, percent, on Water closet') as HTMLInputElement
    fireEvent.focus(box())
    // The box shows what is being typed, as typed, and not the number it works out to.
    fireEvent.change(box(), { target: { value: '040' } })
    expect(box().value).toBe('040')
    fireEvent.change(box(), { target: { value: '40' } })
    expect(box().value).toBe('40')
    const at40 = [
      '#wb-split-cr-wc  ¦ ├Materialthe takeoff +%[40] ¦ 6 ¦ $200.00 ¦  ¦ [280.00] ¦ $1,680.00 ¦ $480.00 ¦ 29% ¦ ',
      ' ¦ ├Sales tax8.25% on material ¦ 6 ¦ $16.50 ¦  ¦ $23.10 ¦ $138.60 ¦ $39.60 ¦ 29% ¦ ',
      ' ¦ └Laborwhat is left ¦ 6 ¦ $100.00 ¦  ¦ $496.90 ¦ $2,981.40 ¦ $2,381.40 ¦ 80% ¦ ',
    ]
    // Before anything is saved: the three lines already read at 40%.
    expect(splitLines()).toEqual(at40)
    expect(db.writes).toEqual([])
    fireEvent.blur(box())
    await settle()
    expect(db.writes).toEqual([{ table: 'bids_count_rows', op: 'update', payload: { kind: 'fixture', tags: ['restrooms'], split_material_cents: null, split_markup_pct: 40, split_taxable: null } }])
    expect(splitLines()).toEqual(at40)
    expect(box().title).toBe("This row's own markup; the bid's is 50%. Clear it to go back.")
    expect((screen.getByLabelText('Material per unit in the price of Water closet') as HTMLInputElement).title).toBe('The rule: the takeoff +40%. Type over it for this row.')
  })

  it('an equipment row splits to one line with no cost, and a labor line that goes under reads red with no margin', async () => {
    // The water closet's material is typed at $5,000, over its $4,800 price. The lavatory is an Equipment row.
    const base = COUNT_ROWS as unknown as Array<Record<string, unknown>>
    const rows = [{ ...base[0], split_material_cents: 500000 }, { ...base[1], kind: 'equipment' }, base[2]] as unknown as Props['pricingCountRows']
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: rows, pricingRowsForGrid: gridRows({ countRows: rows }) })} />)
    await settle()
    fireEvent.click(button(/Expand all/))
    await settle()
    expect(splitLines()).toEqual([
      '#wb-split-cr-wc  ¦ ├Materialtyped ¦ 6 ¦ $200.00 ¦  ¦ [833.33] ¦ $5,000.00 ¦ $3,800.00 ¦ 76% ¦ ',
      ' ¦ ├Sales tax8.25% on material ¦ 6 ¦ $16.50 ¦  ¦ $68.75 ¦ $412.50 ¦ $313.50 ¦ 76% ¦ ',
      ' ¦ └Laborwhat is left ¦ 6 ¦ $100.00 ¦  ¦ −$102.08 ¦ −$612.50 ¦ −$1,212.50 ¦  ¦ ',
      "#wb-split-cr-lav  ¦ └Equipmentan item of its own; its cost is on the Labor tab's rentals ¦ 4 ¦ — ¦  ¦ $500.00 ¦ $2,000.00 ¦ — ¦  ¦ ",
      '#wb-split-cr-fd  ¦ └No price on this row yet, so nothing to split.',
    ])
    const labor = [...grid().querySelectorAll('tbody tr')][3] as HTMLElement
    expect([...labor.querySelectorAll('span')].filter((x) => x.style.color === 'var(--text-red-700)').length).toBeGreaterThanOrEqual(2)
    // An equipment line has no box to type in and no tax press.
    const equipment = document.getElementById('wb-split-cr-lav') as HTMLElement
    expect(equipment.querySelector('input')).toBeNull()
    expect(equipment.querySelector('button')).toBeNull()
  })

  it('the Markup and Tax tools open with their scopes and close', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(button(/Markup ›/))
    expect(strip().textContent).toContain('Material markup')
    // Two rows have takeoff material, both on the bid's 50%.
    expect(strip().textContent).toContain("the bid's number is +50% · the rows are at +50%")
    expect(strip().textContent).toContain('Every row with material2')
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

  it("Copy prices on an empty price writes the other price's prices to their rows, and says what it copied", async () => {
    // The open price is the empty Alternate 1. The base price holds $800 on the water closets and $500 on the lavatories.
    db.tables = { bid_count_row_custom_prices: CUSTOM_PRICES as unknown as Array<Record<string, unknown>> }
    const loadBidPricingAssignments = vi.fn(async () => {})
    renderWithProviders(
      <BidsPricingTab
        {...pricedProps({ priceBookVersions: TWO_PRICES, selectedPricingVersionId: 'price-alt', bidCountRowCustomPrices: [], pricingRowsForGrid: gridRows({ scenarioId: 'price-alt', customPrices: [] }), loadBidPricingAssignments })}
      />,
    )
    await settle()
    fireEvent.click(await screen.findByRole('button', { name: 'copy prices from Base price' }))
    await waitFor(() => expect(loadBidPricingAssignments).toHaveBeenCalledWith('bid-1', 'price-alt'))
    expect(db.writes.filter((w) => w.table === 'bid_count_row_custom_prices')).toEqual([
      { table: 'bid_count_row_custom_prices', op: 'insert', payload: { bid_id: 'bid-1', count_row_id: 'cr-wc', price_book_version_id: 'price-alt', unit_price: 800 } },
      { table: 'bid_count_row_custom_prices', op: 'insert', payload: { bid_id: 'bid-1', count_row_id: 'cr-lav', price_book_version_id: 'price-alt', unit_price: 500 } },
    ])
    expect(await screen.findByText('Copied 2 prices from "Base price".')).toBeTruthy()
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
    // The Traditional card is handed the rate the bid is costed at, and no row here is equipment.
    expect(body).toContain('20 h × $50.00 typed rate')
    expect(body).toContain("the Labor tab's rentals · 0 equipment rows")
  })

  it("the Traditional card reads a row's saved kind before its name", async () => {
    // The lavatories are marked equipment; their name alone would say fixture.
    const countRows = (COUNT_ROWS as unknown as Array<Record<string, unknown>>).map((r) => (r.id === 'cr-lav' ? { ...r, kind: 'equipment' } : r)) as unknown as Props['pricingCountRows']
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: countRows, pricingRowsForGrid: gridRows({ countRows }) })} />)
    await settle()
    const body = document.body.textContent ?? ''
    expect(body).toContain("the Labor tab's rentals · 1 equipment row")
    expect(body).toContain('Equipment1 row')
  })

  it("a row's ⓘ opens its margin breakdown", async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(screen.getByLabelText('Margin breakdown for Water closet'))
    await settle()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').textContent).toContain('Water closet')
    // The window's dollars are the row the Workbench derived (`lib/bids/derivePricingWorkbench.ts`, punch list #46
    // row 1). Six at $800. Cost: $1,200 material + $99 tax at 8.25% + 12 h x $50. Pinned before the move, on the tab as it stood.
    const said = screen.getByRole('dialog').textContent ?? ''
    expect(said).toContain('Sale Price$800.00$4,800.00')
    expect(said).toContain('Materials (from Takeoffs)$200.00$1,200.00')
    expect(said).toContain('Tax (8.25%)$16.50$99.00')
    expect(said).toContain('Labor$100.00$600.00')
    expect(said).toContain('Our cost$316.50$1,899.00')
    expect(said).toContain('Profit$483.50$2,901.00')
    expect(said).toContain('60.4%')
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
    // Sent at $6,500 and $6,800 today: the line reads amber.
    expect(screen.getByTestId('pricing-sent-vs-today').style.color).toBe('var(--text-amber-700)')
    fireEvent.click(within(chip).getByRole('button', { name: 'Revise…' }))
    await settle()
    expect(screen.getByTestId('pricing-lock-chip').textContent).toContain('✎')
    expect(within(screen.getByTestId('pricing-lock-chip')).getByRole('button', { name: 'Lock again' })).toBeTruthy()
    expect(window.sessionStorage.length).toBe(1)
  })

  it('a price typed on a sent bid is refused, and the field reads the saved price again at once (punch list #445)', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({}, makeBid({ bid_date_sent: '2026-06-02', bid_value: 6500 }))} />)
    await settle()
    db.writes = []
    const box = () => screen.getByLabelText('Sale price per unit for Water closet') as HTMLInputElement
    fireEvent.focus(box())
    fireEvent.change(box(), { target: { value: '950' } })
    expect(box().value).toBe('950')
    fireEvent.blur(box())
    // The lock refuses the write and says so; the typed number does not stay in the field as if it had saved.
    await waitFor(() => expect(box().value).toBe('$800.00'))
    expect(screen.getByText('This bid was sent Jun 2 — press Revise on the Pricing header to change its prices.')).toBeTruthy()
    expect(db.writes.filter((w) => w.table === 'bid_count_row_custom_prices')).toEqual([])
    // The bar follows the field back: $800 on six water closets and $500 on four lavatories.
    expect(strip().textContent ?? '').toContain('Revenue$6,800.00')
  })

  it('the header chip shows what the quote desk says', async () => {
    smoke.rfqChip = { kind: 'quotes', tone: 'blue', label: 'Quotes (2)' }
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    expect(button('Quotes (2)').id).toBe('pricing-price-requests')
  })

  it('a press on the chip opens the window its state belongs to: the compare for quotes, the desk for requests', async () => {
    smoke.rfqChip = { kind: 'quotes', tone: 'blue', label: 'Quotes (2)' }
    const view = renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(button('Quotes (2)'))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Supply house quotes' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Price requests' })).toBeNull()
    view.unmount()

    smoke.rfqChip = { kind: 'desk', tone: 'amber', label: '2 requests out' }
    renderWithProviders(<BidsPricingTab {...pricedProps()} />)
    await settle()
    fireEvent.click(button('2 requests out'))
    await settle()
    expect(screen.getByRole('dialog', { name: 'Price requests' })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Supply house quotes' })).toBeNull()
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

  // The Percent row: a row priced as a percent of other rows. Two fixtures sell for $6,800.00; the floor drains are the row.
  const KIND_ROWS = COUNT_ROWS.map((r) => ({ ...r, kind: r.id === 'cr-fd' ? 'fitting' : 'fixture' })) as unknown as Props['pricingCountRows']
  const RULE_ROWS = KIND_ROWS.map((r) => (r.id === 'cr-fd' ? { ...r, percent_rule: { pct: 10, basis: 'revenue', source: { kind: 'fixture' } } } : r)) as unknown as Props['pricingCountRows']
  const priceWrites = () => db.writes.filter((w) => w.table === 'bid_count_row_custom_prices')

  it('a row with a percent rule wears its chip, and the Workbench writes the price its rule comes to', async () => {
    const loadBidPricingAssignments = vi.fn(async () => {})
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: RULE_ROWS, loadBidPricingAssignments })} />)
    await settle()
    expect(within(grid()).getByText(moneyText('10% of Fixtures revenue · $6,800.00'))).toBeTruthy()
    // 10% of $6,800.00 is $680.00, over three floor drains.
    await waitFor(() => expect(priceWrites()).toEqual([{ table: 'bid_count_row_custom_prices', op: 'insert', payload: { bid_id: 'bid-1', count_row_id: 'cr-fd', price_book_version_id: PRICING_ID, unit_price: 226.67 } }]))
    await waitFor(() => expect(loadBidPricingAssignments).toHaveBeenCalledWith('bid-1', PRICING_ID))
  })

  it('on a sent bid a rule row keeps the price it went out with: the chip says so and nothing is written', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: RULE_ROWS }, makeBid({ bid_date_sent: '2026-07-01', bid_value: 6800 }))} />)
    await settle()
    expect(within(grid()).getByText('10% of Fixtures revenue · kept as sent')).toBeTruthy()
    expect(priceWrites()).toEqual([])
  })

  it('a price typed over a rule row drops its rule first, then saves the typed price', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: RULE_ROWS })} />)
    await settle()
    await waitFor(() => expect(priceWrites()).toHaveLength(1))
    db.writes = []
    const box = screen.getByLabelText('Sale price per unit for Floor drain')
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: '300' } })
    fireEvent.blur(box)
    await waitFor(() => expect(priceWrites()).toHaveLength(1))
    expect(db.writes.slice(0, 2)).toEqual([
      { table: 'bids_count_rows', op: 'update', payload: { percent_rule: null } },
      { table: 'bid_count_row_custom_prices', op: 'insert', payload: { bid_id: 'bid-1', count_row_id: 'cr-fd', price_book_version_id: PRICING_ID, unit_price: 300 } },
    ])
    await waitFor(() => expect(within(grid()).queryByText(/10% of Fixtures revenue/)).toBeNull())
  })

  it('＋ Percent row opens the window with the new row drawn live, and its press adds the row to the counts', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: KIND_ROWS })} />)
    await settle()
    fireEvent.click(button('＋ Percent row'))
    const win = screen.getByRole('dialog', { name: 'Percent row' })
    // The first time the app suggests no percent of its own.
    expect((within(win).getByRole('button', { name: 'Add Connections' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(win).getByLabelText('Percent'), { target: { value: '10' } })
    fireEvent.change(within(win).getByLabelText('Rows'), { target: { value: 'kind:fixture' } })
    expect(within(win).getByText(moneyText('10% of Fixtures revenue · $6,800.00'))).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Add Connections at $680.00' }))
    await waitFor(() =>
      expect(db.writes.find((w) => w.table === 'bids_count_rows')).toEqual({
        table: 'bids_count_rows',
        op: 'insert',
        payload: { bid_id: 'bid-1', bid_version_id: null, fixture: 'Connections', count: 1, unit: 'ea', sequence_order: 1, kind: 'fitting', percent_rule: { pct: 10, basis: 'revenue', source: { kind: 'fixture' } } },
      }),
    )
  })

  it('while the calculator is unfolded every grid row wears a grip that carries its numbers, and the Kind lines theirs', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: KIND_ROWS })} />)
    await settle()
    expect(document.querySelectorAll('[data-tape-grip]')).toHaveLength(0)
    act(() => setPricingTapeOpen(true))
    const grips = [...grid().querySelectorAll('[data-tape-grip]')]
    expect(grips.map((g) => g.getAttribute('data-tape-grip'))).toEqual(['Water closet', 'Lavatory', 'Floor drain'])
    const carried: Record<string, string> = {}
    fireEvent.dragStart(grips[0]!, { dataTransfer: { setData: (type: string, text: string) => void (carried[type] = text), effectAllowed: 'none' } })
    const line = parseTapeLine(carried[TAPE_DRAG_TYPE])
    expect(line).toMatchObject({ label: 'Water closet', sub: 'a row', sourceKey: null })
    expect(line?.numbers.find((n) => n.key === 'revenue')).toMatchObject({ value: 4800, display: '$4,800.00' })
    // The Kind breakdown's lines carry the group a rule can follow.
    const kinds = [...document.querySelectorAll('[data-tape-grip]')].map((g) => g.getAttribute('data-tape-grip')).filter((n) => n === 'Fixtures' || n === 'Fittings')
    expect(kinds).toEqual(['Fixtures', 'Fittings'])
    act(() => setPricingTapeOpen(false))
    expect(document.querySelectorAll('[data-tape-grip]')).toHaveLength(0)
  })

  it('the calculator’s answer opens the window: Make a new row… on a name box, Put on a row… on the list of rows', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: KIND_ROWS })} />)
    await settle()
    const sink = getPricingTapeSink()
    expect(sink).not.toBeNull()
    act(() => sink!.send({ value: 680, words: 'Fixtures revenue × 0.1 = 680', rule: { pct: 10, basis: 'revenue', sourceKey: 'kind:fixture' } }, 'new-row'))
    let win = screen.getByRole('dialog', { name: 'Percent row' })
    expect(within(win).getByTestId('percent-row-from-tape').textContent).toBe('From the tape: Fixtures revenue × 0.1 = 680')
    expect(within(win).getByText(moneyText('10% of Fixtures revenue · $6,800.00'))).toBeTruthy()
    expect(within(win).getByRole('button', { name: 'Add Connections at $680.00' })).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: 'Cancel' }))
    act(() => sink!.send({ value: 900, words: '900', rule: null }, 'row'))
    win = screen.getByRole('dialog', { name: 'Percent row' })
    expect(within(win).queryByLabelText('Name')).toBeNull()
    fireEvent.change(within(win).getByLabelText('Row'), { target: { value: 'cr-fd' } })
    expect(within(win).getByRole('button', { name: 'Set Floor drain to $900.00' })).toBeTruthy()
  })

  // The three price-book forms (punch list #46 row 1, the third medium cut): the version form, the delete window and
  // the entry form. Pinned on the tab as it stood, before their state and their open and close handlers moved to
  // `usePriceBookForms`. Every name here is made up.
  const BOOKS = [
    { id: 'tpl-1', name: 'ZZ Standard book', bid_id: null, bid_version_id: null, sort_order: 0, source_template_id: null, is_offered: false },
    { id: 'tpl-2', name: 'ZZ Second book', bid_id: null, bid_version_id: null, sort_order: 1, source_template_id: null, is_offered: false },
  ] as unknown as Props['templatePriceBookVersions']
  const BOOK_ENTRIES = [{ id: 'e-wc', version_id: 'tpl-1', fixture_type_id: 'ft-wc', rough_in_price: 100, top_out_price: 50, trim_set_price: 25, total_price: 175, sequence_order: 0, fixture_types: { name: 'Water closet' } }]
  /** Each form on screen: its title, what its boxes hold, and its presses with the dead ones marked. */
  const formsOpen = () =>
    [...document.querySelectorAll('[role="dialog"]')]
      .filter((d) => d.getAttribute('aria-label') !== 'Price book' && d.querySelector('h3'))
      .map((d) => `${d.querySelector('h3')?.textContent ?? ''} ${[...d.querySelectorAll('input')].map((x) => `[${(x as HTMLInputElement).value}]`).join('')} ${[...d.querySelectorAll('button')].map((b) => (b.textContent ?? '') + ((b as HTMLButtonElement).disabled ? '(dead)' : '')).join('|')}`)
  const bookDrawer = () => screen.getByRole('dialog', { name: 'Price book' })
  const formNamed = (title: string) => [...document.querySelectorAll('[role="dialog"]')].find((d) => d.querySelector('h3')?.textContent === title) as HTMLElement
  const stageBoxes = () => [...document.querySelectorAll('[role="dialog"] input[type="number"]')] as HTMLInputElement[]
  async function openBook(over: Partial<Props> = {}) {
    db.tables = { price_book_entries: BOOK_ENTRIES as unknown as Array<Record<string, unknown>> }
    const view = renderWithProviders(<BidsPricingTab {...pricedProps({ templatePriceBookVersions: BOOKS, defaultPriceBookTemplateId: 'tpl-1', ...over })} />)
    await settle()
    fireEvent.click(button(/Base price · 0 entries/))
    await settle()
    db.writes = []
    return view
  }

  it('Add book opens the version form empty, Cancel clears what was typed, and Save writes a new book', async () => {
    await openBook()
    fireEvent.click(within(bookDrawer()).getByTitle('Show all price books'))
    fireEvent.click(within(bookDrawer()).getByText('Add book'))
    expect(formsOpen()).toEqual(['New template [] Cancel|Save'])
    fireEvent.change(screen.getByPlaceholderText('e.g. 2025 Standard'), { target: { value: 'ZZ New book' } })
    expect(formsOpen()).toEqual(['New template [ZZ New book] Cancel|Save'])
    fireEvent.click(screen.getByText('Cancel'))
    expect(formsOpen()).toEqual([])
    // Opened again it is empty: the name typed before is gone.
    fireEvent.click(within(bookDrawer()).getByText('Add book'))
    expect(formsOpen()).toEqual(['New template [] Cancel|Save'])
    fireEvent.change(screen.getByPlaceholderText('e.g. 2025 Standard'), { target: { value: 'ZZ New book' } })
    fireEvent.click(screen.getByText('Save'))
    await settle()
    expect(db.writes).toEqual([{ table: 'price_book_versions', op: 'insert', payload: { name: 'ZZ New book', service_type_id: 'st-1', bid_id: null } }])
    expect(formsOpen()).toEqual([])
  })

  it('the pencil on a book opens the version form on its name, and Save renames it', async () => {
    await openBook()
    fireEvent.click(within(bookDrawer()).getByTitle('Show all price books'))
    fireEvent.click(within(bookDrawer()).getByTitle('Rename this book'))
    expect(formsOpen()).toEqual(['Edit template name [ZZ Standard book] Delete version|Cancel|Save'])
    fireEvent.change(screen.getByPlaceholderText('e.g. 2025 Standard'), { target: { value: 'ZZ Renamed' } })
    fireEvent.click(screen.getByText('Save'))
    await settle()
    expect(db.writes).toEqual([{ table: 'price_book_versions', op: 'update', payload: { name: 'ZZ Renamed' } }])
    expect(formsOpen()).toEqual([])
    // Opened again it starts from the book's name, not from what was typed.
    fireEvent.click(within(bookDrawer()).getByTitle('Rename this book'))
    expect(formsOpen()).toEqual(['Edit template name [ZZ Standard book] Delete version|Cancel|Save'])
  })

  it('Delete version asks for the name: a wrong one is refused in words, Cancel forgets it, and the right one deletes', async () => {
    await openBook()
    fireEvent.click(within(bookDrawer()).getByTitle('Show all price books'))
    fireEvent.click(within(bookDrawer()).getByTitle('Rename this book'))
    fireEvent.click(screen.getByText('Delete version'))
    expect(formsOpen()).toEqual(['Edit template name [ZZ Standard book] Delete version|Cancel|Save', 'Delete price option [] Cancel|Delete(dead)'])
    fireEvent.change(screen.getByPlaceholderText('ZZ Standard book'), { target: { value: 'wrong' } })
    fireEvent.click(within(formNamed('Delete price option')).getByText('Delete'))
    await settle()
    expect(db.writes).toEqual([])
    expect(formNamed('Delete price option').textContent).toContain('Name does not match. Type the scenario name exactly to confirm.')
    // Typing again takes the refusal away.
    fireEvent.change(screen.getByPlaceholderText('ZZ Standard book'), { target: { value: 'wrongx' } })
    expect(formNamed('Delete price option').textContent).not.toContain('Name does not match.')
    fireEvent.click(within(formNamed('Delete price option')).getByText('Cancel'))
    expect(formsOpen()).toEqual(['Edit template name [ZZ Standard book] Delete version|Cancel|Save'])
    // Opened again the box is empty and the press is dead.
    fireEvent.click(screen.getByText('Delete version'))
    expect(formsOpen()[1]).toBe('Delete price option [] Cancel|Delete(dead)')
    fireEvent.change(screen.getByPlaceholderText('ZZ Standard book'), { target: { value: 'ZZ Standard book' } })
    fireEvent.click(within(formNamed('Delete price option')).getByText('Delete'))
    await settle()
    expect(db.writes).toEqual([{ table: 'price_book_versions', op: 'delete' }])
    expect(formNamed('Delete price option')).toBeUndefined()
  })

  it('Add entry in Stage price adds the three stages up as they are typed, and Save writes them to the book being browsed', async () => {
    await openBook()
    fireEvent.click(within(bookDrawer()).getByText('Stage price'))
    fireEvent.click(within(bookDrawer()).getByText('Add entry'))
    expect(formsOpen()).toEqual(['New entry [][][][][] Cancel|Save'])
    fireEvent.change(stageBoxes()[0]!, { target: { value: '100' } })
    fireEvent.change(stageBoxes()[1]!, { target: { value: '40.5' } })
    fireEvent.change(stageBoxes()[2]!, { target: { value: '10' } })
    await settle()
    expect(formsOpen()).toEqual(['New entry [][100][40.5][10][150.50] Cancel|Save'])
    fireEvent.change(screen.getByPlaceholderText('Type or select fixture type...'), { target: { value: 'ZZ Test sink' } })
    fireEvent.click(screen.getByText('Save'))
    await settle()
    expect(db.writes).toEqual([{ table: 'price_book_entries', op: 'insert', payload: { version_id: 'tpl-1', fixture_type_id: 'ft-1', rough_in_price: 100, top_out_price: 40.5, trim_set_price: 10, total_price: 150.5, sequence_order: 1 } }])
    expect(formsOpen()).toEqual([])
    // Opened again every box is empty.
    fireEvent.click(within(bookDrawer()).getByText('Add entry'))
    expect(formsOpen()).toEqual(['New entry [][][][][] Cancel|Save'])
  })

  it('in Combined price a new entry lands in Rough In, and an edited one moves Rough In by the difference', async () => {
    await openBook()
    fireEvent.click(within(bookDrawer()).getByText('Add entry'))
    expect(formsOpen()).toEqual(['New entry [][] Cancel|Save'])
    fireEvent.change(screen.getByPlaceholderText('Type or select fixture type...'), { target: { value: 'ZZ Test sink' } })
    fireEvent.change(stageBoxes()[0]!, { target: { value: '21' } })
    expect(formsOpen()).toEqual(['New entry [ZZ Test sink][21] Cancel|Save'])
    fireEvent.click(screen.getByText('Save'))
    await settle()
    expect(db.writes).toEqual([{ table: 'price_book_entries', op: 'insert', payload: { version_id: 'tpl-1', fixture_type_id: 'ft-1', rough_in_price: 21, top_out_price: 0, trim_set_price: 0, total_price: 21, sequence_order: 1 } }])
    // The pencil on an entry opens the form on that entry's name and price, with Delete.
    fireEvent.click(within(bookDrawer()).getByTitle('Edit'))
    expect(formsOpen()).toEqual(['Edit entry [Water closet][175] Delete|Cancel|Save'])
    // $175 was 100 + 50 + 25. At $200 the other two stages keep theirs and Rough In takes the rest.
    fireEvent.change(stageBoxes()[0]!, { target: { value: '200' } })
    db.writes = []
    fireEvent.click(screen.getByText('Save'))
    await settle()
    expect(db.writes).toEqual([{ table: 'price_book_entries', op: 'update', payload: { fixture_type_id: 'ft-1', rough_in_price: 125, top_out_price: 50, trim_set_price: 25, total_price: 200 } }])
    expect(formsOpen()).toEqual([])
    // Cancel on an edit forgets it: the next Add entry is empty.
    fireEvent.click(within(bookDrawer()).getByTitle('Edit'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(formsOpen()).toEqual([])
    fireEvent.click(within(bookDrawer()).getByText('Add entry'))
    expect(formsOpen()).toEqual(['New entry [][] Cancel|Save'])
  })

  it('the assign search’s Add opens the entry form on the term, closes the search, and saves to the bid’s own price', async () => {
    await openBook()
    fireEvent.click(screen.getAllByTitle("Assign a price-book entry — the book's price fills the row")[0]!)
    await settle()
    fireEvent.change(screen.getByPlaceholderText('Search the book…'), { target: { value: ' ZZ urinal ' } })
    await settle()
    fireEvent.click(screen.getByText(/Add "ZZ urinal" to the book/))
    await settle()
    expect(formsOpen()).toEqual(['New entry [ZZ urinal][] Cancel|Save'])
    expect(screen.queryByPlaceholderText('Search the book…')).toBeNull()
    fireEvent.change(stageBoxes()[0]!, { target: { value: '90' } })
    fireEvent.click(screen.getByText('Save'))
    await settle()
    // The bid's own price, not the book being browsed: this is the set the assign search reads.
    expect(db.writes).toEqual([{ table: 'price_book_entries', op: 'insert', payload: { version_id: 'price-base', fixture_type_id: 'ft-1', rough_in_price: 90, top_out_price: 0, trim_set_price: 0, total_price: 90, sequence_order: 1 } }])
    // The next Add entry from the drawer goes to the book again.
    fireEvent.click(within(bookDrawer()).getByText('Add entry'))
    fireEvent.change(screen.getByPlaceholderText('Type or select fixture type...'), { target: { value: 'ZZ Test sink' } })
    fireEvent.change(stageBoxes()[0]!, { target: { value: '5' } })
    db.writes = []
    fireEvent.click(screen.getByText('Save'))
    await settle()
    expect((db.writes[0]!.payload as { version_id: string }).version_id).toBe('tpl-1')
  })

  it('a change of service type closes all three forms and forgets what they held', async () => {
    const view = await openBook()
    fireEvent.click(within(bookDrawer()).getByTitle('Show all price books'))
    fireEvent.click(within(bookDrawer()).getByTitle('Rename this book'))
    fireEvent.click(screen.getByText('Delete version'))
    fireEvent.change(screen.getByPlaceholderText('ZZ Standard book'), { target: { value: 'ZZ' } })
    fireEvent.click(within(bookDrawer()).getByText('Add entry'))
    fireEvent.change(screen.getByPlaceholderText('Type or select fixture type...'), { target: { value: 'ZZ Test sink' } })
    expect(formsOpen()).toHaveLength(3)
    view.rerender(<BidsPricingTab {...pricedProps({ templatePriceBookVersions: BOOKS, defaultPriceBookTemplateId: 'tpl-1', selectedServiceTypeId: 'st-2' })} />)
    await settle()
    expect(formsOpen()).toEqual([])
  })

  it('a sent bid refuses ＋ Percent row with the lock\'s words', async () => {
    renderWithProviders(<BidsPricingTab {...pricedProps({ pricingCountRows: KIND_ROWS }, makeBid({ bid_date_sent: '2026-07-01', bid_value: 6800 }))} />)
    await settle()
    fireEvent.click(button('＋ Percent row'))
    expect(screen.queryByRole('dialog', { name: 'Percent row' })).toBeNull()
  })
})
