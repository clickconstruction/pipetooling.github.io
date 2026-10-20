import { useCallback, useEffect, useState } from 'react'

/** The Dashboard's Today's sends line: how many texts wait, and the line that says ready, morning and held. */
export interface TodaysSendsNeed {
  count: number
  line: string
}

/**
 * Today's sends (v2.5595, punch list #115): the Needs you line's count, beside `useCustomerMessagesCounts` and built the
 * same way. The offers kernel and its reads load on demand, only when the line is on, so the Dashboard's own chunk does
 * not grow. Null while off, loading, or when nothing waits. Refetches on window focus like the neighbouring nudges, and
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
      const [{ supabaseOffersIo }, { todaysSends, todaysSendsLine }] = await Promise.all([import('../lib/offers/offersIo'), import('../lib/offers/offers')])
      const rows = todaysSends(await supabaseOffersIo().loadOpen())
      setNeed(rows.length ? { count: rows.length, line: todaysSendsLine(rows) } : null)
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
