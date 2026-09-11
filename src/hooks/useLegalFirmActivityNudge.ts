import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { buildFirmActivity, type LegalEntryRow, type LegalFirmActivity, type LegalMatterRow } from '../lib/legal/legalMatters'

const db = supabase as unknown as SupabaseClient

/**
 * The office's "the law firm has N things for you" card (Legal portal PR 4):
 * unacknowledged entries the firm wrote through its portal — payments to
 * apply, questions to answer, fees and steps to acknowledge. Office roles
 * (RLS); refetch on focus; fail-soft before the migration.
 */
export function useLegalFirmActivityNudge(enabled: boolean): { activity: LegalFirmActivity | null; reload: () => void } {
  const [activity, setActivity] = useState<LegalFirmActivity | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setActivity(null)
      return
    }
    try {
      const [entriesRes, mattersRes] = await Promise.all([
        db.from('legal_matter_entries').select('id, matter_id, kind, amount, body, occurred_on, meta, via_portal, created_by, acknowledged_at, created_at').eq('via_portal', true).is('acknowledged_at', null).order('created_at', { ascending: false }).limit(200),
        db.from('legal_matters').select('*'),
      ])
      if (entriesRes.error || mattersRes.error) {
        setActivity(null)
        return
      }
      setActivity(buildFirmActivity((entriesRes.data ?? []) as LegalEntryRow[], (mattersRes.data ?? []) as LegalMatterRow[]))
    } catch {
      setActivity(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
    if (!enabled) return
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, load])
  return { activity, reload: () => void load() }
}
