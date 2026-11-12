import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BID_LABOR_VERBS,
  ESTIMATE_BOXES,
  LABOR_KINDS,
  LABOR_ROW_COLS,
  LABOR_UNITS,
  SUB_NOTE,
  TYPED_SOURCE,
  bidLaborAppliedWords,
  bidLaborDryRun,
  bidLaborInput,
  countedFixtures,
  isBidLaborVerb,
  jobScopeCountRows,
  laborCostFromWorld,
  laborCostWords,
  readBidLaborWorld,
  type BidLaborPayload,
  type BidLaborWorld,
  type LaborReads,
  type LaborRow,
  type PlanDirect,
  type PlanLaborRow,
} from '../../../supabase/functions/_shared/devMcpBidLabor'
import type { CountRow } from '../../../supabase/functions/_shared/devMcpBidCounts'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { jobScopeRows } from '../bids/alternateAcceptance'
import { computeBidCostBreakdown } from '../bids/bidTotalCostBreakdown'
import { DIRECT_COST_KINDS, DIRECT_COST_KIND_TABLE } from '../bids/costEstimateDirectCosts'
import { buildCostEstimateAutosavePayload } from '../bids/costEstimateAutosavePayload'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const ENGINE = readFileSync('src/hooks/useBidPricingEngine.ts', 'utf8')
const QUEUE = readFileSync('src/components/bids/BidsLaborNewView.tsx', 'utf8')
const CHECKS = readFileSync('supabase/migrations/20260911161857_labor_rows_kind_unit_source.sql', 'utf8')

// A made-up bid, made-up fixtures and made-up hours: no real name, number or amount.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const EST = 'abababab-1111-4111-8111-111111111111'
const countRow = (id: string, fixture: string, count: number, over: Partial<CountRow> = {}): CountRow => ({ id, fixture, count, unit: 'ea', page: null, group_tag: null, sequence_order: 1, ...over })
const laborRow = (id: string, fixture: string, count: number, hours: [number, number, number], over: Partial<LaborRow> = {}): LaborRow => ({ id, fixture, count, rough_in_hrs_per_unit: hours[0], top_out_hrs_per_unit: hours[1], trim_set_hrs_per_unit: hours[2], is_fixed: false, kind: 'fixture', unit: 'each', source: 'book', source_note: 'Water closet · ZZ Book', sequence_order: 1, ...over })

const world = (over: Partial<BidLaborWorld> = {}): BidLaborWorld => ({
  bid: { id: BID, bid_number: '9001', project_name: 'ZZ TEST seat bid', created_by: DEV, selected_bid_version_id: null, alternate_group_tags: [], accepted_alternate_tags: [], declined_alternate_tags: [], outcome: null, bid_date_sent: null, distance_from_office: '20', bid_value: null },
  versionId: null,
  hasVersion: true,
  countRows: [countRow('c1', 'Water closet', 4), countRow('c2', 'Lavatory', 3), countRow('c3', 'Water closet', 2, { group_tag: 'Level 2' })],
  lines: [],
  estimate: { id: EST, labor_rate: 80, driving_cost_rate: 0.7, hours_per_trip: 2, estimator_cost_per_count: 10, estimator_cost_flat_amount: null, travel_people: 1, travel_nights: 0, travel_meals_rate: null, travel_hotel_rate: null },
  laborRows: [laborRow('l1', 'Water closet', 6, [1.5, 1, 0.5])],
  parked: [],
  direct: [],
  ...over,
})

const p = (labor: Record<string, unknown>): BidLaborPayload => {
  const built = bidLaborInput('plan_bid_labor', { labor: { bid_id: BID, ...labor } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
type Reply = { estimate: { id: string | null; made: boolean; boxes: Array<{ box: string; before: number | null; after: number | null }>; patch: Record<string, unknown> }; rows: PlanLaborRow[]; direct: PlanDirect[]; counts: Record<string, number>; cost: { before: Record<string, string>; after: Record<string, string> }; after_write: string[]; warnings: string[] }
const plan = (labor: Record<string, unknown>, w: Partial<BidLaborWorld> = {}): Reply => {
  const dry = bidLaborDryRun(p(labor), world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as Reply
}
const refusal = (labor: Record<string, unknown>, w: Partial<BidLaborWorld> = {}): string => {
  const dry = bidLaborDryRun(p(labor), world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('devMcpBidLabor — the verbs on the allowlist', () => {
  it('are one write pair with no RPC, and the server and the README name both', () => {
    expect(BID_LABOR_VERBS).toEqual(['plan_bid_labor', 'apply_bid_labor'])
    for (const v of BID_LABOR_VERBS) {
      expect(isBidLaborVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bid_labor')).toBe('plan_bid_labor')
    expect(README).toContain('`plan_bid_labor(labor)` · `apply_bid_labor(labor, plan_hash)`')
    expect(README).toContain("since v2.6976's bid labor")
  })
})

describe('devMcpBidLabor — held to the app’s own', () => {
  it('names only columns the tables have', () => {
    const columnsOf = (table: string): string[] => Object.keys(CATALOG_TABLES[table]?.columns ?? {})
    for (const c of [...LABOR_ROW_COLS.split(','), 'cost_estimate_id']) expect(columnsOf('cost_estimate_labor_rows'), c).toContain(c)
    for (const c of ['id', 'bid_id', ...Object.keys(ESTIMATE_BOXES)]) expect(columnsOf('cost_estimates'), c).toContain(c)
    expect(columnsOf('cost_estimate_labor_rows_unmatched')).toEqual(expect.arrayContaining(['fixture', 'cost_estimate_id']))
    for (const kind of DIRECT_COST_KINDS) expect(columnsOf(DIRECT_COST_KIND_TABLE[kind])).toEqual(expect.arrayContaining(['id', 'cost_estimate_id', 'note', 'rough_in', 'top_out', 'trim_set', 'sequence_order']))
    expect(columnsOf('bids')).toEqual(expect.arrayContaining(['created_by', 'accepted_alternate_tags', 'declined_alternate_tags', 'distance_from_office', 'bid_value']))
  })
  it('mints a row with the columns the Labor tab’s sync inserts, and the kinds, units and source the table allows', () => {
    const insert = ENGINE.slice(ENGINE.indexOf('rough_in_hrs_per_unit: hours.rough_in_hrs') - 120, ENGINE.indexOf("source_note: hasHours ? reading.source_note : null") + 60)
    const sent = [...insert.matchAll(/^\s{10}([a-z_]+):/gm)].map((m) => m[1] ?? '')
    expect(sent).toEqual(['cost_estimate_id', 'fixture', 'count', 'rough_in_hrs_per_unit', 'top_out_hrs_per_unit', 'trim_set_hrs_per_unit', 'sequence_order', 'is_fixed', 'kind', 'unit', 'source', 'source_note'])
    const mint = plan({ rows: [{ fixture: 'Lavatory', rough_in: 1, top_out: 0.75, trim_set: 0.5 }] }).rows[0]
    expect(mint?.status === 'mint' ? Object.keys(mint.row) : []).toEqual(sent)
    expect(CHECKS).toContain(`CHECK (kind IN (${LABOR_KINDS.map((k) => `'${k}'`).join(', ')}))`)
    expect(CHECKS).toContain(`CHECK (unit IN (${LABOR_UNITS.map((u) => `'${u}'`).join(', ')}))`)
    expect(CHECKS).toContain(`'${TYPED_SOURCE}'`)
  })
  it('writes typed hours as the tab’s queue writes them', () => {
    expect(QUEUE).toContain(`source_note: '${SUB_NOTE}'`)
    expect(QUEUE).toContain("kind: 'task', is_fixed: true, unit: 'each', source: 'typed', source_note: `fixed hours${bidWords}`")
    expect(QUEUE).toContain("const bidWords = p.bidLabel ? ` on ${p.bidLabel}` : ''")
    const r = plan({ rows: [{ fixture: 'Water closet', rough_in: 2 }] })
    expect(r.rows[0]).toMatchObject({ status: 'change', patch: { rough_in_hrs_per_unit: 2, source: 'typed', source_note: 'typed on 9001' } })
  })
  it('holds the estimate’s boxes to the autosave’s ranges', () => {
    const base = { laborRateInput: '', drivingCostRate: '', hoursPerTrip: '', estimatorCostUseFlat: false, estimatorCostPerCount: '', estimatorCostFlatAmount: '', travelPeople: '', travelNights: '', travelMealsRate: '', travelHotelRate: '' }
    const cases: Array<[string, string, unknown]> = [['laborRateInput', 'labor_rate', -1], ['hoursPerTrip', 'hours_per_trip', 0], ['travelPeople', 'travel_people', 0], ['travelNights', 'travel_nights', -1], ['travelMealsRate', 'travel_meals_rate', -5]]
    for (const [box, column, bad] of cases) {
      expect(buildCostEstimateAutosavePayload({ ...base, [box]: String(bad) } as Parameters<typeof buildCostEstimateAutosavePayload>[0])).toMatchObject({ ok: false })
      expect(bidLaborInput('plan_bid_labor', { labor: { bid_id: BID, estimate: { [column]: bad } } })).toMatchObject({ ok: false, error: expect.stringContaining(column) })
    }
    expect(bidLaborInput('plan_bid_labor', { labor: { bid_id: BID, estimate: { travel_people: 1.5 } } })).toMatchObject({ ok: false, error: expect.stringContaining('whole number') })
    expect(bidLaborInput('plan_bid_labor', { labor: { bid_id: BID, estimate: { driving_cost_rate: null } } })).toMatchObject({ ok: false, error: expect.stringContaining('cannot be blank') })
    expect(bidLaborInput('plan_bid_labor', { labor: { bid_id: BID, estimate: { overhead: 3 } } })).toMatchObject({ ok: false, error: expect.stringContaining('not a box') })
    expect(p({ estimate: { labor_rate: null, travel_hotel_rate: '125' } }).estimate).toEqual({ labor_rate: null, travel_hotel_rate: 125 })
  })
  it('reads the job’s count rows as the tab does once a bid is won', () => {
    const rows = [countRow('c1', 'Water closet', 4), countRow('c2', 'Water closet', 1, { group_tag: 'Break room' }), countRow('c3', 'Sink', 1, { group_tag: 'Patio' })]
    const won = { outcome: 'won', alternate_group_tags: ['Break room', 'Patio'], accepted_alternate_tags: ['Patio'], declined_alternate_tags: ['Break room', 'Patio'] }
    expect(jobScopeCountRows(rows, won).map((r) => r.id)).toEqual(jobScopeRows(rows, won).map((r) => r.id))
    expect(jobScopeCountRows(rows, won).map((r) => r.id)).toEqual(['c1', 'c3'])
    expect(jobScopeCountRows(rows, { ...won, outcome: null }).map((r) => r.id)).toEqual(['c1', 'c2', 'c3'])
    expect(countedFixtures(rows)).toEqual([{ fixture: 'Water closet', count: 5 }, { fixture: 'Sink', count: 1 }])
  })
  it('states the cost through the tab’s own kernel', () => {
    const labor = [laborRow('l1', 'Water closet', 6, [1.5, 1, 0.5])]
    const estimate = world().estimate!
    const words = laborCostWords({ laborRows: labor, estimate, direct: [{ kind: 'permit', rough_in: 150, top_out: 0, trim_set: 0 }], materials: 1000, distance: '20', countRows: 3 })
    const b = computeBidCostBreakdown({ materialTotalRoughIn: 1000, materialTotalTopOut: 0, materialTotalTrimSet: 0, laborRate: 80, laborRows: labor, distanceFromOffice: '20', costEstimate: estimate, countRowsLength: 3, directCostRows: [{ kind: 'permit', rough_in: 150 }] })
    // 6 × 3 h = 18 h at $80 = $1,440; 9 trips × $0.70 × 20 mi = $126; materials $1,000; a $150 permit.
    expect(b.totalCost).toBe(2716)
    expect(words).toMatchObject({ field_hours: '18 h', labor: '$1,440.00 (18 h × $80.00)', driving: '$126.00 (9 trips × $0.70 a mile × 20 miles)', other_direct: '$150.00', materials: '$1,000.00', direct_cost_of_this_bid: '$2,716.00' })
    expect(laborCostWords({ laborRows: labor, estimate: { ...estimate, labor_rate: null }, direct: [], materials: 0, distance: null, countRows: 3 })).toMatchObject({ labor: expect.stringContaining('company crew rate'), direct_cost_of_this_bid: '$0.00 without labor dollars' })
  })
})

describe('bidLaborInput — the shape', () => {
  it('refuses only the ask’s shape; a faulty row or line is kept for the plan to hold', () => {
    expect(bidLaborInput('plan_bid_labor', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_bid_labor needs labor') })
    expect(bidLaborInput('plan_bid_labor', { labor: { bid_id: BID } })).toMatchObject({ ok: false, error: expect.stringContaining('nothing to do') })
    expect(bidLaborInput('plan_bid_labor', { labor: { bid_id: BID, rows: 'WC 2h' } })).toMatchObject({ ok: false })
    const built = p({ rows: [{ fixture: ' Water closet ', rough_in: '1.5', kind: 'TASK' }, { fixture: '', top_out: -1 }], direct: [{ kind: 'Permit', note: ' City permit ', rough_in: 150 }, { kind: 'rental', note: 'x' }] })
    expect(built.rows).toEqual([{ n: 1, fixture: 'Water closet', rough_in: 1.5, kind: 'task', unit: null }, { n: 2, fixture: '', top_out: -1, kind: null, unit: null }])
    expect(built.direct).toEqual([{ n: 1, kind: 'permit', note: 'City permit', rough_in: 150, remove: false }, { n: 2, kind: 'rental', note: 'x', remove: false }])
    expect(writeRpcBody('apply_bid_labor', { labor: { bid_id: BID, rows: [{ fixture: 'x', rough_in: 1 }] } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('plan_bid_labor', { labor: { bid_id: BID, rows: [{ fixture: 'x', rough_in: 1 }] } })).toMatchObject({ ok: true, rpc: null, step: 'plan', target: BID })
  })
})

describe('readBidLaborWorld — the reads the door sees', () => {
  it('reads the bid, the active version’s counts and lines, the estimate, its rows, the set-aside rows and the five direct cost tables', async () => {
    const asked: string[] = []
    const reads: LaborReads = {
      rows: (table, query) => {
        asked.push(`${table}?${query}`)
        if (table === 'bids') return Promise.resolve([{ ...world().bid }])
        if (table === 'cost_estimates') return Promise.resolve([{ id: EST, labor_rate: '80' }])
        if (table === 'cost_estimate_labor_rows') return Promise.resolve([{ id: 'l1', fixture: 'Water closet', count: '6', rough_in_hrs_per_unit: '1.5', top_out_hrs_per_unit: '1', trim_set_hrs_per_unit: '0.5', is_fixed: false, kind: 'fixture', unit: 'each', source: 'book', source_note: null, sequence_order: '3' }])
        if (table === 'cost_estimate_labor_rows_unmatched') return Promise.resolve([{ fixture: 'Urinal' }])
        if (table === 'cost_estimate_permit_rows') return Promise.resolve([{ id: 'd1', note: 'City permit', rough_in: '150', top_out: '0', trim_set: '0', sequence_order: '1' }])
        return Promise.resolve([])
      },
    }
    const w = await readBidLaborWorld(reads, p({ rows: [{ fixture: 'Water closet', rough_in: 2 }] }))
    expect(asked).toEqual(expect.arrayContaining([
      `bids?select=id,bid_number,project_name,created_by,selected_bid_version_id,alternate_group_tags,accepted_alternate_tags,declined_alternate_tags,outcome,bid_date_sent,distance_from_office,bid_value&id=eq.${BID}`,
      `cost_estimates?select=id,${Object.keys(ESTIMATE_BOXES).join(',')}&bid_id=eq.${BID}&limit=1`,
      `cost_estimate_labor_rows?select=${LABOR_ROW_COLS}&cost_estimate_id=eq.${EST}&order=sequence_order.asc,id.asc&limit=200&offset=0`,
      `cost_estimate_labor_rows_unmatched?select=fixture&cost_estimate_id=eq.${EST}&order=fixture.asc&limit=200&offset=0`,
      `cost_estimate_permit_rows?select=id,note,rough_in,top_out,trim_set,sequence_order&cost_estimate_id=eq.${EST}&order=sequence_order.asc,id.asc&limit=200&offset=0`,
    ]))
    expect(w.laborRows[0]).toMatchObject({ count: 6, rough_in_hrs_per_unit: 1.5, sequence_order: 3 })
    expect(w.parked).toEqual(['Urinal'])
    expect(w.direct).toEqual([{ id: 'd1', kind: 'permit', note: 'City permit', rough_in: 150, top_out: 0, trim_set: 0, sequence_order: 1 }])
  })
})

describe('bidLaborDryRun — hours on the counted fixtures', () => {
  it('changes an existing row, mints a counted fixture with no row as the sync would, and holds a fixture nobody counts', () => {
    const r = plan({ rows: [{ fixture: 'Water closet', rough_in: 2, top_out: 1, trim_set: 0.5 }, { fixture: 'Lavatory', rough_in: 1, top_out: 0.75, trim_set: 0.5 }, { fixture: 'Urinal', rough_in: 1 }] })
    expect(r.rows).toEqual([
      { status: 'change', n: 1, id: 'l1', reads: 'Water closet: 1.5 · 1 · 0.5 h each (rough in · top out · trim set) → 2 · 1 · 0.5 h each (rough in · top out · trim set)', patch: { rough_in_hrs_per_unit: 2, source: 'typed', source_note: 'typed on 9001' } },
      { status: 'mint', n: 2, reads: expect.stringContaining('Lavatory ×3: 1 · 0.75 · 0.5 h each'), row: { cost_estimate_id: EST, fixture: 'Lavatory', count: 3, rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 0.75, trim_set_hrs_per_unit: 0.5, sequence_order: 2, is_fixed: false, kind: 'fixture', unit: 'each', source: 'typed', source_note: 'typed on 9001' } },
      { status: 'held', n: 3, reads: 'Urinal', why: expect.stringContaining('add it with plan_bid_counts first') },
    ])
    expect(r.counts).toMatchObject({ rows_minted: 1, rows_changed: 1, rows_held: 1 })
    // 6 × 3.5 + 3 × 2.25 = 27.75 h at $80.
    expect(r.cost.after).toMatchObject({ field_hours: '27.75 h', labor: '$2,220.00 (27.75 h × $80.00)' })
    expect(r.cost.before).toMatchObject({ field_hours: '18 h' })
  })
  it('a task is fixed hours and a sub line has none', () => {
    const r = plan({ rows: [{ fixture: 'Water closet', kind: 'task', rough_in: 6 }, { fixture: 'Lavatory', kind: 'sub' }] })
    expect(r.rows[0]).toMatchObject({ status: 'change', patch: { rough_in_hrs_per_unit: 6, kind: 'task', is_fixed: true, source_note: 'fixed hours on 9001' } })
    expect(r.rows[1]).toMatchObject({ status: 'mint', row: { kind: 'sub', is_fixed: false, unit: 'each', rough_in_hrs_per_unit: 0, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0, source_note: SUB_NOTE } })
    // A task's 6 h + 0.5 + 1 left on the row = 7.5 h, not times the count.
    expect(r.cost.after.field_hours).toBe('7.5 h')
  })
  it('holds a row in words: no fixture, a fixture named twice, a bad kind or unit, negative hours, no hours at all, set-aside hours', () => {
    expect(refusal({ rows: [{ fixture: '' }, { fixture: 'Lavatory', rough_in: 0 }] })).toContain('give hours above zero in a stage')
    const held = plan({ rows: [{ fixture: '' }, { fixture: 'Water closet', kind: 'labor' }, { fixture: 'water  closet', rough_in: 1 }, { fixture: 'Lavatory', rough_in: -1 }, { fixture: 'Urinal', rough_in: 1 }], estimate: { labor_rate: 90 } }, { countRows: [...world().countRows, countRow('c9', 'Urinal', 2)], parked: ['Urinal'] })
    expect(held.rows.map((x) => (x.status === 'held' ? x.why : x.status))).toEqual([
      'a row names its fixture',
      expect.stringContaining('rows 2 and 3 name the same fixture'),
      expect.stringContaining('rows 2 and 3 name the same fixture'),
      'rough_in is hours, 0 or more',
      expect.stringContaining('set-aside hours wait for this fixture'),
    ])
  })
  it('finds a row by the sync’s loose key when one row answers to it', () => {
    const r = plan({ rows: [{ fixture: '[Level 2] water  closet', top_out: 2 }] })
    expect(r.rows[0]).toMatchObject({ status: 'change', id: 'l1', patch: { top_out_hrs_per_unit: 2 } })
  })
  it('makes the estimate when the bid has none, and refuses a bid with no counts or no creator', () => {
    const r = plan({ rows: [{ fixture: 'Lavatory', rough_in: 1 }], estimate: { labor_rate: 85 } }, { estimate: null, laborRows: [] })
    expect(r.estimate).toMatchObject({ id: null, made: true, boxes: [{ box: 'labor_rate', before: null, after: 85 }] })
    expect(r.rows[0]).toMatchObject({ status: 'mint', row: { cost_estimate_id: null, sequence_order: 1 } })
    expect(r.after_write.join('\n')).toContain('the apply makes it first')
    expect(refusal({ estimate: { labor_rate: 85 } }, { estimate: null, laborRows: [], countRows: [] })).toContain('Add them with plan_bid_counts first')
    expect(refusal({ estimate: { labor_rate: 85 } }, { bid: { ...world().bid!, created_by: null } })).toContain('no creator on record')
    expect(refusal({ estimate: { labor_rate: 85 } }, { bid: null })).toContain('No bid')
    expect(refusal({ estimate: { labor_rate: 85 } }, { hasVersion: false })).toContain('has no version')
  })
})

describe('bidLaborDryRun — the estimate’s boxes and the direct cost lines', () => {
  it('shows each box before → after and drops one that already reads that way', () => {
    const r = plan({ estimate: { labor_rate: 95, hours_per_trip: 2, travel_nights: 2, travel_hotel_rate: 120 } })
    expect(r.estimate.boxes).toEqual([{ box: 'labor_rate', before: 80, after: 95 }, { box: 'travel_nights', before: 0, after: 2 }, { box: 'travel_hotel_rate', before: null, after: 120 }])
    expect(r.estimate.patch).toEqual({ labor_rate: 95, travel_nights: 2, travel_hotel_rate: 120 })
    expect(r.cost.after.travel).toBe('$240.00')
    expect(refusal({ estimate: { labor_rate: 80 } })).toContain('Everything already reads that way')
    expect(plan({ estimate: { labor_rate: null } }).warnings.join('\n')).toContain('no labor rate')
  })
  it('adds, changes and removes a line by its kind and what it is, and holds the rest in words', () => {
    const direct = [{ id: 'd1', kind: 'permit' as const, note: 'City permit', rough_in: 150, top_out: 0, trim_set: 0, sequence_order: 1 }]
    const r = plan({ direct: [{ kind: 'permit', note: 'city permit', rough_in: 175 }, { kind: 'equipment', note: 'Lift rental', top_out: 300 }, { kind: 'permit', note: 'City permit', remove: true }, { kind: 'rental', note: 'x', rough_in: 1 }, { kind: 'waste', note: '' }, { kind: 'other', note: 'Dumpster', rough_in: -1 }] }, { direct })
    expect(r.direct.map((d) => d.status)).toEqual(['held', 'add', 'held', 'held', 'held', 'held'])
    expect(r.direct[0]).toMatchObject({ why: expect.stringContaining('lines 1 and 3 are the same line') })
    expect(r.direct[1]).toMatchObject({ table: 'cost_estimate_equipment_rows', row: { cost_estimate_id: EST, note: 'Lift rental', rough_in: 0, top_out: 300, trim_set: 0, sequence_order: 1 } })
    expect(r.direct.slice(3).map((d) => (d.status === 'held' ? d.why : ''))).toEqual([expect.stringContaining('kind is equipment'), expect.stringContaining('says what it is'), 'rough_in is dollars, 0 or more'])
    expect(plan({ direct: [{ kind: 'permit', note: 'City permit', rough_in: 175 }] }, { direct }).direct[0]).toMatchObject({ status: 'change', table: 'cost_estimate_permit_rows', id: 'd1', patch: { rough_in: 175 } })
    expect(plan({ direct: [{ kind: 'permit', note: 'City permit', remove: true }] }, { direct }).direct[0]).toMatchObject({ status: 'remove', id: 'd1' })
  })
  it('commits the hash to the rows as they stood', async () => {
    const payload = p({ rows: [{ fixture: 'Water closet', rough_in: 2 }] })
    const a = bidLaborDryRun(payload, world())
    const b = bidLaborDryRun(payload, world())
    const moved = bidLaborDryRun(payload, world({ laborRows: [laborRow('l1', 'Water closet', 6, [1.75, 1, 0.5])] }))
    if (!a.ok || !b.ok || !moved.ok) throw new Error('expected plans')
    const hash = await planHash('plan_bid_labor', payload, a.reply)
    expect(await planHash('apply_bid_labor', payload, b.reply)).toBe(hash)
    expect(await planHash('plan_bid_labor', payload, moved.reply)).not.toBe(hash)
  })
})

describe('the apply’s words and the server’s writes', () => {
  it('say what landed and name what failed', () => {
    expect(bidLaborAppliedWords('b9001 ZZ TEST seat bid', { estimate_made: true, boxes: 2, rows_minted: 1, rows_changed: 1, direct_added: 1, direct_changed: 0, direct_removed: 0 }, [], 1, null)).toMatchObject({ landed: 'the estimate made, 2 boxes set, 1 labor row made, 1 changed, 1 direct cost line added', next: expect.stringContaining('reads as planned') })
    expect(bidLaborAppliedWords('b9001', { estimate_made: false, boxes: 0, rows_minted: 0, rows_changed: 0, direct_added: 0, direct_changed: 0, direct_removed: 0 }, [{ what: 'x', why: '403' }], 0, null).next).toContain('1 did not')
    expect(alreadyApplied('apply_bid_labor', { target: BID, at: null })).toContain('already applied on this bid')
    expect(laborCostFromWorld(world())).toMatchObject({ field_hours: '18 h', labor: '$1,440.00 (18 h × $80.00)' })
    expect(laborCostFromWorld(world({ bid: null }))).toBeNull()
  })
  it('writes each kind of row its own way', () => {
    expect(SERVER).toContain("restRows(session, 'POST', 'cost_estimates', 'select=id', { bid_id: p.bid_id })")
    expect(SERVER).toContain("restRows(session, 'PATCH', 'cost_estimates', `id=eq.${estimateId}&select=id`, est.patch, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'POST', 'cost_estimate_labor_rows', 'select=id', mints.map((m) => ({ ...m.row, cost_estimate_id: estimateId })))")
    expect(SERVER).toContain("restRows(session, 'PATCH', 'cost_estimate_labor_rows', `id=eq.${r.id}&select=id`, r.patch, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'POST', d.table, 'select=id', { ...d.row, cost_estimate_id: estimateId })")
    expect(SERVER).toContain("restRows(session, 'PATCH', d.table, `id=eq.${d.id}&select=id`, d.patch, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'DELETE', d.table, `id=eq.${d.id}&select=id`, null, 'return=representation')")
  })
})
