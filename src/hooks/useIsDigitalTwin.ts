import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Digital twins Phase T1 (docs/DIGITAL_TWINS_PLAN.md): is the signed-in account a flagged
 * twin? Separate fail-soft query — `users.is_digital_twin` may not be deployed yet (client
 * ships ahead of the migration), and a missing column must mean "not a twin", never a
 * broken app (Banking quirk-#17 pattern). Cached per session; twins don't un-flag mid-run.
 */
export function useIsDigitalTwin(): boolean {
  const { user } = useAuth()
  const [isTwin, setIsTwin] = useState(false)
  useEffect(() => {
    setIsTwin(false)
    const uid = user?.id
    if (!uid) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await (supabase as never as {
          from: (t: string) => {
            select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { is_digital_twin?: boolean } | null; error: unknown }> } }
          }
        })
          .from('users')
          .select('is_digital_twin')
          .eq('id', uid)
          .maybeSingle()
        if (cancelled || error) return
        setIsTwin(data?.is_digital_twin === true)
      } catch {
        /* column not deployed yet → not a twin */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])
  return isTwin
}
