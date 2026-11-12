import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BID_PRICES_VERBS,
  bidPricesAppliedWords,
  bidPricesDryRun,
  bidPricesInput,
  isBidPricesVerb,
  priceOp,
  readBidPricesWorld,
  type BidPricesPayload,
  type BidPricesWorld,
  type PlanPrice,
} from '../../../supabase/functions/_shared/devMcpBidPrices'
import { openPricing, type PricingReader, type PricingRow } from '../../../supabase/functions/_shared/devMcpBidPricing'
import type { CountRow } from '../../../supabase/functions/_shared/devMcpBidCounts'
import { WRITE_VERBS, alreadyApplied, isWriteVerb, planHash, planVerbFor, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { CATALOG_TABLES } from '../../../supabase/functions/dev-mcp/catalog'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const TAB = readFileSync('src/components/bids/BidsPricingTab.tsx', 'utf8')

// A made-up bid, made-up books and made-up prices: no real name, number or amount.
const BID = 'eeeeeeee-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const TRADE = 'bbbbbbbb-1111-4111-8111-111111111111'
const OWN = 'pppppppp-own'
const SHARED = 'pppppppp-default'
const ROBOT = 'pppppppp-robot'
const countRow = (id: string, fixture: string, count: number, over: Partial<CountRow> = {}): CountRow => ({ id, fixture, count, unit: 'ea', page: null, group_tag: null, sequence_order: 1, ...over })
const entry = (id: string, name: string, total: number, version = OWN) => ({ id, total_price: total, version_id: version, fixture_types: { name } })

const bidRow = { id: BID, bid_number: '9001', project_name: 'ZZ TEST seat bid', created_by: DEV, service_type_id: TRADE, selected_bid_version_id: null, selected_price_book_version_id: null, alternate_group_tags: [], bid_date_sent: null }
const ownOpen = openPricing({ bid: bidRow, versions: [], pricings: [{ id: OWN, name: 'Default (this bid)', bid_version_id: null, is_robot: false }], templates: [], legacyRefs: [] })
const world = (over: Partial<BidPricesWorld> = {}): BidPricesWorld => ({
  bid: bidRow,
  open: ownOpen,
  countRows: [countRow('c1', 'Water closet', 4), countRow('c2', 'Lavatory', 3), countRow('c3', 'Hose bibb', 2), countRow('c4', 'Mop sink', 1)],
  entries: [entry('e1', 'Water closet', 900), entry('e2', 'Lavatory', 600)],
  assignments: [{ id: 'a2', count_row_id: 'c2', price_book_entry_id: 'e2', price_book_version_id: OWN, is_fixed_price: false, unit_price_override: 650 }],
  customPrices: [{ id: 'cp3', count_row_id: 'c3', price_book_version_id: OWN, unit_price: 120 }],
  ...over,
})
const p = (pricing: Record<string, unknown>): BidPricesPayload => {
  const built = bidPricesInput('plan_bid_pricing', { pricing: { bid_id: BID, ...pricing } })
  if (!built.ok) throw new Error(built.error)
  return built.p
}
type Reply = { rows: PlanPrice[]; counts: Record<string, number>; pricing: Record<string, unknown>; revenue: { before: string; after: string }; after_write: string[]; warnings: string[] }
const plan = (pricing: Record<string, unknown>, w: Partial<BidPricesWorld> = {}): Reply => {
  const dry = bidPricesDryRun(p(pricing), world(w))
  if (!dry.ok) throw new Error(dry.refused)
  return dry.reply as Reply
}
const refusal = (pricing: Record<string, unknown>, w: Partial<BidPricesWorld> = {}): string => {
  const dry = bidPricesDryRun(p(pricing), world(w))
  if (dry.ok) throw new Error('expected a refusal')
  return dry.refused
}

describe('devMcpBidPrices — the verbs on the allowlist', () => {
  it('are one write pair with no RPC, and the server and the README name both', () => {
    expect(BID_PRICES_VERBS).toEqual(['plan_bid_pricing', 'apply_bid_pricing'])
    for (const v of BID_PRICES_VERBS) {
      expect(isBidPricesVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`case '${v}':`)
      expect(SERVER).toContain(`name: '${v}',`)
    }
    expect(planVerbFor('apply_bid_pricing')).toBe('plan_bid_pricing')
    expect(README).toContain('`plan_bid_pricing(pricing)` · `apply_bid_pricing(pricing, plan_hash)`')
  })
})

describe('devMcpBidPrices — held to the tab’s own rule', () => {
  it('names only columns the tables have', () => {
    const columnsOf = (table: string): string[] => Object.keys(CATALOG_TABLES[table]?.columns ?? {})
    expect(columnsOf('bid_pricing_assignments')).toEqual(expect.arrayContaining(['id', 'bid_id', 'count_row_id', 'price_book_entry_id', 'price_book_version_id', 'is_fixed_price', 'unit_price_override']))
    expect(columnsOf('bid_count_row_custom_prices')).toEqual(expect.arrayContaining(['id', 'bid_id', 'count_row_id', 'price_book_version_id', 'unit_price']))
    expect(columnsOf('bids')).toEqual(expect.arrayContaining(['created_by', 'selected_price_book_version_id', 'selected_bid_version_id', 'bid_date_sent']))
    expect(columnsOf('price_book_versions')).toEqual(expect.arrayContaining(['bid_version_id']))
    expect(columnsOf('bid_versions')).toEqual(expect.arrayContaining(['starred_price_book_version_id']))
  })
  it('makes the write writeUnitPriceOverrideRow makes, in its order of cases', () => {
    const fn = TAB.slice(TAB.indexOf('async function writeUnitPriceOverrideRow'), TAB.indexOf('async function writeUnitPriceOverrideRow') + 2600)
    expect(fn.indexOf('if (existing) {')).toBeLessThan(fn.indexOf('if (entry) {'))
    expect(fn.indexOf('if (entry) {')).toBeLessThan(fn.indexOf('if (value == null) {'))
    const insert = fn.slice(fn.indexOf("from('bid_pricing_assignments').insert({"), fn.indexOf('}),', fn.indexOf("from('bid_pricing_assignments').insert({")))
    expect([...insert.matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1])).toEqual(['bid_id', 'count_row_id', 'price_book_entry_id', 'price_book_version_id', 'unit_price_override'])
    const w = world()
    // An assignment on the row: its override changes.
    expect(priceOp(w, OWN, 'c2', 700)).toEqual({ kind: 'override', assignment_id: 'a2', value: 700, delete_custom_id: null })
    // A book entry of the row's name: an assignment is made, since the kernel prefers the entry to a custom price.
    expect(priceOp(w, OWN, 'c1', 950)).toEqual({ kind: 'assign', row: { bid_id: BID, count_row_id: 'c1', price_book_entry_id: 'e1', price_book_version_id: OWN, unit_price_override: 950 }, delete_custom_id: null })
    // No entry: a custom price is changed, made, or cleared.
    expect(priceOp(w, OWN, 'c3', 130)).toEqual({ kind: 'custom_update', custom_id: 'cp3', value: 130 })
    expect(priceOp(w, OWN, 'c4', 85)).toEqual({ kind: 'custom_insert', row: { bid_id: BID, count_row_id: 'c4', price_book_version_id: OWN, unit_price: 85 } })
    expect(priceOp(w, OWN, 'c3', null)).toEqual({ kind: 'custom_delete', custom_id: 'cp3' })
    expect(priceOp(w, OWN, 'c4', null)).toBeNull()
    // A custom price under an entry is dropped when the assignment takes over, as the tab drops it.
    expect(priceOp(world({ customPrices: [{ id: 'cp1', count_row_id: 'c1', price_book_version_id: OWN, unit_price: 5 }] }), OWN, 'c1', 950)).toMatchObject({ kind: 'assign', delete_custom_id: 'cp1' })
  })
})

describe('bidPricesInput — the shape', () => {
  it('reads a price typed with a dollar sign, and keeps a bad one for the plan to hold', () => {
    expect(bidPricesInput('plan_bid_pricing', {})).toMatchObject({ ok: false, error: expect.stringContaining('plan_bid_pricing needs pricing') })
    expect(bidPricesInput('plan_bid_pricing', { pricing: { bid_id: BID, rows: [{ fixture: 'x' }] } })).toMatchObject({ ok: false, error: expect.stringContaining('names no price') })
    expect(p({ rows: [{ fixture: ' Water closet ', price: '$1,250.505' }, { fixture: 'Lavatory', price: -1 }, { fixture: 'Hose bibb', price: null }], revise: true })).toEqual({ action: 'pricing', bid_id: BID, revise: true, rows: [{ n: 1, fixture: 'Water closet', group: null, price: 1250.51, bad: false }, { n: 2, fixture: 'Lavatory', group: null, price: null, bad: true }, { n: 3, fixture: 'Hose bibb', group: null, price: null, bad: false }] })
    expect(writeRpcBody('apply_bid_pricing', { pricing: { bid_id: BID, rows: [{ fixture: 'x', price: 1 }] } })).toMatchObject({ ok: false, error: expect.stringContaining('plan_hash') })
    expect(writeRpcBody('plan_bid_pricing', { pricing: { bid_id: BID, rows: [{ fixture: 'x', price: 1 }] } })).toMatchObject({ ok: true, rpc: null, step: 'plan', target: BID })
  })
})

describe('bidPricesDryRun — prices on the count rows', () => {
  it('shows each price before → after and the grid’s total before → after', () => {
    const r = plan({ rows: [{ fixture: 'Water closet', price: 950 }, { fixture: 'lavatory', price: 650 }, { fixture: 'Mop sink', price: 85 }, { fixture: 'Hose bibb', price: null }] })
    expect(r.rows.map((x) => [x.status, x.reads])).toEqual([
      ['ready', '4 × Water closet: $900.00 each → $950.00 each'],
      ['unchanged', '3 × Lavatory: already $650.00 each'],
      ['ready', '1 × Mop sink: unpriced → $85.00 each'],
      ['ready', '2 × Hose bibb: $120.00 each → unpriced'],
    ])
    // Before: 4 × 900 + 3 × 650 + 2 × 120 = 5,790. After: 4 × 950 + 3 × 650 + 85 = 5,835.
    expect(r.revenue).toMatchObject({ before: '$5,790.00', after: '$5,835.00' })
    expect(r.counts).toEqual({ ready: 3, unchanged: 1, held: 0 })
    expect(r.pricing).toMatchObject({ id: OWN, kind: 'own', copy_first: false })
    expect(r.warnings.join('\n')).toContain('not refreshed')
  })
  it('a null on a row an assignment prices falls back to its entry’s price', () => {
    expect(plan({ rows: [{ fixture: 'Lavatory', price: null }] }).rows[0]).toMatchObject({ status: 'ready', reads: '3 × Lavatory: $650.00 each → $600.00 each (its book entry\'s price)', op: { kind: 'override', value: null } })
  })
  it('holds a row in words and lets the rest go on', () => {
    const r = plan({ rows: [{ fixture: '', price: 1 }, { fixture: 'Urinal', price: 1 }, { fixture: 'Lavatory', price: -5 }, { fixture: 'Water closet', price: 1000 }, { fixture: 'water closet', price: 1001 }, { fixture: 'Mop sink', price: 90 }] })
    expect(r.rows.map((x) => (x.status === 'held' ? x.why : x.status))).toEqual([
      'a row names its fixture',
      expect.stringContaining('plan_bid_counts adds it'),
      expect.stringContaining('0 or more'),
      expect.stringContaining('rows 4 and 5 of the ask price the same count row'),
      expect.stringContaining('rows 4 and 5 of the ask price the same count row'),
      'ready',
    ])
    const twoRows = world({ countRows: [countRow('c1', 'Water closet', 4, { group_tag: 'Level 1' }), countRow('c9', 'Water closet', 2, { group_tag: 'Level 2' })] })
    expect(bidPricesDryRun(p({ rows: [{ fixture: 'Water closet', price: 1 }] }), twoRows)).toMatchObject({ ok: false, refused: expect.stringContaining('2 count rows wear that fixture there') })
    expect(bidPricesDryRun(p({ rows: [{ fixture: 'Water closet', group: 'level 2', price: 1 }] }), twoRows)).toMatchObject({ ok: true })
  })
  it('refuses a sent bid unless the ask revises it, a bid with no creator, no pricing, and the robots’ book', () => {
    const sent = { bid: { ...bidRow, bid_date_sent: '2026-06-02' } }
    expect(refusal({ rows: [{ fixture: 'Mop sink', price: 85 }] }, sent)).toContain('presses Revise')
    expect(plan({ rows: [{ fixture: 'Mop sink', price: 85 }], revise: true }, sent).warnings.join('\n')).toContain('replace the ones it was sent at')
    expect(refusal({ rows: [{ fixture: 'Mop sink', price: 85 }] }, { bid: { ...bidRow, created_by: null } })).toContain('no creator on record')
    expect(refusal({ rows: [{ fixture: 'Mop sink', price: 85 }] }, { open: { ...ownOpen, pricingId: null } })).toContain('no pricing to write on')
    const robot = openPricing({ bid: { ...bidRow, selected_price_book_version_id: ROBOT }, versions: [], pricings: [], templates: [{ id: ROBOT, name: '🤖 Robot Default', bid_version_id: null, is_robot: true }], legacyRefs: [] })
    expect(refusal({ rows: [{ fixture: 'Mop sink', price: 85 }] }, { open: robot })).toContain('robots\' price book')
    expect(refusal({ rows: [{ fixture: 'Mop sink', price: 85 }] }, { countRows: [] })).toContain('no count rows')
    expect(refusal({ rows: [{ fixture: 'Lavatory', price: 650 }] })).toContain('Every row already reads that price')
    expect(refusal({ rows: [{ fixture: 'x', price: 1 }] }, { bid: null })).toContain('No bid')
  })
  it('on a shared book, says the apply takes the bid’s own copy first', () => {
    const shared = openPricing({ bid: bidRow, versions: [], pricings: [], templates: [{ id: SHARED, name: 'Default', bid_version_id: null, is_robot: false }], legacyRefs: [] })
    const r = plan({ rows: [{ fixture: 'Water closet', price: 950 }] }, { open: shared, entries: [entry('e1', 'Water closet', 900, SHARED)], assignments: [], customPrices: [] })
    expect(r.pricing).toMatchObject({ id: SHARED, kind: 'shared', copy_first: true, viewer_dependent: true })
    expect(r.after_write[0]).toContain('first takes the bid\'s own copy of it')
    expect(r.rows[0]).toMatchObject({ op: { kind: 'assign', row: { price_book_version_id: SHARED } } })
  })
  it('commits the hash to the prices as they stood', async () => {
    const payload = p({ rows: [{ fixture: 'Water closet', price: 950 }] })
    const a = bidPricesDryRun(payload, world())
    const b = bidPricesDryRun(payload, world())
    const moved = bidPricesDryRun(payload, world({ entries: [entry('e1', 'Water closet', 925), entry('e2', 'Lavatory', 600)] }))
    if (!a.ok || !b.ok || !moved.ok) throw new Error('expected plans')
    const hash = await planHash('plan_bid_pricing', payload, a.reply)
    expect(await planHash('apply_bid_pricing', payload, b.reply)).toBe(hash)
    expect(await planHash('plan_bid_pricing', payload, moved.reply)).not.toBe(hash)
  })
})

describe('readBidPricesWorld — the reads the door sees', () => {
  it('reads the bid, the tab’s pick of the open pricing, and that pricing’s rows, each column held to the catalog', async () => {
    const tables: Record<string, PricingRow[]> = {
      bids: [bidRow],
      price_book_versions: [{ id: OWN, name: 'Default (this bid)', bid_id: BID, bid_version_id: null, is_robot: false, sort_order: 0, service_type_id: TRADE }],
      bids_count_rows: [{ id: 'c1', bid_id: BID, bid_version_id: null, fixture: 'Water closet', count: '4', unit: 'ea', page: null, group_tag: null, sequence_order: '1' }],
      price_book_entries: [entry('e1', 'Water closet', 900)],
      bid_pricing_assignments: [],
      bid_count_row_custom_prices: [],
    }
    const reader: PricingReader = {
      rows: async (table, query) => {
        const columns = Object.keys(CATALOG_TABLES[table]?.columns ?? {})
        for (const c of (query.select ?? '').split(',').map((s) => s.replace(/\(.*$/, '').trim()).filter((s) => s && s !== 'fixture_types')) expect(columns, `${table}.${c}`).toContain(c)
        let rows = [...(tables[table] ?? [])]
        for (const f of query.filters ?? []) {
          expect(columns, `${table}.${f.column}`).toContain(f.column)
          if (f.op === 'eq') rows = rows.filter((r) => r[f.column] === f.value)
          if (f.op === 'is') rows = rows.filter((r) => (r[f.column] ?? null) === f.value)
          if (f.op === 'gt') rows = rows.filter((r) => String(r[f.column]) > String(f.value))
        }
        return rows.slice(0, 200)
      },
    }
    const w = await readBidPricesWorld(reader, BID)
    expect(w.open).toMatchObject({ pricingId: OWN, target: { kind: 'own' } })
    expect(w.countRows[0]).toMatchObject({ id: 'c1', count: 4 })
    expect(w.entries).toHaveLength(1)
  })
})

describe('the apply’s words and the server’s writes', () => {
  it('say what landed and name what failed', () => {
    expect(bidPricesAppliedWords('b9001 ZZ TEST seat bid', { copied: 'pppppppp-copy', priced: 2 }, [], 1, '$5,835.00')).toMatchObject({ landed: '2 prices written, on the bid\'s own copy of the shared book', next: expect.stringContaining('the grid totals $5,835.00') })
    expect(bidPricesAppliedWords('b9001', { copied: null, priced: 0 }, [{ n: 1, what: 'x', why: '403' }], 0, null).next).toContain('1 did not')
    expect(alreadyApplied('apply_bid_pricing', { target: BID, at: null })).toContain('already applied on this bid')
  })
  it('clones as the dev, points the bid at the copy, and writes each row its own way', () => {
    expect(SERVER).toContain("restPost(session, 'rpc/clone_price_book_version_to_bid', { p_source_version_id: open.pricingId, p_bid_id: p.bid_id, p_name: open.name })")
    expect(SERVER).toContain("restRows(session, 'PATCH', 'bids', `id=eq.${p.bid_id}&select=id`, { selected_price_book_version_id: copyId }, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'PATCH', 'bid_pricing_assignments', `id=eq.${op.assignment_id}&select=id`, { unit_price_override: op.value }, 'return=representation')")
    expect(SERVER).toContain("restRows(session, 'POST', 'bid_pricing_assignments', 'select=id', op.row)")
    expect(SERVER).toContain("restRows(session, 'POST', 'bid_count_row_custom_prices', 'select=id', op.row)")
  })
})
