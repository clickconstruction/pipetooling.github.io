import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { TALLY_STALE_MIN_AGE_DAYS } from '../lib/tallyStaleMinAgeDays'

export type TallyUnlinkedCounts = {
  /** Every unlinked Mercury row on the viewer's cards — the tally icon badge and `/tally`'s "N unlinked". */
  unlinked: number | null
  /** The subset over `minAgeDays` old — the Needs You "N purchases need a job" figure. */
  staleUnlinked: number | null
  minAgeDays: number
  refetch: () => void
}

/**
 * The two Job Parts Tally counts (v2.2896, journey-map Tier-2 #16): one hook
 * behind the Dashboard tally badge, the Needs You `tally-self` card, Quickfill's
 * Needs You twin AND the `/tally` page header, so the card's "100 need a job"
 * and the page's "105 unlinked" are read from the same two RPCs at the same
 * moment — and the page can say both numbers in the card's own words.
 *
 * Both RPCs are SECURITY DEFINER and scoped to the caller's linked debit cards;
 * the stale one adds the Chicago calendar-day age filter. A failed read leaves
 * that count null (nothing rendered) rather than 0 (a false "all sorted").
 * Re-reads on window focus so a sort in another tab shows up on return.
 */
export function useTallyUnlinkedCounts(enabled: boolean, minAgeDays: number = TALLY_STALE_MIN_AGE_DAYS): TallyUnlinkedCounts {
  const [unlinked, setUnlinked] = useState<number | null>(null)
  const [staleUnlinked, setStaleUnlinked] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    const [total, stale] = await Promise.all([
      withSupabaseRetry(
        async () => await supabase.rpc('count_unlinked_mercury_transactions_for_tally'),
        'count unlinked tally transactions',
      ).then(
        (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0),
        () => null,
      ),
      withSupabaseRetry(
        async () =>
          await supabase.rpc('count_unlinked_mercury_transactions_for_tally_stale', { min_age_days: minAgeDays }),
        'count stale unlinked tally transactions',
      ).then(
        (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0),
        () => null,
      ),
    ])
    setUnlinked(total)
    setStaleUnlinked(stale)
  }, [enabled, minAgeDays])

  useEffect(() => {
    if (!enabled) {
      setUnlinked(null)
      setStaleUnlinked(null)
      return
    }
    void load()
  }, [enabled, load])

  useEffect(() => {
    if (!enabled) return
    const onFocus = () => {
      void load()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [enabled, load])

  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { unlinked, staleUnlinked, minAgeDays, refetch }
}
