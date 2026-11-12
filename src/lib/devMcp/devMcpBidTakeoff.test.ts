import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BID_TAKEOFF_VERBS,
  CUSTOM_COST_SOURCE,
  LINE_COLS,
  TAKEOFF_MAX_ROWS,
  bidTakeoffAppliedWords,
  bidTakeoffDryRun,
  bidTakeoffInput,
  isBidTakeoffVerb,
  materialsTotal,
  readBidTakeoffWorld,
  type BidTakeoffPayload,
  type BidTakeoffWorld,
  type PartRow,
  type PlanTakeoffRow,
  type TakeoffLine,
  type TakeoffReads,
} from '../../../supabase/functions/_shared/devMcpBidTakeoff'
import type { CountRow } from '../../../supabase/functions/_shared/devMcpBidCounts'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'
import { combinedMaterials } from '../bids/bidMaterials'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const HOOK = readFileSync('src/hooks/useTakeoffRoughLines.ts', 'utf8')
const APPLY_PICKS = readFileSync('src/components/bids/ApplyPicksToCostsModal.tsx', 'utf8')
const COST_MIGRATION = readFileSync('supabase/migrations/20260902181208_apply_picks_to_costs.sql', 'utf8')

// A made-up bid, made-up parts and made-up prices: no real name, number or amount.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const TRADE = 'bbbbbbbb-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const PIPE = 'aaaaaaaa-0001-4111-8111-111111111111'
const VALVE = 'aaaaaaaa-0002-4111-8111-111111111111'
const ELBOW = 'aaaaaaaa-0003-4111-8111-111111111111'
const WC = 'cccccccc-0001-4111-8111-111111111111'
const LAV = 'cccccccc-0002-4111-8111-111111111111'

const part = (id: string, name: string, over: Partial<PartRow> = {}): PartRow => ({ id, name, manufacturer: null, service_type_id: TRADE, order_increment: null, order_increment_unit: null, part_types: null, ...over })
const countRow = (id: string, fixture: string, count: number, over: Partial<CountRow> = {}): CountRow => ({ id, fixture, count, unit: 'ea', page: null, group_tag: null, sequence_order: 1, ...over })
const line = (id: string, rowId: string, partId: string, quantity: number, unitPrice: number, over: Partial<TakeoffLine> = {}): TakeoffLine => ({ id, count_row_id: rowId, part_id: partId, quantity, unit_price: unitPrice, sequence_order: 1, source_material_part_price_id: null, source_template_id: null, order_increment: null, order_increment_unit: null, ...over })

const world = (over: Partial<BidTakeoffWorld> = {}): BidTakeoffWorld => ({
  me: { userId: DEV },
  bid: { id: BID, bid_number: '9001', project_name: 'ZZ TEST seat bid', service_type_id: TRADE, selected_bid_version_id: null, alternate_group_tags: [], bid_date_sent: null },
  versions: [],
  versionId: null,
  countRows: [countRow(WC, 'Water closet', 4), countRow(LAV, 'Lavatory', 3)],
  lines: [],
  parts: [part(PIPE, 'ZZ 2 in pipe', { part_types: { order_increment: 20, order_increment_unit: 'ft_stick' } }), part(VALVE, 'ZZ stop valve', { manufacturer: 'ZZ Brass' }), part(ELBOW, 'ZZ elbow')],
  lowest: { [PIPE]: { priceId: 'price-pipe', price: 2.5 }, [VALVE]: { priceId: 'price-valve', price: 12 } },
  customCosts: [],
  ...over,
})

const p = (takeoff: Record<string, unknown>): BidTakeoffPayload => {
  const built = bidTakeoffInput('plan_bid_takeoff', { takeoff: { bid_id: BID, ...takeoff } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
type Reply = { rows: PlanTakeoffRow[]; counts: Record<string, number>; materials: { before: string; after: string; words: string }; warnings: string[]; not_done: string[] }
const plan = (takeoff: Record<string, unknown>, w: Partial<BidTakeoffWorld> = {}): Reply => {
  const dry = bidTakeoffDryRun(p(takeoff), world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as Reply
}
const refusal = (takeoff: Record<string, unknown>, w: Partial<BidTakeoffWorld> = {}): string => {
  const dry = bidTakeoffDryRun(p(takeoff), world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('devMcpBidTakeoff — the verbs on the allowlist', () => {
  it('are one write pair with no RPC, and the server and the README name both', () => {
    expect(BID_TAKEOFF_VERBS).toEqual(['plan_bid_takeoff', 'apply_bid_takeoff'])
    for (const v of BID_TAKEOFF_VERBS) {
      expect(isBidTakeoffVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bid_takeoff')).toBe('plan_bid_takeoff')
    expect(README).toContain('`plan_bid_takeoff(takeoff)` · `apply_bid_takeoff(takeoff, plan_hash)`')
    expect(README).toContain("since v2.6968's bid takeoff")
  })
})

describe('devMcpBidTakeoff — held to the app’s own', () => {
  it('names only columns the tables have', () => {
    const columnsOf = (table: string): string[] => Object.keys(CATALOG_TABLES[table]?.columns ?? {})
    for (const c of [...LINE_COLS.split(','), 'bid_id', 'bid_version_id']) expect(columnsOf('bids_takeoff_rough_part_lines'), c).toContain(c)
    expect(columnsOf('material_parts')).toEqual(expect.arrayContaining(['id', 'name', 'manufacturer', 'service_type_id', 'order_increment', 'order_increment_unit', 'part_type_id']))
    expect(columnsOf('part_types')).toEqual(expect.arrayContaining(['order_increment', 'order_increment_unit']))
    expect(columnsOf('material_part_prices')).toEqual(expect.arrayContaining(['id', 'part_id', 'price']))
    expect(columnsOf('bid_count_row_custom_costs')).toEqual(expect.arrayContaining(['id', 'bid_id', 'count_row_id', 'unit_materials_cents', 'source', 'quote_line_id', 'lot_group_id', 'house_name', 'applied_by']))
    expect(columnsOf('bids')).toEqual(expect.arrayContaining(['service_type_id', 'selected_bid_version_id', 'alternate_group_tags', 'bid_date_sent']))
  })
  it('writes a new line with the columns the tab’s own insert sends', () => {
    const insert = HOOK.slice(HOOK.indexOf(".from('bids_takeoff_rough_part_lines')\n        .insert({"), HOOK.indexOf(".select('id')\n        .single()"))
    const sent = [...insert.matchAll(/^\s{10}([a-z_]+):/gm)].map((m) => m[1] ?? '')
    expect(sent).toEqual(['bid_id', 'bid_version_id', 'count_row_id', 'part_id', 'quantity', 'unit_price', 'sequence_order', 'source_material_part_price_id', 'source_template_id', 'order_increment', 'order_increment_unit'])
    const add = plan({ rows: [{ fixture: 'Water closet', lines: [{ part_id: VALVE, quantity: 2 }] }] }).rows[0]?.lines[0]
    expect(add?.status === 'add' ? Object.keys(add.row) : []).toEqual(sent)
  })
  it('writes a quoted cost as the Apply window writes it, with the one source the table allows', () => {
    expect(COST_MIGRATION).toContain(`CHECK (source = ANY (ARRAY['${CUSTOM_COST_SOURCE}'`)
    expect(APPLY_PICKS).toContain("source: 'quoted'")
    expect(APPLY_PICKS).toContain("onConflict: 'bid_id,count_row_id'")
    expect(SERVER).toContain("'on_conflict=bid_id,count_row_id&select=id'")
    const cost = plan({ rows: [{ fixture: 'Lavatory', materials_each: 184.5, materials_from: 'ZZ Supply' }] }).rows[0]?.cost
    expect(cost).toEqual({ status: 'set', reads: '$184.50 each quoted by ZZ Supply', row: { bid_id: BID, count_row_id: LAV, unit_materials_cents: 18450, source: 'quoted', quote_line_id: null, lot_group_id: null, house_name: 'ZZ Supply', applied_by: DEV } })
  })
  it('totals the materials through the tab’s own kernel', () => {
    const lines = [line('l1', WC, PIPE, 6, 2.5, { order_increment: 20, order_increment_unit: 'ft_stick' }), line('l2', LAV, VALVE, 2, 12)]
    const rows = [countRow(WC, 'Water closet', 4), countRow(LAV, 'Lavatory', 3)]
    const mine = materialsTotal(lines, rows)
    const app = combinedMaterials(lines, new Map(rows.map((r) => [r.id, r.count])))
    expect(mine.total).toBe(app.total)
    // 6 ft × 4 = 24 ft, bought as 40 ft of 20 ft sticks: 40 × 2.50 = 100; plus 2 × 12 × 3 = 72.
    expect(mine.total).toBe(172)
  })
})

describe('bidTakeoffInput — the shape', () => {
  it('keeps a faulty row or line for the plan to hold, and refuses only the ask’s shape', () => {
    expect(bidTakeoffInput('plan_bid_takeoff', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_bid_takeoff needs takeoff') })
    expect(bidTakeoffInput('plan_bid_takeoff', { takeoff: { bid_id: BID, rows: [] } })).toMatchObject({ ok: false })
    expect(bidTakeoffInput('plan_bid_takeoff', { takeoff: { bid_id: BID, rows: [{ fixture: 'x', lines: 'a pipe' }] } })).toMatchObject({ ok: false, error: expect.stringContaining('lines is a list') })
    expect(bidTakeoffInput('plan_bid_takeoff', { takeoff: { bid_id: BID, rows: Array.from({ length: TAKEOFF_MAX_ROWS + 1 }, () => ({ fixture: 'x' })) } })).toMatchObject({ ok: false, error: expect.stringContaining('at most 100 rows') })
    const built = p({ rows: [{ fixture: ' Water closet ', group: ' Restroom A ', replace: true, lines: [{ part_id: VALVE.toUpperCase(), quantity: '2', unit_price: '11.5' }, { part: ' ZZ elbow ', quantity: 0 }], materials_each: null }] })
    expect(built.rows[0]).toEqual({ n: 1, fixture: 'Water closet', group: 'Restroom A', replace: true, materials_each: null, materials_from: null, lines: [{ n: 1, part_id: VALVE, part: null, quantity: 2, unit_price: 11.5 }, { n: 2, part_id: null, part: 'ZZ elbow', quantity: 0, unit_price: null }] })
    expect(p({ rows: [{ fixture: 'x' }] }).rows[0]).not.toHaveProperty('materials_each')
    expect(writeRpcBody('apply_bid_takeoff', { takeoff: { bid_id: BID, rows: [{ fixture: 'x' }] } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('plan_bid_takeoff', { takeoff: { bid_id: BID, rows: [{ fixture: 'x' }] } })).toMatchObject({ ok: true, rpc: null, step: 'plan', target: BID })
  })
})

describe('readBidTakeoffWorld — the reads the door sees', () => {
  it('reads the bid, the active version’s rows and lines, the parts by id and by name, and each part’s lowest price', async () => {
    const asked: string[] = []
    const reads: TakeoffReads = {
      rows: (table, query) => {
        asked.push(`${table}?${query}`)
        if (table === 'bids') return Promise.resolve([{ id: BID, bid_number: '9001', project_name: 'ZZ', service_type_id: TRADE, selected_bid_version_id: null, alternate_group_tags: null, bid_date_sent: null }])
        if (table === 'bids_count_rows') return Promise.resolve([{ id: WC, fixture: 'Water closet', count: '4', unit: 'ea', page: null, group_tag: null, sequence_order: '1' }])
        if (table === 'material_parts' && query.includes('id=in.')) return Promise.resolve([part(VALVE, 'ZZ stop valve')])
        if (table === 'material_parts') return Promise.resolve([part(ELBOW, 'ZZ Elbow'), part('other', 'ZZ elbow long')])
        if (table === 'material_part_prices') return Promise.resolve([{ id: 'p2', part_id: VALVE, price: '12' }, { id: 'p1', part_id: VALVE, price: '12' }, { id: 'p3', part_id: VALVE, price: '14' }])
        return Promise.resolve([])
      },
    }
    const w = await readBidTakeoffWorld(reads, p({ rows: [{ fixture: 'Water closet', lines: [{ part_id: VALVE, quantity: 1 }, { part: 'zz elbow', quantity: 2 }] }] }), { userId: DEV })
    expect(asked).toEqual(expect.arrayContaining([
      `bids?select=id,bid_number,project_name,service_type_id,selected_bid_version_id,alternate_group_tags,bid_date_sent&id=eq.${BID}`,
      `bids_count_rows?select=id,fixture,count,unit,page,group_tag,sequence_order&bid_id=eq.${BID}&bid_version_id=is.null&order=sequence_order.asc,id.asc&limit=200&offset=0`,
      `bids_takeoff_rough_part_lines?select=${LINE_COLS}&bid_id=eq.${BID}&bid_version_id=is.null&order=count_row_id.asc,sequence_order.asc,id.asc&limit=200&offset=0`,
      `bid_count_row_custom_costs?select=id,count_row_id,unit_materials_cents,house_name&bid_id=eq.${BID}&order=id.asc&limit=200&offset=0`,
      `material_parts?select=id,name,manufacturer,service_type_id,order_increment,order_increment_unit,part_types(order_increment,order_increment_unit)&id=in.(${VALVE})&limit=1000`,
      `material_parts?select=id,name,manufacturer,service_type_id,order_increment,order_increment_unit,part_types(order_increment,order_increment_unit)&service_type_id=eq.${TRADE}&name=ilike.zz%20elbow&order=id.asc&limit=50`,
    ]))
    expect(w.parts.map((x) => x.id)).toEqual([VALVE, ELBOW]) // the name is matched whole, case-blind
    expect(w.lowest[VALVE]).toEqual({ priceId: 'p1', price: 12 }) // the lowest, a tie to the smaller id
    expect(w.countRows[0]).toMatchObject({ count: 4, sequence_order: 1 })
  })
})

describe('bidTakeoffDryRun — parts on a count row', () => {
  it('adds a line at the book’s lowest price, snapshots how the part is sold, and totals the materials', () => {
    const r = plan({ rows: [{ fixture: 'water closet', lines: [{ part_id: PIPE, quantity: 6 }, { part: 'zz stop valve', quantity: 2, unit_price: 11.5 }, { part_id: ELBOW, quantity: 3 }] }] })
    expect(r.rows[0]?.lines.map((l) => (l.status === 'add' ? l.row : null))).toEqual([
      { bid_id: BID, bid_version_id: null, count_row_id: WC, part_id: PIPE, quantity: 6, unit_price: 2.5, sequence_order: 1, source_material_part_price_id: 'price-pipe', source_template_id: null, order_increment: 20, order_increment_unit: 'ft_stick' },
      { bid_id: BID, bid_version_id: null, count_row_id: WC, part_id: VALVE, quantity: 2, unit_price: 11.5, sequence_order: 2, source_material_part_price_id: null, source_template_id: null, order_increment: null, order_increment_unit: null },
      { bid_id: BID, bid_version_id: null, count_row_id: WC, part_id: ELBOW, quantity: 3, unit_price: 0, sequence_order: 3, source_material_part_price_id: null, source_template_id: null, order_increment: null, order_increment_unit: null },
    ])
    expect(r.rows[0]?.lines.map((l) => l.reads)).toEqual(['6 × ZZ 2 in pipe at $2.50 (the book\'s lowest)', '2 × ZZ stop valve (ZZ Brass) at $11.50', expect.stringContaining('no price in the book')])
    // One unit: 6 × 2.50 + 2 × 11.50 = 38. Four of them: 152. The pipe is 24 ft, bought as 40 ft: +40.
    expect(r.rows[0]).toMatchObject({ status: 'ready', reads: '4 × Water closet', each_before: '$0.00', each_after: '$38.00', row_after: '$152.00' })
    expect(r.materials).toMatchObject({ before: '$0.00', after: '$192.00' })
    expect(r.counts).toMatchObject({ rows_ready: 1, lines_added: 3, lines_changed: 0, lines_held: 0 })
    expect(r.warnings.join('\n')).toContain('1 new line has no price in the parts book')
  })
  it('changes the one line that carries the part, keeps its price when none is given, and leaves one that already reads that way', () => {
    const lines = [line('l1', WC, PIPE, 6, 2.5, { source_material_part_price_id: 'price-pipe', order_increment: 20, order_increment_unit: 'ft_stick' }), line('l2', WC, VALVE, 2, 12, { sequence_order: 2 })]
    const r = plan({ rows: [{ fixture: 'Water closet', lines: [{ part_id: PIPE, quantity: 8 }, { part_id: VALVE, quantity: 2, unit_price: 13 }, { part_id: ELBOW, quantity: 1, unit_price: 4 }] }] }, { lines })
    expect(r.rows[0]?.lines).toEqual([
      { status: 'change', n: 1, id: 'l1', reads: '6 × ZZ 2 in pipe at $2.50 → 8 × ZZ 2 in pipe at $2.50', patch: { quantity: 8 } },
      { status: 'change', n: 2, id: 'l2', reads: '2 × ZZ stop valve (ZZ Brass) at $12.00 → 2 × ZZ stop valve (ZZ Brass) at $13.00', patch: { unit_price: 13, source_material_part_price_id: null } },
      { status: 'add', n: 3, reads: '1 × ZZ elbow at $4.00', row: expect.objectContaining({ sequence_order: 3, unit_price: 4, source_material_part_price_id: null }) },
    ])
    expect(plan({ rows: [{ fixture: 'Water closet', lines: [{ part_id: PIPE, quantity: 6 }] }, { fixture: 'Lavatory', lines: [{ part_id: VALVE, quantity: 1 }] }] }, { lines }).rows.map((x) => x.status)).toEqual(['unchanged', 'ready'])
  })
  it('replace rewrites a row’s lines whole, or not at all when a line is held', () => {
    const lines = [line('l1', WC, PIPE, 6, 2.5), line('l2', WC, VALVE, 2, 12, { sequence_order: 2 }), line('l3', LAV, VALVE, 1, 12)]
    const r = plan({ rows: [{ fixture: 'Water closet', replace: true, lines: [{ part_id: VALVE, quantity: 3 }] }] }, { lines })
    expect(r.rows[0]).toMatchObject({ status: 'ready', remove_line_ids: ['l1', 'l2'], each_before: '$39.00', each_after: '$36.00' })
    expect(r.rows[0]?.lines[0]).toMatchObject({ status: 'add', row: { sequence_order: 1 } })
    expect(r.counts).toMatchObject({ lines_removed: 2, lines_added: 1 })
    // 3 × 12 × 4 on the water closet, 1 × 12 × 3 on the lavatory.
    expect(r.materials.after).toBe('$180.00')
    const held = plan({ rows: [{ fixture: 'Water closet', replace: true, lines: [{ part_id: VALVE, quantity: 3 }, { part: 'no such part', quantity: 1 }] }, { fixture: 'Lavatory', materials_each: 10 }] }, { lines })
    expect(held.rows[0]).toMatchObject({ status: 'held', why: expect.stringContaining('a replace goes whole or not at all') })
    // An empty replace clears the row's lines.
    expect(plan({ rows: [{ fixture: 'Lavatory', replace: true }] }, { lines }).rows[0]).toMatchObject({ status: 'ready', remove_line_ids: ['l3'], each_after: '$0.00' })
  })
  it('holds a faulty line with its reason and lets the row’s other lines go on', () => {
    const lines = [line('l1', WC, VALVE, 1, 12), line('l2', WC, VALVE, 2, 12, { sequence_order: 2 })]
    const r = plan({ rows: [{ fixture: 'Lavatory', lines: [
      { part_id: PIPE, quantity: 2 }, { quantity: 1 }, { part_id: 'not-an-id', quantity: 1 }, { part_id: 'aaaaaaaa-9999-4111-8111-111111111111', quantity: 1 },
      { part: 'no such part', quantity: 1 }, { part_id: ELBOW, quantity: 0 }, { part_id: ELBOW, quantity: 1, unit_price: -1 },
    ] }, { fixture: 'Water closet', lines: [{ part_id: VALVE, quantity: 5 }] }] }, { lines })
    expect(r.rows[0]?.lines.map((l) => (l.status === 'held' ? l.why : l.status))).toEqual([
      'add', expect.stringContaining('names its part'), expect.stringContaining('material_parts.id'), expect.stringContaining('is visible to you'),
      expect.stringContaining('no part named "no such part"'), expect.stringContaining('above zero'), expect.stringContaining('0 or more'),
    ])
    expect(r.rows[1]?.lines[0]).toMatchObject({ status: 'held', why: expect.stringContaining('2 lines on this row already carry that part') })
    expect(r.rows.map((x) => x.status)).toEqual(['ready', 'unchanged'])
    // The same part twice in the ask, two parts of one name, a part of another trade.
    expect(plan({ rows: [{ fixture: 'Lavatory', lines: [{ part_id: PIPE, quantity: 1 }, { part_id: PIPE, quantity: 2 }, { part_id: VALVE, quantity: 1 }] }] }).rows[0]?.lines[0]).toMatchObject({ status: 'held', why: expect.stringContaining('lines 1 and 2 name the same part') })
    const twins = { parts: [part(ELBOW, 'ZZ elbow'), part('aaaaaaaa-0004-4111-8111-111111111111', 'zz elbow', { manufacturer: 'ZZ Brass' }), part(VALVE, 'ZZ stop valve', { service_type_id: 'another-trade' })] }
    const t = plan({ rows: [{ fixture: 'Lavatory', lines: [{ part: 'ZZ elbow', quantity: 1 }, { part_id: VALVE, quantity: 1 }], materials_each: 5 }] }, twins)
    expect(t.rows[0]?.lines.map((l) => (l.status === 'held' ? l.why : l.status))).toEqual([expect.stringContaining('2 parts are named "ZZ elbow"'), expect.stringContaining('another trade')])
  })
  it('holds a row with no count row, a row named twice, and a row that asks for nothing', () => {
    const r = plan({ rows: [{ fixture: 'Urinal', lines: [{ part_id: VALVE, quantity: 1 }] }, { fixture: 'Lavatory', lines: [{ part_id: VALVE, quantity: 1 }] }, { fixture: 'lavatory', materials_each: 5 }, { fixture: 'Water closet' }, { fixture: '', lines: [] }, { fixture: 'Water closet', group: 'Break room', materials_each: 9 }] }, { countRows: [countRow(WC, 'Water closet', 4), countRow(LAV, 'Lavatory', 3), countRow('wc-alt', 'Water closet', 1, { group_tag: 'Break room' })], bid: { ...world().bid!, alternate_group_tags: ['Break room'] } })
    expect(r.rows.map((x) => [x.status, x.why ?? ''])).toEqual([
      ['held', expect.stringContaining('plan_bid_counts first')],
      ['held', expect.stringContaining('rows 2 and 3 of the ask name the same count row')],
      ['held', expect.stringContaining('rows 2 and 3 of the ask name the same count row')],
      ['held', expect.stringContaining('asks for nothing')],
      ['held', expect.stringContaining('names its fixture')],
      ['ready', ''],
    ])
    expect(r.rows[5]).toMatchObject({ count_row_id: 'wc-alt', reads: '1 × Water closet (Break room)' })
  })
})

describe('bidTakeoffDryRun — the quoted materials cost each', () => {
  it('sets, changes, leaves and clears the one cost a row carries, and warns where a row has lines too', () => {
    const customCosts = [{ id: 'c1', count_row_id: LAV, unit_materials_cents: 18450, house_name: 'ZZ Supply' }]
    expect(plan({ rows: [{ fixture: 'Lavatory', materials_each: 200 }] }, { customCosts }).rows[0]?.cost).toMatchObject({ status: 'set', reads: '$184.50 → $200.00 each quoted', row: { unit_materials_cents: 20000, house_name: 'ZZ Supply' } })
    expect(plan({ rows: [{ fixture: 'Lavatory', materials_each: null }] }, { customCosts }).rows[0]?.cost).toEqual({ status: 'clear', id: 'c1', reads: 'the quoted cost of $184.50 each comes off' })
    expect(refusal({ rows: [{ fixture: 'Lavatory', materials_each: 184.5 }] }, { customCosts })).toContain('Every row already reads that way')
    expect(refusal({ rows: [{ fixture: 'Water closet', materials_each: null }] }, { customCosts })).toContain('Every row already reads that way')
    expect(plan({ rows: [{ fixture: 'Water closet', materials_each: -5, lines: [{ part_id: VALVE, quantity: 1 }] }] }).rows[0]?.cost).toMatchObject({ status: 'held', why: expect.stringContaining('0 or more') })
    const both = plan({ rows: [{ fixture: 'Lavatory', materials_each: 150, lines: [{ part_id: VALVE, quantity: 1 }] }] })
    expect(both.warnings.join('\n')).toContain('Pricing reads the quoted cost for that row')
    expect(both.counts).toMatchObject({ costs_set: 1, lines_added: 1 })
  })
})

describe('bidTakeoffDryRun — what it refuses, and the hash', () => {
  it('a bid not visible, a version the bid does not have, and nothing ready', () => {
    expect(refusal({ rows: [{ fixture: 'x', lines: [] }] }, { bid: null })).toContain('No bid')
    expect(refusal({ rows: [{ fixture: 'Lavatory', materials_each: 1 }], version_id: 'dddddddd-1111-4111-8111-111111111111' })).toContain('has never been split')
    expect(refusal({ rows: [{ fixture: 'Urinal', materials_each: 1 }] })).toContain('Held: Urinal — no count row wears that fixture there')
  })
  it('warns on a sent bid and a locked version, and commits to the lines as they stood', async () => {
    const versions = [{ id: 'dddddddd-1111-4111-8111-111111111111', name: 'To Plans', sort_order: 0, locked_at: '2026-11-01T00:00:00Z' }]
    const r = plan({ rows: [{ fixture: 'Lavatory', materials_each: 1 }] }, { versions, versionId: versions[0]!.id, bid: { ...world().bid!, bid_date_sent: '2026-06-02' } })
    expect(r.warnings.join('\n')).toContain('was sent on 2026-06-02')
    expect(r.warnings.join('\n')).toContain('is locked')
    const payload = p({ rows: [{ fixture: 'Water closet', lines: [{ part_id: PIPE, quantity: 8 }] }] })
    const a = bidTakeoffDryRun(payload, world({ lines: [line('l1', WC, PIPE, 6, 2.5)] }))
    const b = bidTakeoffDryRun(payload, world({ lines: [line('l1', WC, PIPE, 6, 2.5)] }))
    const moved = bidTakeoffDryRun(payload, world({ lines: [line('l1', WC, PIPE, 7, 2.5)] }))
    if (!a.ok || !b.ok || !moved.ok) throw new Error('expected plans')
    const hash = await planHash('plan_bid_takeoff', payload, a.reply)
    expect(await planHash('apply_bid_takeoff', payload, b.reply)).toBe(hash)
    expect(await planHash('plan_bid_takeoff', payload, moved.reply)).not.toBe(hash)
  })
})

describe('the apply’s words', () => {
  it('say what landed and name what failed', () => {
    expect(bidTakeoffAppliedWords('b9001 ZZ TEST seat bid', { rows: 2, added: 3, changed: 1, removed: 2, costs_set: 1, costs_cleared: 0 }, [], 1, '$192.00')).toMatchObject({ landed: '3 lines added, 1 changed, 2 removed, 1 quoted cost set on 2 count rows', held_in_plan: 1, next: expect.stringContaining('materials $192.00 before tax') })
    expect(bidTakeoffAppliedWords('b9001', { rows: 1, added: 0, changed: 0, removed: 0, costs_set: 0, costs_cleared: 1 }, [{ n: 1, what: '4 × Water closet', why: '403' }], 0, null).next).toContain('1 did not')
    expect(alreadyApplied('apply_bid_takeoff', { target: BID, at: null })).toContain('already applied on this bid')
  })
  it('the server writes each kind of row its own way', () => {
    expect(SERVER).toContain("restRows(session, 'DELETE', 'bids_takeoff_rough_part_lines', `id=in.(${r.remove_line_ids.join(',')})&select=id`, null, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'POST', 'bids_takeoff_rough_part_lines', 'select=id', adds.map((l) => l.row))")
    expect(SERVER).toContain("restRows(session, 'PATCH', 'bids_takeoff_rough_part_lines', `id=eq.${l.id}&select=id`, l.patch, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'POST', 'bid_count_row_custom_costs', 'on_conflict=bid_id,count_row_id&select=id', r.cost.row, 'resolution=merge-duplicates,return=representation')")
    expect(SERVER).toContain("restRows(session, 'DELETE', 'bid_count_row_custom_costs', `id=eq.${r.cost.id}&select=id`, null, 'return=representation')")
  })
})
