import { describe, expect, it } from 'vitest'
import { loadBidMaterials, loadPoTotal } from './bidMaterialsIo'

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
const stagePos = { purchase_order_id_rough_in: 'po-rough', purchase_order_id_top_out: null, purchase_order_id_trim_set: 'po-trim' }
const poItems = [{ price_at_time: 100, quantity: 3 }, { price_at_time: 50.5, quantity: 2 }] // 401 per PO

const filter = (steps: Step[], method: string, col: string) => steps.find((s) => s.method === method && s.args[0] === col)?.args[1]

describe('loadBidMaterials', () => {
  it('reads a Combined bid from its version’s part lines with the rounding, never from the stage POs it still links', async () => {
    const { client, queries } = fakeClient({ bids: [{ materials_model: 'rough' }], bids_takeoff_rough_part_lines: roughLines, purchase_order_items: poItems })
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: 'v1', countRows, costEstimate: stagePos, fallbackModel: 'exact' })
    expect(m).toEqual({ model: 'rough', roughIn: 380, topOut: 0, trimSet: 0, total: 380, byCountRowId: { lav: 64, wc: 316 } })
    const lineQuery = queries.find((q) => q.table === 'bids_takeoff_rough_part_lines')!
    expect(filter(lineQuery.steps, 'eq', 'bid_id')).toBe('bid1')
    expect(filter(lineQuery.steps, 'eq', 'bid_version_id')).toBe('v1')
    expect(lineQuery.steps.find((s) => s.method === 'select')?.args[0]).toContain('order_increment_unit')
    expect(queries.some((q) => q.table === 'purchase_order_items')).toBe(false)
  })

  it('reads the unsplit base lines (bid_version_id is null) when the bid has no versions', async () => {
    const { client, queries } = fakeClient({ bids: [{ materials_model: 'rough' }], bids_takeoff_rough_part_lines: roughLines })
    await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: null, countRows, costEstimate: null })
    const lineQuery = queries.find((q) => q.table === 'bids_takeoff_rough_part_lines')!
    expect(lineQuery.steps).toContainEqual({ method: 'is', args: ['bid_version_id', null] })
    expect(filter(lineQuery.steps, 'eq', 'bid_version_id')).toBeUndefined()
  })

  it('reads a By Stage bid from its stage POs, never from the part lines it may have parked', async () => {
    const { client, queries } = fakeClient({ bids: [{ materials_model: 'exact' }], bids_takeoff_rough_part_lines: roughLines, purchase_order_items: poItems })
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: 'v1', countRows, costEstimate: stagePos })
    expect(m).toEqual({ model: 'exact', roughIn: 401, topOut: 0, trimSet: 401, total: 802, byCountRowId: {} })
    expect(queries.filter((q) => q.table === 'purchase_order_items').map((q) => filter(q.steps, 'eq', 'purchase_order_id'))).toEqual(['po-rough', 'po-trim'])
    expect(queries.some((q) => q.table === 'bids_takeoff_rough_part_lines')).toBe(false)
  })

  it('reads an unknown model as By Stage, the column’s only other value', async () => {
    const { client } = fakeClient({ bids: [{ materials_model: null }], bids_takeoff_rough_part_lines: roughLines, purchase_order_items: poItems })
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: null, countRows, costEstimate: stagePos, fallbackModel: 'rough' })
    expect(m.model).toBe('exact')
  })

  it('falls back to the model the caller holds when the fresh read fails', async () => {
    const { client } = fakeClient({ bids_takeoff_rough_part_lines: roughLines, purchase_order_items: poItems }, new Set(['bids']))
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: 'v1', countRows, costEstimate: stagePos, fallbackModel: 'rough' })
    expect(m).toMatchObject({ model: 'rough', total: 380 })
  })

  it('gives a By Stage bid with no cost estimate $0 without reading a PO', async () => {
    const { client, queries } = fakeClient({ bids: [{ materials_model: 'exact' }], purchase_order_items: poItems })
    const m = await loadBidMaterials(client, { bidId: 'bid1', bidVersionId: null, countRows, costEstimate: null })
    expect(m).toEqual({ model: 'exact', roughIn: 0, topOut: 0, trimSet: 0, total: 0, byCountRowId: {} })
    expect(queries.some((q) => q.table === 'purchase_order_items')).toBe(false)
  })
})

describe('loadPoTotal', () => {
  it('sums price × quantity over the PO’s items', async () => {
    const { client } = fakeClient({ purchase_order_items: poItems })
    expect(await loadPoTotal(client, 'po-rough')).toBe(401)
  })

  it('reads $0 for a missing PO or a failed read', async () => {
    const { client, queries } = fakeClient({ purchase_order_items: poItems }, new Set(['purchase_order_items']))
    expect(await loadPoTotal(client, null)).toBe(0)
    expect(queries).toHaveLength(0)
    expect(await loadPoTotal(client, 'po-rough')).toBe(0)
  })
})
