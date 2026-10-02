import { describe, expect, it } from 'vitest'
import { ROBOT_RESEARCH_HOUSE_NAME, basketFromLines, eventsFromHistory, loadMaterialPriceIndexInputs } from './materialPriceIndexIo'

/** A recording client: each `from()` logs its builder calls and resolves the table's rows (or its error). */
type Step = { method: string; args: unknown[] }
function fakeClient(tables: Record<string, unknown[]>, failing: ReadonlySet<string> = new Set()) {
  const queries: Array<{ table: string; steps: Step[] }> = []
  const client = {
    from(table: string) {
      const steps: Step[] = []
      queries.push({ table, steps })
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: unknown }) => void) => {
                if (failing.has(table)) return resolve({ data: null, error: { message: 'boom', code: '42501' } })
                resolve({ data: tables[table] ?? [], error: null })
              }
            }
            return (...args: unknown[]) => {
              steps.push({ method: String(prop), args })
              return builder
            }
          },
        },
      )
      return builder
    },
  }
  return { client: client as unknown as Parameters<typeof loadMaterialPriceIndexInputs>[0], queries }
}

const PLUMBING = 'st-plumbing'
const openBid = { outcome: null, adopted_into_bid_id: null, estimator_id: 'u-wendi', created_by: 'u-wendi' }

function line(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    quantity: 2,
    unit_price: 10,
    bid_id: 'bid-1',
    row: { n: 3 },
    bid: openBid,
    price: {
      id: 'price-copper-reece',
      part_id: 'copper',
      supply_house_id: 'reece',
      price: 11,
      updated_at: '2026-08-21T15:00:00Z',
      part: { name: '2IN COPPER', service_type_id: PLUMBING, is_robot: false },
      house: { name: 'Reece' },
    },
    ...over,
  }
}

describe('basketFromLines', () => {
  it('weights each part + house by quantity × price × fixture count, and counts its open bids once each', () => {
    const basket = basketFromLines(
      [line('l1'), line('l2', { quantity: 1, row: { n: null } }), line('l3', { bid_id: 'bid-2' }), line('l4', { bid_id: 'bid-3', bid: { ...openBid, outcome: 'won' } })],
      { serviceTypeId: PLUMBING, twinUserIds: new Set() },
    )
    expect(basket).toEqual([
      { priceId: 'price-copper-reece', partId: 'copper', houseId: 'reece', partName: '2IN COPPER', houseName: 'Reece', spend: 60 + 10 + 60 + 60, price: 11, priceUpdatedDay: '2026-08-21', openBidCount: 2 },
    ])
  })

  it('leaves out robot parts, the web research house, a robot’s own bids and other trades', () => {
    const robotPart = line('r1', { price: { ...line('x').price, part: { name: 'R', service_type_id: PLUMBING, is_robot: true } } })
    const webHouse = line('r2', { price: { ...line('x').price, supply_house_id: 'web', house: { name: ROBOT_RESEARCH_HOUSE_NAME } } })
    const twinBid = line('r3', { bid: { ...openBid, estimator_id: 'u-twin' } })
    const electrical = line('r4', { price: { ...line('x').price, part: { name: 'WIRE', service_type_id: 'st-electrical', is_robot: false } } })
    expect(basketFromLines([robotPart, webHouse, twinBid, electrical], { serviceTypeId: PLUMBING, twinUserIds: new Set(['u-twin']) })).toEqual([])
  })

  it('counts a line whose bid is hidden from the reader, but never as an open bid', () => {
    const [p] = basketFromLines([line('l1', { bid: null })], { serviceTypeId: PLUMBING, twinUserIds: new Set() })
    expect(p).toMatchObject({ spend: 60, openBidCount: 0 })
  })

  it('skips a line with no price row, no quantity or no price', () => {
    expect(basketFromLines([line('a', { price: null }), line('b', { quantity: 0 }), line('c', { unit_price: '0' })], { serviceTypeId: PLUMBING, twinUserIds: new Set() })).toEqual([])
  })
})

describe('eventsFromHistory', () => {
  it('reads each change on the app calendar, and skips rows the history lost a part or house for', () => {
    expect(
      eventsFromHistory([
        { id: 'h1', part_id: 'copper', supply_house_id: 'reece', old_price: null, new_price: '33.63', changed_at: '2026-08-22T03:30:00Z' },
        { id: 'h2', part_id: null, supply_house_id: 'reece', old_price: 1, new_price: 2, changed_at: '2026-08-22T15:00:00Z' },
      ]),
    ).toEqual([{ partId: 'copper', houseId: 'reece', oldPrice: null, newPrice: 33.63, day: '2026-08-21', at: '2026-08-22T03:30:00Z' }])
  })
})

describe('loadMaterialPriceIndexInputs', () => {
  it('reads a year of book-priced lines and the whole history, paged in a stable order, and keeps only basket history', async () => {
    const { client, queries } = fakeClient({
      users: [{ id: 'u-twin' }],
      bids_takeoff_rough_part_lines: [line('l1')],
      material_part_price_history: [
        { id: 'h1', part_id: 'copper', supply_house_id: 'reece', old_price: 10, new_price: 11, changed_at: '2026-08-21T15:00:00Z' },
        { id: 'h2', part_id: 'ghost', supply_house_id: 'reece', old_price: 1, new_price: 2, changed_at: '2026-08-21T15:00:00Z' },
      ],
    })
    const out = await loadMaterialPriceIndexInputs(client, { serviceTypeId: PLUMBING, today: '2026-10-02' })
    expect(out.basket.map((p) => p.partId)).toEqual(['copper'])
    expect(out.events.map((e) => e.partId)).toEqual(['copper'])

    const lines = queries.find((q) => q.table === 'bids_takeoff_rough_part_lines')!
    expect(lines.steps).toContainEqual({ method: 'not', args: ['source_material_part_price_id', 'is', null] })
    expect(lines.steps).toContainEqual({ method: 'gt', args: ['unit_price', 0] })
    // A year back from Oct 2, midnight on the app calendar (CDT).
    expect(lines.steps).toContainEqual({ method: 'gte', args: ['created_at', '2025-10-02T05:00:00.000Z'] })
    expect(lines.steps).toContainEqual({ method: 'order', args: ['id', { ascending: true }] })
    expect(lines.steps).toContainEqual({ method: 'range', args: [0, 999] })

    const history = queries.find((q) => q.table === 'material_part_price_history')!
    expect(history.steps.filter((s) => s.method === 'order').map((s) => s.args[0])).toEqual(['changed_at', 'id'])
    expect(history.steps).toContainEqual({ method: 'range', args: [0, 999] })
  })

  it('reads on with no twins when the reader may not see users', async () => {
    const { client } = fakeClient({ bids_takeoff_rough_part_lines: [line('l1')], material_part_price_history: [] }, new Set(['users']))
    const out = await loadMaterialPriceIndexInputs(client, { serviceTypeId: PLUMBING, today: '2026-10-02' })
    expect(out.basket).toHaveLength(1)
  })

  it('throws when a read fails, never reading a failure as an empty book', async () => {
    const { client } = fakeClient({ bids_takeoff_rough_part_lines: [line('l1')] }, new Set(['material_part_price_history']))
    await expect(loadMaterialPriceIndexInputs(client, { serviceTypeId: PLUMBING, today: '2026-10-02' })).rejects.toThrow()
  })
})
