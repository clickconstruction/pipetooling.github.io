import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Has the office shown the signed-in teammate their logbook (punch list #255, v2.6483)? Reads their own
 * `logbook_shares` row, which RLS lets them see. Drives the My logbook row in the gear menu. A failed read
 * leaves the row off: the page itself says why when opened.
 */
export function useOwnLogbookShown(userId: string | null | undefined): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!userId) {
      setShown(false)
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.from('logbook_shares' as never).select('user_id').eq('user_id', userId).maybeSingle()
      if (!cancelled) setShown(!error && Boolean(data))
    })()
    return () => {
      cancelled = true
    }
  }, [userId])
  return shown
}
