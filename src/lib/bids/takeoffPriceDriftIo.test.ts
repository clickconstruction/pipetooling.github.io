import { describe, expect, it } from 'vitest'
import { loadBookPrices, loadTakeoffDriftLines } from './takeoffPriceDriftIo'

type Step = { method: string; args: unknown[] }
function fakeClient(tables: Record<string, unknown[]>) {
  const queries: Array<{ table: string; steps: Step[] }> = []
  const client = {
    from(table: string) {
      const steps: Step[] = []
      queries.push({ table, steps })
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [], error: null })
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
  return { client: client as unknown as Parameters<typeof loadBookPrices>[0], queries }
}

describe('loadBookPrices', () => {
  it('reads each row once, in id chunks, with its house and part', async () => {
    const { client, queries } = fakeClient({
      material_part_prices: [{ id: 'src-1', price: '17.56', house: { name: 'Reece' }, part: { name: '4IN 90 PVC' } }],
    })
    const book = await loadBookPrices(client, ['src-1', 'src-1', ''])
    expect(book.get('src-1')).toEqual({ price: 17.56, houseName: 'Reece', partName: '4IN 90 PVC' })
    expect(queries).toHaveLength(1)
    expect(queries[0]!.steps).toContainEqual({ method: 'in', args: ['id', ['src-1']] })
    expect(queries[0]!.steps).toContainEqual({ method: 'order', args: ['id', { ascending: true }] })
  })

  it('reads nothing for no rows', async () => {
    const { client, queries } = fakeClient({})
    expect((await loadBookPrices(client, [])).size).toBe(0)
    expect(queries).toHaveLength(0)
  })
})

describe('loadTakeoffDriftLines', () => {
  const rows = [{ id: 'l1', quantity: '52', unit_price: '25.88', source_material_part_price_id: 'src-1', part: { name: '4IN 90 PVC' }, row: { n: 0 } }]

  it('reads one version’s lines and makes each a drift line, a 0 count reading ×1', async () => {
    const { client, queries } = fakeClient({ bids_takeoff_rough_part_lines: rows })
    const lines = await loadTakeoffDriftLines(client, { bidId: 'bid-329', versionId: 'v1' })
    expect(lines).toEqual([{ id: 'l1', partName: '4IN 90 PVC', quantity: 52, unitPrice: 25.88, count: 1, sourcePriceId: 'src-1' }])
    const steps = queries[0]!.steps
    expect(steps).toContainEqual({ method: 'eq', args: ['bid_id', 'bid-329'] })
    expect(steps).toContainEqual({ method: 'eq', args: ['bid_version_id', 'v1'] })
    expect(steps).toContainEqual({ method: 'range', args: [0, 999] })
  })

  it('an unsplit bid reads its base lines', async () => {
    const { client, queries } = fakeClient({ bids_takeoff_rough_part_lines: rows })
    await loadTakeoffDriftLines(client, { bidId: 'bid-343', versionId: null })
    expect(queries[0]!.steps).toContainEqual({ method: 'is', args: ['bid_version_id', null] })
  })
})
