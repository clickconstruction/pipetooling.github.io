import { describe, expect, it } from 'vitest'
import { PRICE_CHECK_REFUSED, confirmPriceToday, savePriceToday } from './priceCheckIo'

type Step = { method: string; args: unknown[] }
function fakeClient(answer: { data: unknown; error: unknown }) {
  const queries: Array<{ table: string; steps: Step[] }> = []
  const client = {
    from(table: string) {
      const steps: Step[] = []
      queries.push({ table, steps })
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(answer)
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
  return { client: client as unknown as Parameters<typeof confirmPriceToday>[0], queries }
}

describe('confirmPriceToday', () => {
  it('dates the price today and nothing else, so the trigger logs it checked at the same price', async () => {
    const { client, queries } = fakeClient({ data: [{ id: 'p1' }], error: null })
    expect(await confirmPriceToday(client, 'p1', '2026-10-02')).toEqual({ ok: true })
    expect(queries).toHaveLength(1)
    expect(queries[0]!.table).toBe('material_part_prices')
    expect(queries[0]!.steps).toEqual([
      { method: 'update', args: [{ effective_date: '2026-10-02' }] },
      { method: 'eq', args: ['id', 'p1'] },
      { method: 'select', args: ['id'] },
    ])
  })

  it('calls an empty answer a refusal: a read-only account changes nothing', async () => {
    const { client } = fakeClient({ data: [], error: null })
    expect(await confirmPriceToday(client, 'p1', '2026-10-02')).toEqual({ ok: false, message: PRICE_CHECK_REFUSED })
  })
})

describe('savePriceToday', () => {
  it('writes the price and today’s date together', async () => {
    const { client, queries } = fakeClient({ data: [{ id: 'p1' }], error: null })
    expect(await savePriceToday(client, 'p1', 12.5, '2026-10-02')).toEqual({ ok: true })
    expect(queries[0]!.steps[0]).toEqual({ method: 'update', args: [{ price: 12.5, effective_date: '2026-10-02' }] })
  })

  it('passes the database’s words on when the write fails', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'permission denied for table material_part_prices' } })
    expect(await savePriceToday(client, 'p1', 12.5, '2026-10-02')).toEqual({ ok: false, message: 'permission denied for table material_part_prices' })
  })
})
