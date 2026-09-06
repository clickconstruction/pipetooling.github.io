import { describe, expect, it } from 'vitest'

import { crewPnlJobsUniverseNotice } from './crewPnlJobsUniverse'

const at = (ms: number) => `T${ms}`

describe('crewPnlJobsUniverseNotice (B8, J8-F5)', () => {
  it('says nothing once the complete job list is in', () => {
    expect(crewPnlJobsUniverseNotice({ status: 'complete', count: 4200 }, at)).toBeNull()
  })

  it('while loading, a muted line admits the figures come from the page cache', () => {
    const n = crewPnlJobsUniverseNotice({ status: 'loading' }, at)
    expect(n?.tone).toBe('muted')
    expect(n?.canRetry).toBe(false)
    expect(n?.text).toMatch(/page cache/)
  })

  it('after a failed page, a warning names the time, the reason, the cached count and offers Refresh', () => {
    const n = crewPnlJobsUniverseNotice(
      { status: 'failed', failedAtMs: 1234, cachedCount: 812, message: 'timeout' },
      at,
    )
    expect(n?.tone).toBe('warning')
    expect(n?.canRetry).toBe(true)
    expect(n?.text).toBe(
      "Showing cached figures from T1234 — the complete job list didn't load (timeout), so these rows use 812 cached jobs and paid jobs may be missing. Billed and Profit can read low. Refresh to retry.",
    )
  })

  it('omits the parenthetical when the error carried no message, and pluralizes one job', () => {
    const n = crewPnlJobsUniverseNotice({ status: 'failed', failedAtMs: 9, cachedCount: 1, message: '  ' }, at)
    expect(n?.text).toContain("didn't load, so these rows use 1 cached job and")
  })
})
