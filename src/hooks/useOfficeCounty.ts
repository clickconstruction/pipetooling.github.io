import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { APP_SETTINGS_KEY_OFFICE_COUNTY } from '../lib/appSettingsKeys'
import { OFFICE_COUNTY_DEFAULT } from '../lib/legal/affidavitPaper'

/**
 * The office's county for a sworn statement's venue line (punch list #220, v2.6210): `app_settings.office_county`,
 * seeded *Guadalupe* by migration 20261031040000 and changed under Settings → Jobs & billing. The default stands in
 * until the row answers, and when it cannot (a read that fails is a county, not a stop).
 */
export function useOfficeCounty(enabled = true): string {
  const [county, setCounty] = useState(OFFICE_COUNTY_DEFAULT)
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_OFFICE_COUNTY).maybeSingle()
      const v = (data?.value_text ?? '').trim()
      if (!cancelled && v) setCounty(v)
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])
  return county
}
