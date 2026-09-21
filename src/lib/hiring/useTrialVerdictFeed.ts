/**
 * Try-out loop, PR 2: the feed both doors read — `trial_helpers_i_led_today()` as cards.
 * Only roles that can run a job ever get rows (the RPC is empty for everyone else), so the
 * hook does not call it for them at all.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { buildTrialVerdictCards, type TrialVerdictCard, type TrialVerdictFeedRow } from './trialVerdicts'

/** Roles the Supervision rule can ever make a supervisor (src/lib/people/supervision.ts). */
const CAN_LEAD_ROLES = new Set(['master_technician', 'helpers', 'subcontractor'])

export function canEverLeadTrialHelper(role: string | null | undefined): boolean {
  return role != null && CAN_LEAD_ROLES.has(role)
}

/** Fetch once, outside React — the clock-out path asks right after the punch lands. */
export async function fetchTrialVerdictFeed(includeOpen: boolean): Promise<TrialVerdictFeedRow[]> {
  const data = await withSupabaseRetry(() => supabase.rpc('trial_helpers_i_led_today', { p_include_open: includeOpen }), 'trial_helpers_i_led_today')
  return Array.isArray(data) ? (data as unknown as TrialVerdictFeedRow[]) : []
}

export function useTrialVerdictFeed(opts: { enabled: boolean; includeOpen: boolean }): { cards: TrialVerdictCard[]; loaded: boolean; reload: () => Promise<void> } {
  const { enabled, includeOpen } = opts
  const prefixMap = useLedgerPrefixMap()
  const today = useMemo(() => todayYmdInAppTz(), [])
  const [rows, setRows] = useState<TrialVerdictFeedRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      setRows(await fetchTrialVerdictFeed(includeOpen))
    } catch {
      // The card is a prompt, not a page: a failed read shows nothing rather than an error.
      setRows([])
    } finally {
      setLoaded(true)
    }
  }, [enabled, includeOpen])

  useEffect(() => {
    void reload()
  }, [reload])

  const cards = useMemo(() => buildTrialVerdictCards(rows, { todayYmd: today, prefixMap }), [rows, today, prefixMap])
  return { cards, loaded, reload }
}
