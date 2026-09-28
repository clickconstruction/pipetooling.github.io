import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isQuickEstimateRole } from '../components/estimates/QuickEstimateWizard'

/**
 * Whether this person's Write up a change doors are on (v2.4057): the field-role check plus the
 * per-user opt-in row (`user_dashboard_buttons`, key `quick_estimate`, default off — Settings →
 * Dashboard & alerts). One read for every door: the My Schedule block square and foot link
 * (v2.4047), the Job window's header icon and the Job Mode card's link (v2.4057).
 */
export function useQuickEstimateDoor(userId: string | null | undefined, role: string | null | undefined): boolean {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    if (!userId || !isQuickEstimateRole(role)) {
      setEnabled(false)
      return
    }
    let cancelled = false
    supabase
      .from('user_dashboard_buttons')
      .select('visible')
      .eq('user_id', userId)
      .eq('button_key', 'quick_estimate')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEnabled((data as { visible?: boolean } | null)?.visible === true)
      })
    return () => {
      cancelled = true
    }
  }, [userId, role])
  return enabled
}
