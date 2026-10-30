/**
 * The Unpriced fixtures read (punch list #184 sweep B): only the fixtures nothing prices, oldest
 * first, paged, so PostgREST's 1,000-row cap can no longer drop the oldest.
 */
import { describe, expect, it, vi } from 'vitest'

const calls: Array<[string, unknown[]]> = []
const pages: unknown[][] = []
vi.mock('../supabase', () => {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'is', 'or', 'order']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args])
      return builder
    }
  }
  builder.range = (...args: unknown[]) => {
    calls.push(['range', args])
    return Promise.resolve({ data: pages.shift() ?? [], error: null })
  }
  return {
    supabase: {
      rpc: (...args: unknown[]) => {
        calls.push(['rpc', args])
        return builder
      },
    },
  }
})

import { loadUnpricedFixtureRows } from './unpricedFixturesIo'

describe('loadUnpricedFixtureRows', () => {
  it('asks the tally RPC for the unpriced fixtures only, oldest first, and pages past the cap', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ job_id: `j${i}`, part_id: null, fixture_cost: null, created_at: '2026-10-01T00:00:00Z' }))
    pages.push(full, [{ job_id: 'last', part_id: null, fixture_cost: 0, created_at: '2026-10-20T00:00:00Z' }])
    const rows = await loadUnpricedFixtureRows()
    expect(rows).toHaveLength(1001)
    expect(calls.slice(0, 8)).toEqual([
      ['rpc', ['list_tally_parts_with_po']],
      ['select', ['id, job_id, part_id, fixture_cost, created_at']],
      ['is', ['part_id', null]],
      ['or', ['fixture_cost.is.null,fixture_cost.eq.0']],
      ['order', ['created_at', { ascending: true }]],
      ['order', ['id', { ascending: true }]],
      ['range', [0, 999]],
      ['rpc', ['list_tally_parts_with_po']],
    ])
    expect(calls.filter(([m]) => m === 'range').map(([, a]) => a)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('selects every column it orders on, since PostgREST orders an RPC read only on what its select returns', async () => {
    // Ordering on `id` without selecting it answered 400 "column record.id does not exist" on every load (v2.5964 to v2.6125).
    calls.length = 0
    await loadUnpricedFixtureRows()
    const selected = String(calls.find(([m]) => m === 'select')?.[1][0]).split(',').map((c) => c.trim())
    const ordered = calls.filter(([m]) => m === 'order').map(([, a]) => String(a[0]))
    expect(ordered).toContain('id')
    expect(ordered.filter((c) => !selected.includes(c))).toEqual([])
  })
})
