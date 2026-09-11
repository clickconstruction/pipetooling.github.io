import { describe, expect, it } from 'vitest'
import { buildJobDayLedger, type JobDayLedger } from './jobDayLedger'
import { JOB_DAY_LEDGER_CACHE_TTL_MS, jobDayLedgerCacheKey, loadJobDayLedgerCached, readCachedJobDayLedger, writeCachedJobDayLedger, type JobDayLedgerCacheStorage } from './jobDayLedgerSessionCache'
import { ymdAddDays } from '../../utils/dateUtils'

function fakeStorage(): JobDayLedgerCacheStorage & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) }
}

function ledger(startYmd = '2026-06-01', endYmd = '2026-06-03'): JobDayLedger {
  return buildJobDayLedger({
    startYmd,
    endYmd,
    officeJobLedgerId: 'office',
    fieldDetailByDay: new Map([[startYmd, [{ sessionId: 's1', workDate: startYmd, userName: 'A', hours: 4, laborUsd: 100, missingWage: false, jobLedgerId: 'j1', notes: null }]]]),
    poolUsdByDay: new Map([[startYmd, 80]]),
    addDays: ymdAddDays,
  })
}

describe('jobDayLedgerSessionCache (v2.3289)', () => {
  it('keys carry the version, user and window', () => {
    expect(jobDayLedgerCacheKey('u1', '2026-06-01', '2026-06-03')).toBe('jobDayLedger:v5:u1:2026-06-01:2026-06-03')
  })

  it('round-trips a ledger and expires it after the TTL', () => {
    const storage = fakeStorage()
    const key = jobDayLedgerCacheKey('u1', '2026-06-01', '2026-06-03')
    writeCachedJobDayLedger(key, ledger(), { storage, nowMs: 1000 })
    const hit = readCachedJobDayLedger(key, { storage, nowMs: 1000 + JOB_DAY_LEDGER_CACHE_TTL_MS - 1 })!
    expect(hit.totals.poolUsd).toBe(80)
    expect(hit.jobs.get('j1')?.hours).toBe(4)
    expect(readCachedJobDayLedger(key, { storage, nowMs: 1000 + JOB_DAY_LEDGER_CACHE_TTL_MS })).toBeNull()
    expect(readCachedJobDayLedger('missing', { storage })).toBeNull()
    storage.map.set('bad', '{not json')
    expect(readCachedJobDayLedger('bad', { storage })).toBeNull()
    expect(readCachedJobDayLedger(key, { storage: null })).toBeNull()
  })

  it('loads once for concurrent callers, caches the result, and serves the next call from the cache', async () => {
    const storage = fakeStorage()
    let loads = 0
    let release: (l: JobDayLedger | null) => void = () => {}
    const load = () => {
      loads += 1
      return new Promise<JobDayLedger | null>((res) => {
        release = res
      })
    }
    const args = { userId: 'u1', startYmd: '2026-06-01', endYmd: '2026-06-03', load, storage, nowMs: 5000 }
    const a = loadJobDayLedgerCached(args)
    const b = loadJobDayLedgerCached(args)
    expect(loads).toBe(1)
    release(ledger())
    const [ra, rb] = await Promise.all([a, b])
    expect(ra?.totals.poolUsd).toBe(80)
    expect(rb).toBe(ra)
    // Third call: a cache hit, no load.
    const c = await loadJobDayLedgerCached({ ...args, load: () => Promise.reject(new Error('should not load')) })
    expect(c?.totals.poolUsd).toBe(80)
    expect(loads).toBe(1)
    // bypassRead forces a reload and rewrites the cache; a null result is not cached.
    let nullLoads = 0
    const d = await loadJobDayLedgerCached({ ...args, bypassRead: true, load: () => { nullLoads += 1; return Promise.resolve(null) } })
    expect(d).toBeNull()
    expect(nullLoads).toBe(1)
    expect(readCachedJobDayLedger(jobDayLedgerCacheKey('u1', '2026-06-01', '2026-06-03'), { storage, nowMs: 5000 })?.totals.poolUsd).toBe(80)
  })

  it('a failed load clears the in-flight slot so the next call retries', async () => {
    const storage = fakeStorage()
    const args = { userId: 'u2', startYmd: '2026-06-01', endYmd: '2026-06-03', storage }
    await expect(loadJobDayLedgerCached({ ...args, load: () => Promise.reject(new Error('boom')) })).rejects.toThrow('boom')
    const ok = await loadJobDayLedgerCached({ ...args, load: () => Promise.resolve(ledger()) })
    expect(ok?.totals.poolUsd).toBe(80)
  })
})
