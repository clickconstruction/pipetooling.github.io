import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import {
  loadPartsByIds,
  loadPartsCatalog,
  loadWholePartPricesCatalog,
  loadWholePartsCatalog,
  mergeCatalogParts,
  missingPartIds,
} from './partsCatalog'

/**
 * Fake client that mimics PostgREST's silent `max_rows` cap: un-ranged
 * queries return at most 1000 rows with NO error, ranged queries slice.
 * The Plumbing catalog is past the cap in prod (1,713 parts on 2026-09-04);
 * an un-paged fetch silently dropped every part from "DI…" through Z.
 */
function makeFakeSupabase(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ table: string; ranged: boolean }> = []
  function builder(table: string) {
    let range: [number, number] | null = null
    let eq: [string, unknown] | null = null
    let inFilter: [string, unknown[]] | null = null
    const b = {
      select: () => b,
      eq: (col: string, v: unknown) => { eq = [col, v]; return b },
      in: (col: string, vals: unknown[]) => { inFilter = [col, vals]; return b },
      order: () => b,
      range: (from: number, to: number) => { range = [from, to]; return b },
      then: (resolve: (r: { data: unknown[]; error: null }) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push({ table, ranged: range != null })
        let rows = tables[table] ?? []
        if (eq) rows = rows.filter((r) => r[eq![0]] === eq![1])
        if (inFilter) rows = rows.filter((r) => (inFilter![1] as unknown[]).includes(r[inFilter![0]]))
        const data = range ? rows.slice(range[0], range[1] + 1) : rows.slice(0, 1000)
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return b
  }
  const client = { from: (table: string) => builder(table) } as unknown as SupabaseClient<Database>
  return { client, calls }
}

const PLUMBING = 'st-plumbing'
const parts = Array.from({ length: 1713 }, (_, i) => ({
  id: `p${String(i).padStart(4, '0')}`,
  name: `PART ${String(i).padStart(4, '0')}`,
  service_type_id: i < 1650 ? PLUMBING : 'st-electrical',
}))

describe('loadPartsCatalog', () => {
  it('pages past the 1000-row cap and returns every part for the service type', async () => {
    const { client, calls } = makeFakeSupabase({ material_parts: parts })
    const rows = await loadPartsCatalog<{ id: string }>(client, PLUMBING)
    expect(rows).toHaveLength(1650)
    expect(rows[1649]?.id).toBe('p1649')
    expect(calls.every((c) => c.ranged)).toBe(true)
    expect(calls).toHaveLength(2)
  })

  it('returns [] and stops after one page when the service type has no parts', async () => {
    const { client, calls } = makeFakeSupabase({ material_parts: parts })
    expect(await loadPartsCatalog(client, 'st-nothing')).toEqual([])
    expect(calls).toHaveLength(1)
  })
})

describe('loadWholePartsCatalog / loadWholePartPricesCatalog', () => {
  it('page every part across service types', async () => {
    const { client } = makeFakeSupabase({ material_parts: parts })
    expect(await loadWholePartsCatalog(client)).toHaveLength(1713)
  })

  it('page every price row', async () => {
    const prices = Array.from({ length: 2189 }, (_, i) => ({ id: `pr${i}`, part_id: `p${i % 1713}`, price: i }))
    const { client, calls } = makeFakeSupabase({ material_part_prices: prices })
    expect(await loadWholePartPricesCatalog(client, 'part_id, price')).toHaveLength(2189)
    expect(calls).toHaveLength(3)
  })
})

describe('loadPartsByIds', () => {
  it('fetches only the requested ids and returns [] for none', async () => {
    const { client, calls } = makeFakeSupabase({ material_parts: parts })
    expect(await loadPartsByIds(client, [])).toEqual([])
    expect(calls).toHaveLength(0)
    const rows = await loadPartsByIds<{ id: string }>(client, ['p1700', 'p0003'])
    expect(rows.map((r) => r.id).sort()).toEqual(['p0003', 'p1700'])
  })
})

describe('missingPartIds', () => {
  it('lists referenced ids the catalog lacks, once each, skipping bundle lines', () => {
    const catalog = [{ id: 'a' }, { id: 'b' }]
    const rows = [
      { partId: 'a' },
      { partId: 'zz' },
      { partId: null },
      { partId: '' },
      { partId: 'zz' },
      { partId: 'yy' },
    ]
    expect(missingPartIds(rows, catalog)).toEqual(['zz', 'yy'])
  })

  it('is empty when every referenced part is loaded', () => {
    expect(missingPartIds([{ partId: 'a' }], [{ id: 'a' }])).toEqual([])
  })
})

describe('mergeCatalogParts', () => {
  it('appends new parts in name order and never duplicates an id', () => {
    const catalog = [
      { id: '1', name: 'ADAPTER' },
      { id: '2', name: 'DEN52' },
    ]
    const merged = mergeCatalogParts(catalog, [
      { id: '2', name: 'DEN52' },
      { id: '9', name: 'K-25077-0 KINGSTON' },
      { id: '5', name: 'CAP' },
    ])
    expect(merged.map((p) => p.name)).toEqual(['ADAPTER', 'CAP', 'DEN52', 'K-25077-0 KINGSTON'])
  })

  it('returns the same array when nothing is new', () => {
    const catalog = [{ id: '1', name: 'A' }]
    expect(mergeCatalogParts(catalog, [{ id: '1', name: 'A' }])).toBe(catalog)
  })
})
