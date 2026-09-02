import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { splitLienSignatureLanes, type LienInboxRow, type LienSignatureLanes } from '../lib/jobs/lienReleaseInboxLanes'

/**
 * Fetches this user's two lien-signature lanes (v2.2621) — releases awaiting
 * MY signature, and releases I requested that are signed but unsent. One
 * or-query, fail-soft (empty lanes on error), refetch on demand.
 */
export function useLienSignatureLanes(enabled: boolean): {
  lanes: LienSignatureLanes
  loading: boolean
  refetch: () => void
} {
  const { user } = useAuth()
  const [lanes, setLanes] = useState<LienSignatureLanes>({ toSign: [], toSend: [] })
  const [loading, setLoading] = useState(false)
  const [gen, setGen] = useState(0)

  const refetch = useCallback(() => setGen((g) => g + 1), [])

  useEffect(() => {
    if (!enabled || !user?.id) {
      setLanes({ toSign: [], toSend: [] })
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('job_lien_releases')
          .select('*, job:jobs_ledger(id, job_name, hcp_number, click_number, customer_email)')
          .is('voided_at', null)
          .or(`signer_user_id.eq.${user.id},signature_requested_by.eq.${user.id}`)
          .in('status', ['awaiting_signature', 'signed'])
        if (error) throw error
        if (cancelled) return
        setLanes(splitLienSignatureLanes((data ?? []) as LienInboxRow[], user.id))
      } catch {
        if (!cancelled) setLanes({ toSign: [], toSend: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, user?.id, gen])

  return { lanes, loading, refetch }
}
