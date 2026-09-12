import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BaselineRate } from '../lib/bids/bidBaselineRates'

/**
 * Every kept job baseline as hours per $1k (v2.3367) — `job_baseline_rates()`,
 * hours only, for the Labor tab's per-$1k reading. Fail-soft: roles the RPC
 * refuses, or a function that has not landed, read as no baselines.
 */
export function useJobBaselineRates(enabled: boolean): { loading: boolean; rates: BaselineRate[] } {
  const [loading, setLoading] = useState(false)
  const [rates, setRates] = useState<BaselineRate[]>([])
  useEffect(() => {
    if (!enabled) {
      setRates([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('job_baseline_rates')
        if (!cancelled) setRates(error ? [] : ((data ?? []) as BaselineRate[]))
      } catch {
        if (!cancelled) setRates([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return { loading, rates }
}
