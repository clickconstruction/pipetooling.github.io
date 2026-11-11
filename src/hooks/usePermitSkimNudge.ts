import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { UserRole } from './useAuth'
import type { NeedsYouInputs } from '../lib/dashboardNeedsYou'
import { nudgeAsks, sumCityWaits } from '../lib/research/permitBuilders'
import { DEFAULT_VALUE_FLOOR, RESEARCH_CITIES } from '../lib/research/permitResearch'
import { daysBetween } from '../lib/research/permitSkim'
import { todayYmdInAppTz } from '../utils/dateUtils'

// permit_skim_wait is newer than the generated types — untyped client (the sibling nudges' pattern).
const db = supabase as unknown as SupabaseClient

/**
 * The Permits skim's Needs you line (punch list #302): how many permits wait on an answer in every
 * city the pull reads and how long the oldest has, from `permit_skim_wait`. The cities are read one
 * at a time, since each is a heavy read, and a city that cannot be read is left out while the rest
 * are counted. The Leader is asked every day there is
 * something to skim; the rest of the people who may skim once a permit has waited two days
 * (`nudgeAsks`). Null while disabled, loading, when nothing waits, when this role is not asked
 * yet, and before the migration that makes the read is pushed. Refetches on window focus.
 */
export function usePermitSkimNudge(enabled: boolean, role: UserRole | null): NonNullable<NeedsYouInputs['permitSkim']> | null {
  const [wait, setWait] = useState<NonNullable<NeedsYouInputs['permitSkim']> | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setWait(null)
      return
    }
    const today = todayYmdInAppTz()
    const rows: Array<{ city: string; waiting: number; oldestDays: number | null }> = []
    for (const city of RESEARCH_CITIES) {
      try {
        const { data, error } = await db.rpc('permit_skim_wait', { p_city: city, p_floor: DEFAULT_VALUE_FLOOR })
        const row = (Array.isArray(data) ? data[0] : data) as { waiting?: number; oldest_on?: string | null } | null | undefined
        if (error || !row || !row.waiting || row.waiting <= 0) continue
        rows.push({ city, waiting: row.waiting, oldestDays: daysBetween(row.oldest_on ?? null, today) })
      } catch {
        // One city that cannot be read does not hide the others.
      }
    }
    const all = sumCityWaits(rows)
    setWait(all.waiting > 0 && nudgeAsks(role, all.oldestDays) ? all : null)
  }, [enabled, role])

  useEffect(() => {
    void load()
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, enabled])

  return wait
}
