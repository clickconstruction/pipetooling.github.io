import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { from: () => ({}), rpc: () => ({}) } }))

const retrySpy = vi.hoisted(() => vi.fn())
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: retrySpy,
}))

import { fetchJobFollowupCandidates, invalidateJobFollowupCandidatesCache } from './jobFollowupStore'

/** Two queries per uncached fetch: 'followup jobs' + 'followup activity'. */
function stubQueries() {
  retrySpy.mockImplementation(async (_op: unknown, name: string) => {
    if (name === 'followup jobs') {
      return [
        {
          id: 'j1',
          hcp_number: '100',
          job_name: 'Job One',
          job_address: '1 Main',
          status: 'working',
          customer_name: null,
          pct_complete: null,
          revenue: null,
          payments_made: null,
        },
      ]
    }
    if (name === 'followup activity') {
      return [{ job_id: 'j1', latest_activity_at: '2026-08-01T00:00:00Z', next_scheduled_on: null }]
    }
    throw new Error(`unexpected query: ${name}`)
  })
}

describe('fetchJobFollowupCandidates cache (v2.1920)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T12:00:00Z'))
    retrySpy.mockReset()
    stubQueries()
    invalidateJobFollowupCandidatesCache()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('serves repeat calls within the TTL from one fetch', async () => {
    const a = await fetchJobFollowupCandidates('2026-08-20')
    const b = await fetchJobFollowupCandidates('2026-08-20')
    expect(a).toEqual(b)
    expect(a[0]?.id).toBe('j1')
    expect(retrySpy).toHaveBeenCalledTimes(2)
  })

  it('force bypasses and refreshes the cache', async () => {
    await fetchJobFollowupCandidates('2026-08-20')
    await fetchJobFollowupCandidates('2026-08-20', { force: true })
    expect(retrySpy).toHaveBeenCalledTimes(4)
    // The forced result reprimed the cache for later callers.
    await fetchJobFollowupCandidates('2026-08-20')
    expect(retrySpy).toHaveBeenCalledTimes(4)
  })

  it('expires after the TTL and misses on a different day key', async () => {
    await fetchJobFollowupCandidates('2026-08-20')
    vi.setSystemTime(new Date('2026-08-20T12:06:00Z'))
    await fetchJobFollowupCandidates('2026-08-20')
    expect(retrySpy).toHaveBeenCalledTimes(4)
    await fetchJobFollowupCandidates('2026-08-21')
    expect(retrySpy).toHaveBeenCalledTimes(6)
  })

  it('a failed fetch does not poison the cache window', async () => {
    retrySpy.mockRejectedValueOnce(new Error('down'))
    // First call: jobs query rejects; the RPC arm is caught internally, the
    // whole fetch rejects, and the cache entry self-clears.
    await expect(fetchJobFollowupCandidates('2026-08-20')).rejects.toThrow('down')
    stubQueries()
    const again = await fetchJobFollowupCandidates('2026-08-20')
    expect(again[0]?.id).toBe('j1')
  })
})
