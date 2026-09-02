import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Division 22 Needs You feed (v2.2627): how many distinct fixture names match
 * no rule in the spec-section ledger — one server-side count via the
 * `spec_section_uncoded_name_count` RPC (SECURITY DEFINER, role-gated inside).
 * Deliberate no-code rules count as handled, matching the classify kernel.
 * Any failure reads as 0 so the dashboard never breaks on a ledger hiccup.
 */
export function useSpecSectionUncodedCount(enabled: boolean): { uncoded: number } {
  const [uncoded, setUncoded] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('spec_section_uncoded_name_count')
        if (error) throw new Error(error.message)
        if (!cancelled) setUncoded(typeof data === 'number' ? data : 0)
      } catch {
        if (!cancelled) setUncoded(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { uncoded }
}
