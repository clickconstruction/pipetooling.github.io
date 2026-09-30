import type { VectorTimeMode } from './vectorDays'

export const VECTOR_DAYS_MODE_KEY = 'bridge_vector_days_mode_v1' as const

/**
 * Which reading of time Vectors by the day draws (v2.4221): `recorded` by
 * default — every closed session not rejected or revoked, so this week is
 * not blank while approvals catch up (job costing's rule since v2.3178) —
 * or `approved`, what payroll paid (Vectors' own pay-week table stays on
 * that rule whatever this says). Remembered per browser.
 */
export function readVectorDaysMode(): VectorTimeMode {
  try {
    if (typeof localStorage === 'undefined') return 'recorded'
    return localStorage.getItem(VECTOR_DAYS_MODE_KEY) === 'approved' ? 'approved' : 'recorded'
  } catch {
    return 'recorded'
  }
}

export function writeVectorDaysMode(mode: VectorTimeMode): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(VECTOR_DAYS_MODE_KEY, mode)
  } catch {
    // ignore quota / private mode
  }
}
