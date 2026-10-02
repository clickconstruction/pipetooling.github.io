// @vitest-environment jsdom
/**
 * The three reads behind Pricing's price cards row (the Pricing / Labor map's step 9, part 1):
 * the GC names, each scenario's card revenue, and each same-GC alternate version's revenue and
 * materials. A table-aware supabase stub records every read; prices come from typed prices
 * (`bid_count_row_custom_prices`), so a card's revenue is count × price.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { useAlternateVersionData, useGcNamesById, useScenarioCardRevenues } from './usePricingCardsData'
import type { BidVersion, PriceBookVersion } from '../lib/bids/bidPricingEngineTypes'
import type { BidCountRow } from '../types/bids'
import type { ScenarioInputs } from '../lib/bids/loadScenarioInputs'

type Row = Record<string, unknown>
type Read = { table: string; filters: Array<[string, string, unknown]> }

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  failing: new Set<string>(),
  single: {} as Record<string, Row | null>,
  reads: [] as Array<{ table: string; filters: Array<[string, string, unknown]> }>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const read: Read = { table, filters: [] }
      const result = () => {
        db.reads.push(read)
        if (db.failing.has(table)) return Promise.resolve({ data: null, error: { message: `${table} refused`, code: 'P0001' } })
        const rows = (db.tables[table] ?? []).filter((r) =>
          read.filters.every(([op, col, value]) => (op === 'in' ? (value as unknown[]).includes(r[col]) : r[col] === value)),
        )
        return Promise.resolve({ data: rows, error: null })
      }
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, value: unknown) => {
          read.filters.push(['eq', col, value])
          return builder
        },
        in: (col: string, value: unknown) => {
          read.filters.push(['in', col, value])
          return builder
        },
        order: () => builder,
        maybeSingle: () => {
          db.reads.push(read)
          return Promise.resolve({ data: db.single[table] ?? null, error: null })
        },
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad),
      }
      return builder
    },
  },
}))

const readsOf = (table: string) => db.reads.filter((r) => r.table === table)
const shown = () => JSON.parse(screen.getByTestId('out').textContent ?? 'null') as unknown

function GcProbe({ versions }: { versions: BidVersion[] }) {
  return <div data-testid="out">{JSON.stringify(useGcNamesById(versions))}</div>
}

/** Stable, as the engine's state is: a fresh [] each render would re-run the read every render. */
const NO_ASSIGNMENTS: never[] = []
const NO_TYPED_PRICES: never[] = []

function RevenueProbe(props: { bidId: string | null; selectedBidVersionId: string | null; priceBookVersions: PriceBookVersion[]; pricingCountRows: BidCountRow[] }) {
  const revenue = useScenarioCardRevenues({ ...props, bidPricingAssignments: NO_ASSIGNMENTS, bidCountRowCustomPrices: NO_TYPED_PRICES })
  return <div data-testid="out">{JSON.stringify(revenue)}</div>
}

function AltProbe(props: { bidId: string | null; selectedBidVersionId: string | null; bidVersions: BidVersion[]; loadInputs: (bidId: string, pricingId: string) => Promise<ScenarioInputs> }) {
  return <div data-testid="out">{JSON.stringify(useAlternateVersionData(props))}</div>
}

const version = (id: string, over: Partial<BidVersion> = {}) => ({ id, customer_id: null, is_alternate: false, starred_price_book_version_id: null, ...over }) as unknown as BidVersion
const scenario = (id: string, bid_version_id: string | null) => ({ id, bid_version_id, name: id }) as unknown as PriceBookVersion
const countRow = (id: string, count: number, bid_version_id: string | null) => ({ id, fixture: id.toUpperCase(), count, bid_id: 'b1', bid_version_id, sequence_order: 0 }) as unknown as BidCountRow
const price = (pricingId: string, rowId: string, unit_price: number) => ({ id: `${pricingId}-${rowId}`, bid_id: 'b1', price_book_version_id: pricingId, count_row_id: rowId, unit_price })

beforeEach(() => {
  db.tables = {}
  db.failing = new Set()
  db.single = {}
  db.reads = []
})
afterEach(() => cleanup())

const settle = () => act(async () => {})

describe('useGcNamesById', () => {
  it('reads the names of the GCs on the versions once, and a GC with no name reads as —', async () => {
    db.tables.customers = [{ id: 'c1', name: 'Hensel Phelps' }, { id: 'c2', name: null }, { id: 'c9', name: 'Not on this bid' }]
    render(<GcProbe versions={[version('v1', { customer_id: 'c1' }), version('v2', { customer_id: 'c2' }), version('v3', { customer_id: 'c1' })]} />)
    await settle()
    expect(shown()).toEqual({ c1: 'Hensel Phelps', c2: '—' })
    expect(readsOf('customers')).toEqual([{ table: 'customers', filters: [['in', 'id', ['c1', 'c2']]] }])
  })

  it('with no GC on any version, reads nothing', async () => {
    render(<GcProbe versions={[version('v1')]} />)
    await settle()
    expect(shown()).toEqual({})
    expect(db.reads).toEqual([])
  })
})

describe('useScenarioCardRevenues', () => {
  const rowsOnScreen = [countRow('c1', 4, 'v1')]

  it('with fewer than two scenarios, or no rows on screen, reads nothing and has no revenues', async () => {
    const { rerender } = render(<RevenueProbe bidId="b1" selectedBidVersionId="v1" priceBookVersions={[scenario('pA', 'v1')]} pricingCountRows={rowsOnScreen} />)
    await settle()
    expect(shown()).toEqual({})
    rerender(<RevenueProbe bidId="b1" selectedBidVersionId="v1" priceBookVersions={[scenario('pA', 'v1'), scenario('pB', 'v1')]} pricingCountRows={[]} />)
    await settle()
    expect(shown()).toEqual({})
    expect(db.reads).toEqual([])
  })

  it('prices each scenario on the rows on screen, and reads no other rows when all live on this version', async () => {
    db.tables.bid_count_row_custom_prices = [price('pA', 'c1', 100), price('pB', 'c1', 150)]
    render(<RevenueProbe bidId="b1" selectedBidVersionId="v1" priceBookVersions={[scenario('pA', 'v1'), scenario('pB', 'v1')]} pricingCountRows={rowsOnScreen} />)
    await settle()
    expect(shown()).toEqual({ pA: 400, pB: 600 })
    expect(readsOf('bids_count_rows')).toEqual([])
  })

  it('a scenario on another version is priced on that version’s own rows', async () => {
    db.tables.bid_count_row_custom_prices = [price('pA', 'c1', 100), price('pB', 'x1', 50)]
    db.tables.bids_count_rows = [countRow('c1', 4, 'v1'), countRow('x1', 2, 'v2')] as unknown as Row[]
    render(<RevenueProbe bidId="b1" selectedBidVersionId="v1" priceBookVersions={[scenario('pA', 'v1'), scenario('pB', 'v2')]} pricingCountRows={rowsOnScreen} />)
    await settle()
    expect(shown()).toEqual({ pA: 400, pB: 100 })
    expect(readsOf('bids_count_rows')).toHaveLength(1)
  })

  it('when the other version’s rows cannot be read, its card is left out rather than read as $0', async () => {
    db.tables.bid_count_row_custom_prices = [price('pA', 'c1', 100), price('pB', 'x1', 50)]
    db.failing.add('bids_count_rows')
    render(<RevenueProbe bidId="b1" selectedBidVersionId="v1" priceBookVersions={[scenario('pA', 'v1'), scenario('pB', 'v2')]} pricingCountRows={rowsOnScreen} />)
    await settle()
    expect(shown()).toEqual({ pA: 400 })
  })
})

describe('useAlternateVersionData', () => {
  const loadInputs = vi.fn(async (_bidId: string, pricingId: string): Promise<ScenarioInputs> => ({
    entries: [],
    assignments: [],
    hides: [],
    countRows: null,
    customPrices: [price(pricingId, 'a1', 30)] as never,
  }))
  const versions = [
    version('v1', { customer_id: 'c1' }),
    version('alt', { customer_id: 'c1', is_alternate: true, starred_price_book_version_id: 'pAlt' }),
    version('alt2', { customer_id: 'c1', is_alternate: true }),
    version('otherGc', { customer_id: 'c2', is_alternate: true, starred_price_book_version_id: 'pX' }),
  ]

  beforeEach(() => loadInputs.mockClear())

  it('with no bid, or no same-GC alternate, reads nothing', async () => {
    const { rerender } = render(<AltProbe bidId={null} selectedBidVersionId="v1" bidVersions={versions} loadInputs={loadInputs} />)
    await settle()
    rerender(<AltProbe bidId="b1" selectedBidVersionId="v1" bidVersions={[version('v1', { customer_id: 'c1' })]} loadInputs={loadInputs} />)
    await settle()
    expect(shown()).toEqual({})
    expect(db.reads).toEqual([])
  })

  it('a rough-model bid: each alternate’s materials from its own takeoff lines, and its ★ revenue on its own counts', async () => {
    db.single.bids = { materials_model: 'rough' }
    db.tables.bids_count_rows = [countRow('a1', 3, 'alt'), countRow('c1', 9, 'v1')] as unknown as Row[]
    db.tables.bids_takeoff_rough_part_lines = [{ bid_id: 'b1', bid_version_id: 'alt', count_row_id: 'a1', part_id: 'p1', quantity: 2, unit_price: 5, order_increment: null, order_increment_unit: null }]
    render(<AltProbe bidId="b1" selectedBidVersionId="v1" bidVersions={versions} loadInputs={loadInputs} />)
    await settle()
    // alt: 3 × (2 × $5) = $30 of materials; its ★ pAlt prices a1 at $30 × 3 = $90.
    // alt2: no ★, no counts → nothing to price. The other GC's alternate is not this row's.
    expect(shown()).toEqual({ alt: { revenue: 90, materials: 30 }, alt2: { revenue: null, materials: 0 } })
    expect(loadInputs).toHaveBeenCalledTimes(1)
    expect(loadInputs).toHaveBeenCalledWith('b1', 'pAlt')
  })

  it('a bid still flagged By Stage reads its takeoff lines like any other (v2.4389)', async () => {
    db.single.bids = { materials_model: 'exact' }
    db.tables.bids_count_rows = [countRow('a1', 3, 'alt')] as unknown as Row[]
    db.tables.bids_takeoff_rough_part_lines = [{ bid_id: 'b1', bid_version_id: 'alt', count_row_id: 'a1', part_id: 'p1', quantity: 2, unit_price: 5, order_increment: null, order_increment_unit: null }]
    render(<AltProbe bidId="b1" selectedBidVersionId="v1" bidVersions={versions} loadInputs={loadInputs} />)
    await settle()
    expect(shown()).toEqual({ alt: { revenue: 90, materials: 30 }, alt2: { revenue: null, materials: 0 } })
    expect(readsOf('bids_takeoff_rough_part_lines').length).toBeGreaterThan(0)
  })
})
