import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeMaterialPriceIndex, type MaterialPriceIndex } from '../lib/materials/materialPriceIndex'
import { loadMaterialPriceIndexInputs } from '../lib/materials/materialPriceIndexIo'
import { todayYmdInAppTz } from '../utils/dateUtils'

export type MaterialPriceIndexState =
  | { status: 'loading' }
  | { status: 'error' }
  /** `index` null: nothing in a year of takeoffs was priced from this trade's book. */
  | { status: 'ready'; index: MaterialPriceIndex | null; today: string }

/**
 * What your materials cost for one trade (v2.4391): reads once per trade, computes, holds the
 * result. A new `reloadKey` reads again (v2.4392: after Check 20 prices wrote something).
 */
export function useMaterialPriceIndex(serviceTypeId: string | null, reloadKey = 0): MaterialPriceIndexState {
  const [state, setState] = useState<MaterialPriceIndexState>({ status: 'loading' })
  /** The trade the state on screen belongs to: a re-read of the same trade keeps the card up meanwhile. */
  const shownFor = useRef<string | null>(null)
  useEffect(() => {
    if (!serviceTypeId) return
    let cancelled = false
    if (shownFor.current !== serviceTypeId) setState({ status: 'loading' })
    void (async () => {
      try {
        const today = todayYmdInAppTz()
        const inputs = await loadMaterialPriceIndexInputs(supabase, { serviceTypeId, today })
        if (cancelled) return
        shownFor.current = serviceTypeId
        setState({ status: 'ready', index: computeMaterialPriceIndex({ ...inputs, today }), today })
      } catch {
        if (cancelled) return
        shownFor.current = null
        setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [serviceTypeId, reloadKey])
  return state
}
