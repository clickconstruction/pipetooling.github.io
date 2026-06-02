/**
 * Share Schedule day-set math — client mirror of supabase/functions/_shared/scheduleShareCore.ts.
 * Keep the two in sync; this copy powers the modal preview and is unit-tested.
 */

import { ymdAddDays } from '../utils/dateUtils'

export type ShareScope = 'none' | 'next_day' | 'rest_of_week'

export interface ShareDayConfig {
  includeCurrentDay: boolean
  scope: ShareScope
}

/** 0=Sun … 6=Sat for a pure `YYYY-MM-DD` (timezone-agnostic). Returns 0 on parse failure. */
export function dowSun0FromYmd(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return 0
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCDay()
}

/**
 * Work dates a share email covers, relative to `baseYmd`:
 * - current day → `baseYmd` (when includeCurrentDay)
 * - next_day → baseYmd + 1
 * - rest_of_week → baseYmd + 1 .. the coming Sunday (week ends Sunday; empty when baseYmd is Sunday)
 * Returns a sorted, de-duplicated ascending list.
 */
export function computeShareDates(baseYmd: string, config: ShareDayConfig): string[] {
  const set = new Set<string>()
  if (config.includeCurrentDay) set.add(baseYmd)
  if (config.scope === 'next_day') {
    set.add(ymdAddDays(baseYmd, 1))
  } else if (config.scope === 'rest_of_week') {
    const dow = dowSun0FromYmd(baseYmd)
    const daysUntilSunday = (7 - dow) % 7 // 0 when baseYmd is Sunday
    for (let i = 1; i <= daysUntilSunday; i += 1) {
      set.add(ymdAddDays(baseYmd, i))
    }
  }
  return [...set].sort()
}

/** At least one day-set selected; next_day/rest_of_week are mutually exclusive (encoded by `scope`). */
export function isShareConfigValid(config: ShareDayConfig): boolean {
  return config.includeCurrentDay || config.scope !== 'none'
}
