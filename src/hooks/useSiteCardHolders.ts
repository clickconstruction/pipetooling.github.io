import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCardHolders } from '../lib/developments/fetchCardHolders'
import type { CardHoldersRead } from '../lib/developments/cardHolders'

/**
 * Who holds the card each counted charge on a site went on, for the Scoreboard's card rows
 * (v2.6457). `enabled` false, or no charge, reads nothing and gives `off`; a read that fails says so,
 * and the board keeps one *Card* row for the job instead of the holders.
 */
export function useSiteCardHolders(txIds: ReadonlyArray<string>, enabled: boolean): CardHoldersRead {
  const key = useMemo(() => (enabled && txIds.length ? [...new Set(txIds)].sort().join(',') : ''), [txIds, enabled])
  const [state, setState] = useState<{ key: string; read: CardHoldersRead } | null>(null)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    void (async () => {
      try {
        const byTxId = await fetchCardHolders(supabase, key.split(','))
        if (!cancelled) setState({ key, read: { state: 'read', byTxId } })
      } catch {
        if (!cancelled) setState({ key, read: { state: 'failed' } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key])

  if (!key) return { state: 'off' }
  return state && state.key === key ? state.read : { state: 'reading' }
}
