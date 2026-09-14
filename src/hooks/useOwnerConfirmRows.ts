import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { parseOwnerToConfirmRows, type OwnerToConfirmRow } from '../lib/jobs/ownerConfirm'

/**
 * The rows behind the Pipeline's "Owner of record to confirm · N" chip
 * (v2.3447): `list_jobs_owner_to_confirm()` — every GC job with approved
 * hours whose property record has no confirmed owner. Gating lives in the
 * RPC (office roles; empty otherwise). Cheap enough to load with the other
 * fixup counts; the list modal reuses the same rows and calls `reload`
 * after each Use so the chip moves.
 */
export function useOwnerConfirmRows(enabled: boolean): { rows: OwnerToConfirmRow[]; loaded: boolean; reload: () => Promise<void> } {
  const [rows, setRows] = useState<OwnerToConfirmRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const load = useCallback(async () => {
    if (!enabled) {
      setRows([])
      setLoaded(false)
      return
    }
    try {
      const raw = await withSupabaseRetry(async () => await supabase.rpc('list_jobs_owner_to_confirm'), 'list jobs with an owner to confirm')
      setRows(parseOwnerToConfirmRows(raw))
    } catch {
      setRows([])
    }
    setLoaded(true)
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  return { rows, loaded, reload: load }
}
