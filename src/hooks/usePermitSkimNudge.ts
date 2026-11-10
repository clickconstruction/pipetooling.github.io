import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { supabase } from '../lib/supabase'
import type { UserRole } from './useAuth'
import type { NeedsYouInputs } from '../lib/dashboardNeedsYou'
import { nudgeAsks } from '../lib/research/permitBuilders'
import { DEFAULT_RESEARCH_CITY, DEFAULT_VALUE_FLOOR } from '../lib/research/permitResearch'
import { daysBetween } from '../lib/research/permitSkim'
import { todayYmdInAppTz } from '../utils/dateUtils'

// permit_skim_wait is newer than the generated types — untyped client (the sibling nudges' pattern).
const db = supabase as unknown as SupabaseClient

/**
 * The Permits skim's Needs you line (punch list #302): how many permits wait on a keep or a pass
 * and how long the oldest has, from `permit_skim_wait`. The Leader is asked every day there is
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
    try {
      const { data, error } = await db.rpc('permit_skim_wait', { p_city: DEFAULT_RESEARCH_CITY, p_floor: DEFAULT_VALUE_FLOOR })
      const row = (Array.isArray(data) ? data[0] : data) as { waiting?: number; oldest_on?: string | null } | null | undefined
      if (error || !row || !row.waiting || row.waiting <= 0) {
        setWait(null)
        return
      }
      const oldestDays = daysBetween(row.oldest_on ?? null, todayYmdInAppTz())
      setWait(nudgeAsks(role, oldestDays) ? { waiting: row.waiting, oldestDays } : null)
    } catch {
      setWait(null)
    }
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
