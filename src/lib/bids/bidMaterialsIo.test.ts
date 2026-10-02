import { describe, expect, it } from 'vitest'
import { loadBidMaterials } from './bidMaterialsIo'

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
                if (failing.has(table)) return resolve({ data: null, error: { message: 'boom' } })
                const rows = tables[table] ?? []
                resolve({ data: steps.some((s) => s.method === 'maybeSingle') ? (rows[0] ?? null) : rows, error: null })
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
  return { client: client as unknown as Parameters<typeof loadBidMaterials>[0], queries }
}

const countRows = [
  { id: 'lav', count: 4 },
  { id: 'wc', count: 2 },
]
const roughLines = [
  { count_row_id: 'lav', part_id: 'copper', quantity: 5, unit_price: 2, order_increment: 20, order_increment_unit: 'ft_stick' },
  { count_row_id: 'wc', part_id: 'copper', quantity: 2.5, unit_price: 2, order_increment: 20, order_increment_unit: 'ft_stick' },
  { count_row_id: 'wc', part_id: 'valve', quantity: 1, unit_price: 150, order_increment: null, order_increment_unit: null },
]

const filter = (steps: Step[], method: string, col: string) => steps.find((s) => s.method === method && s.args[0] === col)?.args[1]

describe('loadBidMaterials', () => {
  it('reads the version’s part lines with the rounding', async () => {
    const { client, queries } = fakeClient({ bids_takeoff_rough_part_lines: roughLines })
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: 'v1', countRows })
    expect(m).toEqual({ roughIn: 380, topOut: 0, trimSet: 0, total: 380, byCountRowId: { lav: 64, wc: 316 } })
    const lineQuery = queries.find((q) => q.table === 'bids_takeoff_rough_part_lines')!
    expect(filter(lineQuery.steps, 'eq', 'bid_id')).toBe('bid1')
    expect(filter(lineQuery.steps, 'eq', 'bid_version_id')).toBe('v1')
    expect(lineQuery.steps.find((s) => s.method === 'select')?.args[0]).toContain('order_increment_unit')
  })

  it('reads the unsplit base lines (bid_version_id is null) when the bid has no versions', async () => {
    const { client, queries } = fakeClient({ bids_takeoff_rough_part_lines: roughLines })
    await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: null, countRows })
    const lineQuery = queries.find((q) => q.table === 'bids_takeoff_rough_part_lines')!
    expect(lineQuery.steps).toContainEqual({ method: 'is', args: ['bid_version_id', null] })
    expect(filter(lineQuery.steps, 'eq', 'bid_version_id')).toBeUndefined()
  })

  it('reads nothing but the part lines: no materials model, no stage purchase order (By Stage retired v2.4389)', async () => {
    const { client, queries } = fakeClient({ bids: [{ materials_model: 'exact' }], bids_takeoff_rough_part_lines: roughLines, purchase_order_items: [{ price_at_time: 100, quantity: 3 }] })
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: 'v1', countRows })
    expect(m.total).toBe(380)
    expect(queries.map((q) => q.table)).toEqual(['bids_takeoff_rough_part_lines'])
  })

  it('gives a bid with no part lines $0', async () => {
    const { client } = fakeClient({})
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: null, countRows })
    expect(m).toMatchObject({ roughIn: 0, topOut: 0, trimSet: 0, total: 0 })
  })
})
