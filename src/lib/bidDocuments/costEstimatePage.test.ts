import { beforeEach, describe, expect, it, vi } from 'vitest'

// The HTML builders and the print side-effect are already tested / pure IO; they are replaced
// by recorders so this file can pin what the page builder HANDS them — the cost math, the
// materials model, the PO sections — and the Supabase chains it runs to get there.
type Step = { method: string; args: unknown[] }
type Call = { table: string; steps: Step[] }
const calls: Call[] = []
let handler: (c: Call) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
function builder(table: string): unknown {
  const steps: Step[] = []
  const p: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => {
            const call = { table, steps }
            calls.push(call)
            resolve(handler(call))
          }
        }
        return (...args: unknown[]) => {
          steps.push({ method: String(prop), args })
          return p
        }
      },
    },
  )
  return p
}
vi.mock('../supabase', () => ({ supabase: { from: (table: string) => builder(table) } }))
const printHtml = vi.fn((_html: string) => undefined)
vi.mock('./htmlDoc', () => ({ printHtmlInNewWindow: (html: string) => printHtml(html) }))
const buildRough = vi.fn((_a: unknown) => '<rough/>')
const buildExact = vi.fn((_a: unknown) => '<exact/>')
vi.mock('./laborPage', () => ({ buildRoughLaborPageHtml: (a: unknown) => buildRough(a), buildExactLaborPageHtml: (a: unknown) => buildExact(a) }))
const buildSub = vi.fn((_a: unknown) => '<sub/>')
const buildAllSubs = vi.fn((_a: unknown) => '<subs/>')
vi.mock('./laborSubSheet', () => ({ buildLaborSubSheetHtml: (a: unknown) => buildSub(a), buildAllLaborSubSheetsHtml: (a: unknown) => buildAllSubs(a) }))
const buildPo = vi.fn((_a: unknown) => '<po/>')
vi.mock('./costEstimatePO', () => ({ buildCostEstimatePOHtml: (a: unknown) => buildPo(a) }))

import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidCountRow } from '../../types/bids'
import type { CostEstimate, CostEstimateLaborRow } from '../bids/bidPricingEngineTypes'
import { sumRoughLinesPreTaxWithCount } from '../bids/bidTakeoffHelpers'
import {
  printAllSubSheets,
  printCostEstimatePOForReview,
  printCostEstimatePOForSupplyHouse,
  printCostEstimatePage,
  printRoughInSubSheet,
  printTopOutSubSheet,
  printTrimSetSubSheet,
  type CostEstimatePrintContext,
} from './costEstimatePage'

const bid = (over: Partial<BidWithBuilder> = {}): BidWithBuilder =>
  ({ id: 'bid-1', project_name: 'Hyper Kidz', materials_model: 'rough', distance_from_office: '40', ...over }) as unknown as BidWithBuilder
const laborRow = (fixture: string, count: number, rough: number, top: number, trim: number, is_fixed = false): CostEstimateLaborRow =>
  ({ fixture, count, rough_in_hrs_per_unit: rough, top_out_hrs_per_unit: top, trim_set_hrs_per_unit: trim, is_fixed }) as unknown as CostEstimateLaborRow
const countRow = (id: string, fixture: string, count: number): BidCountRow => ({ id, fixture, count }) as unknown as BidCountRow
const LABOR = [laborRow('Toilet', 4, 1, 0.5, 0.5), laborRow('Trip charge', 1, 2, 0, 0, true)] // 4×2 + 2 = 10 h
const COUNTS = [countRow('cr1', 'Toilet', 4), countRow('cr2', 'Sink', 2)]
const CE = { purchase_order_id_rough_in: 'po-r', purchase_order_id_top_out: 'po-t', purchase_order_id_trim_set: null, estimator_cost_flat_amount: null, estimator_cost_per_count: 15, travel_people: 2, travel_nights: 1, travel_meals_rate: 50, travel_hotel_rate: 100 } as unknown as CostEstimate

function ctx(over: Partial<CostEstimatePrintContext> = {}): CostEstimatePrintContext {
  return {
    bid: bid(),
    bidVersionId: null,
    costEstimate: CE,
    laborRows: LABOR,
    countRows: COUNTS,
    purchaseOrders: [{ id: 'po-r', name: 'Rough PO #12', stage: 'rough_in' }, { id: 'po-t', name: 'Top PO #13', stage: 'top_out' }],
    materialTotalRoughIn: null,
    materialTotalTopOut: null,
    materialTotalTrimSet: null,
    laborRateInput: '85',
    drivingCostRate: '',
    hoursPerTrip: '',
    taxPercent: 8.25,
    ...over,
  }
}
// Shared cost expectations for the fixtures above: 10 h × $85; 40 mi at the $0.70 default,
// 2 h/trip default → 5 trips → $140 driving; estimator 2 count rows × $15; travel 2 × 1 × ($50 + $100).
const EXPECTED_COSTS = { totalHours: 10, rate: 85, laborCost: 850, distance: 40, ratePerMile: 0.7, numTrips: 5, drivingCost: 140, estimatorCost: 30, travelCost: 300, laborCostWithDriving: 1290, otherDirectCost: 0, taxPercent: 8.25 }
const ROUGH_LINES = [
  { count_row_id: 'cr2', quantity: 1, unit_price: 20, part_id: 'p2', source_template_id: null, sequence_order: 1 },
  { count_row_id: 'cr1', quantity: 2, unit_price: 10, part_id: 'p1', source_template_id: null, sequence_order: 2 },
  { count_row_id: 'cr1', quantity: 1, unit_price: 5, part_id: null, source_template_id: 't1', sequence_order: 1 },
]
const table = (name: string) => calls.filter((c) => c.table === name)
const stepArgs = (c: Call, m: string) => c.steps.find((s) => s.method === m)?.args

beforeEach(() => {
  calls.length = 0
  printHtml.mockClear(); buildRough.mockClear(); buildExact.mockClear(); buildSub.mockClear(); buildAllSubs.mockClear(); buildPo.mockClear()
  handler = (c) => {
    if (c.table === 'bids_takeoff_rough_part_lines') return { data: ROUGH_LINES, error: null }
    if (c.table === 'material_parts') return { data: [{ id: 'p1', name: 'Wax ring' }, { id: 'p2', name: 'P-trap' }], error: null }
    if (c.table === 'material_templates') return { data: [{ id: 't1', name: 'WC rough-in' }], error: null }
    if (c.table === 'purchase_order_items') {
      const po = stepArgs(c, 'eq')?.[1]
      if (po === 'po-r') return { data: [{ quantity: 3, price_at_time: 12.5, material_parts: { name: 'Closet flange' }, source_template: null }, { quantity: 1, price_at_time: 40, material_parts: null, source_template: { id: 't1', name: 'WC rough-in' } }], error: null }
      if (po === 'po-t') return { data: [], error: null }
    }
    return { data: [], error: null }
  }
})

describe('printCostEstimatePage — rough materials model', () => {
  it('reads the version\'s rough lines, resolves part and bundle names, groups materials per count row, and prints the rough page with the full cost math', async () => {
    await printCostEstimatePage(ctx())
    expect(printHtml).toHaveBeenCalledWith('<rough/>')
    expect(buildExact).not.toHaveBeenCalled()

    const [linesCall] = table('bids_takeoff_rough_part_lines')
    expect(stepArgs(linesCall!, 'eq')).toEqual(['bid_id', 'bid-1'])
    expect(stepArgs(linesCall!, 'is')).toEqual(['bid_version_id', null]) // unsplit Base
    expect(stepArgs(table('material_parts')[0]!, 'in')).toEqual(['id', ['p1', 'p2']]) // in sorted-line order, deduped
    expect(stepArgs(table('material_templates')[0]!, 'in')).toEqual(['id', ['t1']])

    const input = buildRough.mock.calls[0]![0] as Record<string, unknown>
    expect(input.title).toBe('Hyper Kidz — Labor')
    expect(input.rows).toEqual([
      { fixture: 'Toilet', count: 4, roughPerUnit: 1, topPerUnit: 0.5, trimPerUnit: 0.5, totalHrs: 8 },
      { fixture: 'Trip charge', count: 1, roughPerUnit: 2, topPerUnit: 0, trimPerUnit: 0, totalHrs: 2 },
    ])
    expect(input.totals).toEqual({ rough: 6, top: 2, trim: 2 })
    // lines sorted by count row then sequence: the bundle (seq 1) before the part (seq 2) on cr1
    expect(input.materials).toEqual([
      { fixture: 'Toilet', count: 4, lines: [{ partName: 'WC rough-in (bundle)', unitPrice: 5, quantity: 1 }, { partName: 'Wax ring', unitPrice: 10, quantity: 2 }] },
      { fixture: 'Sink', count: 2, lines: [{ partName: 'P-trap', unitPrice: 20, quantity: 1 }] },
    ])
    const totalMaterials = sumRoughLinesPreTaxWithCount(ROUGH_LINES, new Map([['cr1', 4], ['cr2', 2]]))
    expect(input.costs).toEqual({ ...EXPECTED_COSTS, totalMaterials, grandTotal: totalMaterials + 1290 })
  })

  it('filters by the active version when one is set, and prefers a supplied rough-in total over the line sum', async () => {
    await printCostEstimatePage(ctx({ bidVersionId: 'v-2', materialTotalRoughIn: 999 }))
    const [linesCall] = table('bids_takeoff_rough_part_lines')
    expect(linesCall!.steps.filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([['bid_id', 'bid-1'], ['bid_version_id', 'v-2']])
    expect(linesCall!.steps.some((s) => s.method === 'is')).toBe(false)
    const input = buildRough.mock.calls[0]![0] as { costs: { totalMaterials: number; grandTotal: number } }
    expect(input.costs.totalMaterials).toBe(999)
    expect(input.costs.grandTotal).toBe(999 + 1290)
  })

  it('an unknown part shows its id prefix, a bundle with no template shows "Assembly (bundle)", and no parts means no parts query', async () => {
    handler = (c) => {
      if (c.table === 'bids_takeoff_rough_part_lines') return { data: [{ count_row_id: 'cr1', quantity: 1, unit_price: 1, part_id: 'p-unknown-0123', source_template_id: null, sequence_order: 1 }, { count_row_id: 'cr1', quantity: 1, unit_price: 1, part_id: null, source_template_id: 't-missing', sequence_order: 2 }], error: null }
      return { data: [], error: null }
    }
    await printCostEstimatePage(ctx())
    const input = buildRough.mock.calls[0]![0] as { materials: Array<{ lines: Array<{ partName: string }> }> }
    expect(input.materials[0]!.lines.map((l) => l.partName)).toEqual(['p-unknow', 'Assembly (bundle)'])

    calls.length = 0
    handler = (c) => (c.table === 'bids_takeoff_rough_part_lines' ? { data: [{ count_row_id: 'cr1', quantity: 1, unit_price: 1, part_id: null, source_template_id: null, sequence_order: 1 }], error: null } : { data: [], error: null })
    await printCostEstimatePage(ctx())
    expect(table('material_parts')).toHaveLength(0)
    expect(table('material_templates')).toHaveLength(0)
  })

  it('an empty labor list gives no totals, a nameless bid is "Bid", and a blank rate is zero', async () => {
    handler = () => ({ data: [], error: null })
    await printCostEstimatePage(ctx({ laborRows: [], laborRateInput: '', bid: bid({ project_name: '' }) }))
    const input = buildRough.mock.calls[0]![0] as { title: string; totals: unknown; costs: { rate: number; totalHours: number; laborCost: number; numTrips: number } }
    expect(input.title).toBe('Bid — Labor')
    expect(input.totals).toBeNull()
    expect(input.costs).toMatchObject({ rate: 0, totalHours: 0, laborCost: 0, numTrips: 0 })
  })

  it('rate, mileage rate and hours-per-trip parse loosely with the documented defaults', async () => {
    handler = () => ({ data: [], error: null })
    await printCostEstimatePage(ctx({ laborRateInput: 'abc', drivingCostRate: '1.25', hoursPerTrip: '4' }))
    const costs = (buildRough.mock.calls[0]![0] as { costs: Record<string, number> }).costs
    // 10 h / 4 h per trip = 2.5 trips × $1.25 × 40 mi
    expect(costs).toMatchObject({ rate: 0, laborCost: 0, ratePerMile: 1.25, numTrips: 2.5, drivingCost: 125 })
    await printCostEstimatePage(ctx({ bid: bid({ distance_from_office: undefined }) }))
    expect((buildRough.mock.calls[1]![0] as { costs: Record<string, number> }).costs).toMatchObject({ distance: 0, drivingCost: 0 })
  })
})

describe('printCostEstimatePage — exact materials model', () => {
  it('loads each stage PO\'s items in sequence order, names the POs, sums the stage totals, and prints the exact page', async () => {
    await printCostEstimatePage(ctx({ bid: bid({ materials_model: 'exact' }), materialTotalRoughIn: 1000, materialTotalTopOut: 250.5, materialTotalTrimSet: null }))
    expect(printHtml).toHaveBeenCalledWith('<exact/>')
    expect(buildRough).not.toHaveBeenCalled()
    expect(table('bids_takeoff_rough_part_lines')).toHaveLength(0)

    const poCalls = table('purchase_order_items')
    expect(poCalls.map((c) => stepArgs(c, 'eq')?.[1])).toEqual(['po-r', 'po-t']) // trim has no PO → no query
    expect(stepArgs(poCalls[0]!, 'order')).toEqual(['sequence_order', { ascending: true }])

    const input = buildExact.mock.calls[0]![0] as Record<string, unknown>
    expect(input.title).toBe('Hyper Kidz — Labor')
    expect(input.pos).toEqual([
      { stageLabel: 'Rough In', poName: 'Rough PO #12', stageMaterialTotal: 1000, items: [{ part_name: 'Closet flange', quantity: 3, price_at_time: 12.5, template_name: null }, { part_name: '—', quantity: 1, price_at_time: 40, template_name: 'WC rough-in' }] },
      { stageLabel: 'Top Out', poName: 'Top PO #13', stageMaterialTotal: 250.5, items: [] },
      { stageLabel: 'Trim Set', poName: '—', stageMaterialTotal: 0, items: [] },
    ])
    expect(input.costs).toEqual({ ...EXPECTED_COSTS, totalMaterials: 1250.5, grandTotal: 1250.5 + 1290 })
  })

  it('a PO read that errors contributes no items and nothing else breaks', async () => {
    handler = (c) => (c.table === 'purchase_order_items' ? { data: null, error: { message: 'boom' } } : { data: [], error: null })
    await printCostEstimatePage(ctx({ bid: bid({ materials_model: 'exact' }) }))
    const input = buildExact.mock.calls[0]![0] as { pos: Array<{ items: unknown[] }> }
    expect(input.pos.map((p) => p.items)).toEqual([[], [], []])
  })

  it('anything but "rough" is the exact model, including unset', async () => {
    await printCostEstimatePage(ctx({ bid: bid({ materials_model: undefined }), costEstimate: null }))
    expect(buildExact).toHaveBeenCalledTimes(1)
    const input = buildExact.mock.calls[0]![0] as { pos: Array<{ poName: string }>; costs: { estimatorCost: number; travelCost: number } }
    expect(input.pos.map((p) => p.poName)).toEqual(['—', '—', '—'])
    expect(input.costs).toMatchObject({ estimatorCost: 20, travelCost: 0 }) // no estimate: 2 rows × $10 default, no travel
  })
})

describe('sub sheets and PO prints', () => {
  it('each sub sheet passes its stage, the bid name and the parsed rate', () => {
    printRoughInSubSheet(ctx({ laborRateInput: ' 72.5 ' }))
    printTopOutSubSheet(ctx({ laborRateInput: '' }))
    printTrimSetSubSheet(ctx({ laborRateInput: 'x' }))
    expect(buildSub.mock.calls.map((c) => c[0])).toEqual([
      { bidName: 'Hyper Kidz', stageLabel: 'Rough In', stage: 'rough_in', rows: LABOR, rate: 72.5 },
      { bidName: 'Hyper Kidz', stageLabel: 'Top Out', stage: 'top_out', rows: LABOR, rate: 0 },
      { bidName: 'Hyper Kidz', stageLabel: 'Trim Set', stage: 'trim_set', rows: LABOR, rate: 0 },
    ])
    expect(printHtml).toHaveBeenCalledTimes(3)
    printAllSubSheets(ctx({ laborRateInput: '85' }))
    expect(buildAllSubs).toHaveBeenCalledWith({ bidName: 'Hyper Kidz', rows: LABOR, rate: 85 })
    expect(printHtml).toHaveBeenLastCalledWith('<subs/>')
  })
  it('the PO print helpers pick the variant', () => {
    const items = [{ part_name: 'Flange', quantity: 2, price_at_time: 9, template_name: null }]
    printCostEstimatePOForReview('PO #12', items, 8.25)
    printCostEstimatePOForSupplyHouse('PO #12', items, 8.25)
    expect(buildPo.mock.calls.map((c) => (c[0] as { variant: string }).variant)).toEqual(['review', 'supplyHouse'])
    expect(buildPo.mock.calls[0]![0]).toEqual({ variant: 'review', poName: 'PO #12', items, taxPercent: 8.25 })
    expect(printHtml).toHaveBeenCalledTimes(2)
  })
})
