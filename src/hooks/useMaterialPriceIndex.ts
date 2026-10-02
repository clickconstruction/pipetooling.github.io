import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { computeMaterialPriceIndex, type MaterialPriceIndex } from '../lib/materials/materialPriceIndex'
import { loadMaterialPriceIndexInputs } from '../lib/materials/materialPriceIndexIo'
import { todayYmdInAppTz } from '../utils/dateUtils'

export type MaterialPriceIndexState =
  | { status: 'loading' }
  | { status: 'error' }
  /** `index` null: nothing in a year of takeoffs was priced from this trade's book. */
  | { status: 'ready'; index: MaterialPriceIndex | null; today: string }

/** What your materials cost for one trade (v2.4391): reads once per trade, computes, holds the result. */
export function useMaterialPriceIndex(serviceTypeId: string | null): MaterialPriceIndexState {
  const [state, setState] = useState<MaterialPriceIndexState>({ status: 'loading' })
  useEffect(() => {
    if (!serviceTypeId) return
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      try {
        const today = todayYmdInAppTz()
        const inputs = await loadMaterialPriceIndexInputs(supabase, { serviceTypeId, today })
        if (!cancelled) setState({ status: 'ready', index: computeMaterialPriceIndex({ ...inputs, today }), today })
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [serviceTypeId])
  return state
}
