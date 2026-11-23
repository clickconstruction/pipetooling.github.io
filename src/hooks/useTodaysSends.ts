import { useCallback, useEffect, useState } from 'react'
import type { TodaysSendsNeed } from '../lib/offers/offers'

export type { TodaysSendsNeed }

/**
 * Today's sends (v2.5595, punch list #115): the Needs you row, beside `useCustomerMessagesCounts` and built the
 * same way. Since punch list #424 the kernel writes the whole row from the texts (`todaysSendsNeed`). The offers
 * kernel and its reads load on demand, only when the line is on, so the Dashboard's own chunk does not grow. Null while off, loading, or when nothing waits. Refetches on window focus like the neighbouring nudges, and
 * on `reload` after the window sent, held or put a text away.
 */
export function useTodaysSends(enabled: boolean): { need: TodaysSendsNeed | null; reload: () => void } {
  const [need, setNeed] = useState<TodaysSendsNeed | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setNeed(null)
      return
    }
    try {
      const [{ supabaseOffersIo }, { todaysSends, todaysSendsNeed }] = await Promise.all([import('../lib/offers/offersIo'), import('../lib/offers/offers')])
      setNeed(todaysSendsNeed(todaysSends(await supabaseOffersIo().loadOpen())))
    } catch {
      setNeed(null)
    }
  }, [enabled])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])
  return { need, reload: () => void load() }
}
