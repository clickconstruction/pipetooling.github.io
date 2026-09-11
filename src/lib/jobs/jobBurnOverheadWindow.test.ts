import { describe, expect, it } from 'vitest'
import { JOB_BURN_OVERHEAD_WINDOW_HARD_CAP_DAYS, jobBurnOverheadWindow } from './jobBurnOverheadWindow'
import { OVERHEAD_POOL_FIRST_YMD } from './overheadAllocation'
import { ymdAddDays } from '../../utils/dateUtils'

describe('jobBurnOverheadWindow (v2.3289)', () => {
  const today = '2026-09-11'

  it('every job loads the same window — the pool\'s first day to today — so job windows share one cached ledger', () => {
    expect(jobBurnOverheadWindow('2026-04-17', today)).toEqual({ startYmd: OVERHEAD_POOL_FIRST_YMD, endYmd: today, sinceYmd: null })
    expect(jobBurnOverheadWindow(null, today)).toEqual({ startYmd: OVERHEAD_POOL_FIRST_YMD, endYmd: today, sinceYmd: null })
  })

  it('a job older than the pool says where its overhead starts', () => {
    expect(jobBurnOverheadWindow('2025-11-03', today)).toEqual({ startYmd: OVERHEAD_POOL_FIRST_YMD, endYmd: today, sinceYmd: OVERHEAD_POOL_FIRST_YMD })
  })

  it('the hard cap takes over once the pool is older than it', () => {
    const farFuture = ymdAddDays(OVERHEAD_POOL_FIRST_YMD, JOB_BURN_OVERHEAD_WINDOW_HARD_CAP_DAYS + 100)
    const w = jobBurnOverheadWindow('2026-03-01', farFuture)
    expect(w.startYmd).toBe(ymdAddDays(farFuture, -JOB_BURN_OVERHEAD_WINDOW_HARD_CAP_DAYS))
    expect(w.sinceYmd).toBe(w.startYmd)
    expect(jobBurnOverheadWindow(w.startYmd, farFuture).sinceYmd).toBeNull()
  })
})
