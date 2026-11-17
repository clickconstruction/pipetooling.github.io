import { useCallback, useEffect, useState } from 'react'
import { supabaseSupplyFinishIo } from '../lib/materials/payments/supplyPaymentsFinishIo'

/**
 * The finish-later list's Needs You line (the owner's call 4, 2026-11-16): how many supply house payments still
 * need how they were paid. Mark paid on a bill stays one press; without a count, later never comes.
 *
 * The tables' policies do the gating: a caller who is not the office reads zero. Null while loading, disabled, at
 * zero, or when the read fails (no line). Refetches on window focus.
 */
export function useSupplyPaymentsToFinishNudge(enabled: boolean): { toFinish: { count: number } | null; reload: () => void } {
  const [toFinish, setToFinish] = useState<{ count: number } | null>(null)
  const load = useCallback(async () => {
    if (!enabled) {
      setToFinish(null)
      return
    }
    try {
      const count = await supabaseSupplyFinishIo.countToFinish()
      setToFinish(count > 0 ? { count } : null)
    } catch {
      setToFinish(null)
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
  return { toFinish, reload: () => void load() }
}
