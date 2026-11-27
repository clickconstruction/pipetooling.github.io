import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1, DEFAULT_LABOR_BURDEN_FACTOR, parseLaborBurdenFactor } from '../lib/appSettingsKeys'

/**
 * The labor burden factor for a job's burn (punch list #448): `app_settings.labor_burden_factor_v1`, read once a
 * visit and shared by every screen that draws a burn. Until the read lands, and when it fails or the setting is
 * missing or outside 1 to 3, the factor is the default, 1.20, as the crew rate and the scorecard read it.
 */
let pending: Promise<number> | null = null

function readOnce(): Promise<number> {
  pending ??= (async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_LABOR_BURDEN_FACTOR_V1).maybeSingle()
      if (error) throw error
      return parseLaborBurdenFactor((data as { value_num: number | null } | null)?.value_num ?? null)
    } catch {
      // A failed read is not kept: the next screen asks again.
      pending = null
      return DEFAULT_LABOR_BURDEN_FACTOR
    }
  })()
  return pending
}

export function useLaborBurdenFactor(enabled: boolean): number {
  const [factor, setFactor] = useState(DEFAULT_LABOR_BURDEN_FACTOR)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void readOnce().then((f) => {
      if (!cancelled) setFactor(f)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])
  return factor
}
