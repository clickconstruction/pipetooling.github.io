import { ymdAddDays } from '../../utils/dateUtils'
import { OVERHEAD_POOL_FIRST_YMD } from './overheadAllocation'

/** Burn's per-field-day rate stays a RECENT rate (the last N days) while the share to date covers the whole window (v2.3289). */
export const JOB_BURN_OVERHEAD_RATE_DAYS = 120
/** A safety ceiling on the company-wide scan; the office pool's first day is the floor that matters today. */
export const JOB_BURN_OVERHEAD_WINDOW_HARD_CAP_DAYS = 730

export type JobBurnOverheadWindow = {
  startYmd: string
  endYmd: string
  /** When the window's start cut off part of the job's history: the first day charged. Null when nothing was cut. */
  sinceYmd: string | null
}

/**
 * The window a job's overhead loads over (v2.3289; before it, [first charge … today]
 * capped at 120 days): the office pool's first day → today, bounded by the hard cap.
 * The SAME window for every job, on purpose — carry lands on a job from its Working
 * move, which can precede its first charge by weeks, and one shared window means every
 * job window in a session reads ONE cached ledger. There is no office cost to find
 * before the pool's first day, so nothing is lost by not starting earlier.
 */
export function jobBurnOverheadWindow(firstEventYmd: string | null, todayYmd: string): JobBurnOverheadWindow {
  const hardFloor = ymdAddDays(todayYmd, -JOB_BURN_OVERHEAD_WINDOW_HARD_CAP_DAYS)
  const startYmd = OVERHEAD_POOL_FIRST_YMD > hardFloor ? OVERHEAD_POOL_FIRST_YMD : hardFloor
  const sinceYmd = firstEventYmd != null && firstEventYmd < startYmd ? startYmd : null
  return { startYmd, endYmd: todayYmd, sinceYmd }
}
