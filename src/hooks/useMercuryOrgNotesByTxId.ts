import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

const CHUNK = 400

/**
 * Loads `mercury_transaction_org_notes` for the given transaction IDs (batched).
 * RLS: dev / master_technician / assistant only (Banking).
 */
export function useMercuryOrgNotesByTxId(transactionIds: readonly string[]) {
  const idsKey = useMemo(() => {
    const u = [...new Set(transactionIds.filter(Boolean))]
    u.sort()
    return u.join('|')
  }, [transactionIds])

  const [map, setMap] = useState<Map<string, string>>(() => new Map())

  const load = useCallback(async () => {
    const ids = idsKey === '' ? [] : idsKey.split('|')
    if (ids.length === 0) {
      setMap(new Map())
      return
    }
    const next = new Map<string, string>()
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK)
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_transaction_org_notes')
          .select('mercury_transaction_id, body')
          .in('mercury_transaction_id', chunk)
      }, 'load mercury_transaction_org_notes banking')
      for (const row of data ?? []) {
        if (row.mercury_transaction_id) next.set(row.mercury_transaction_id, row.body ?? '')
      }
    }
    setMap(next)
  }, [idsKey])

  useEffect(() => {
    void load().catch(() => {
      setMap(new Map())
    })
  }, [load])

  const updateOrgNoteLocal = useCallback((txId: string, body: string) => {
    setMap((prev) => {
      const m = new Map(prev)
      const t = body.trim()
      if (t === '') m.delete(txId)
      else m.set(txId, t)
      return m
    })
  }, [])

  return { orgNotesByTxId: map, refetchOrgNotes: load, updateOrgNoteLocal }
}
