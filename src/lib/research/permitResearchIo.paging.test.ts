import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Permits reads past PostgREST's 1,000 (punch list #307): with a year of records Builders holds
 * 1,227 names in San Antonio, and an un-ranged read quietly dropped the rest.
 */
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { rpc } }))

import { loadBuilders, loadResearchPermits } from './permitResearchIo'

/** An RPC that answers each range from `rows`, or with `error` on every call. */
function answers(rows: unknown[] | null, error: { code: string; message: string } | null = null) {
  return () => ({
    range: (from: number, to: number) => Promise.resolve(error ? { data: null, error, status: 404 } : { data: (rows ?? []).slice(from, to + 1), error: null, status: 200 }),
  })
}

const builders = Array.from({ length: 1227 }, (_, i) => ({ key: `b${i}`, permits: 1227 - i }))

describe('the Permits reads past 1,000 rows', () => {
  beforeEach(() => rpc.mockReset())

  it('reads every builder, a page at a time', async () => {
    rpc.mockImplementation(answers(builders))
    const rows = await loadBuilders('San Antonio')
    expect(rows).toHaveLength(1227)
    expect(rows?.[1226]).toEqual({ key: 'b1226', permits: 1 })
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc).toHaveBeenCalledWith('research_builders', { p_city: 'San Antonio' })
  })

  it('is null while the read is not on the database yet, and says why on any other refusal', async () => {
    rpc.mockImplementation(answers(null, { code: 'PGRST202', message: 'Could not find the function public.research_builders' }))
    expect(await loadBuilders('San Antonio')).toBeNull()
    rpc.mockImplementation(answers(null, { code: '57014', message: 'canceling statement due to statement timeout' }))
    await expect(loadBuilders('San Antonio')).rejects.toThrow(/Could not read the builders: .*statement timeout/)
  })

  it('reads every permit on the skim with houses, and falls back to the first read before v2 is in', async () => {
    const permits = Array.from({ length: 1912 }, (_, i) => ({ id: `p${i}` }))
    rpc.mockImplementation(answers(permits))
    expect(await loadResearchPermits('San Antonio', '2026-08-12', true)).toHaveLength(1912)
    rpc.mockReset()
    rpc.mockImplementation((fn: string) => (fn === 'research_permits_v2' ? answers(null, { code: 'PGRST202', message: 'Could not find the function' })() : answers(permits.slice(0, 5))()))
    expect(await loadResearchPermits('San Antonio', '2026-08-12', false)).toHaveLength(5)
  })
})
