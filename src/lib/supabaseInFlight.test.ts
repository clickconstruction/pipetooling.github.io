import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetSupabaseInFlightForTests, SUPABASE_QUIET_MS, subscribeSupabaseInFlight, supabaseInFlightCount, wrapFetchCountingInFlight } from './supabaseInFlight'

afterEach(() => __resetSupabaseInFlightForTests())

describe('wrapFetchCountingInFlight (punch list #365, v2.8616)', () => {
  it('counts every request while it runs, a read as much as a write, and tells subscribers each way', async () => {
    const resolvers: Array<(r: Response) => void> = []
    const inner = vi.fn(() => new Promise<Response>((r) => resolvers.push(r)))
    const told: number[] = []
    const off = subscribeSupabaseInFlight(() => told.push(supabaseInFlightCount()))
    const f = wrapFetchCountingInFlight(inner)
    const get = f('https://x/rest/v1/rows', { method: 'GET' })
    expect(supabaseInFlightCount()).toBe(1)
    const post = f('https://x/rest/v1/rpc/save', { method: 'POST' })
    expect(supabaseInFlightCount()).toBe(2)
    for (const r of resolvers) r(new Response('{}'))
    await Promise.all([get, post])
    expect(supabaseInFlightCount()).toBe(0)
    expect(told).toEqual([1, 2, 1, 0])
    off()
  })
  it('a request that fails still releases the count', async () => {
    const f = wrapFetchCountingInFlight(() => Promise.reject(new Error('offline')))
    await expect(f('https://x/rest/v1/rows')).rejects.toThrow('offline')
    expect(supabaseInFlightCount()).toBe(0)
  })
  it('the quiet window is a few renders long, well under the cap the page keeps', () => {
    expect(SUPABASE_QUIET_MS).toBe(300)
  })
})
