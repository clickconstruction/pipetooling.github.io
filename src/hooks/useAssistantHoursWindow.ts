import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS,
  DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS,
  parseAssistantHoursWindowWeeks,
} from '../lib/appSettingsKeys'
import { assistantHoursWindowFloorYmd } from '../lib/people/assistantHoursWindow'
import { todayYmdInAppTz } from '../utils/dateUtils'

/**
 * The assistant hours window (`app_settings.assistant_hours_window_weeks_v1`): how far back an
 * assistant sees and types hours. `limited` is whether the viewer is held to it (role
 * `assistant` exactly — controllers, devs and pay-approved masters never are). Until the setting
 * arrives the default window applies, so nothing ever opens wider than it should; the database
 * holds the same floor (`assistant_hours_window_floor()`, v2.4271).
 */
export function useAssistantHoursWindow(limited: boolean): { weeks: number; floorYmd: string | null } {
  const [weeks, setWeeks] = useState(DEFAULT_ASSISTANT_HOURS_WINDOW_WEEKS)
  useEffect(() => {
    if (!limited) return
    let cancelled = false
    void supabase
      .from('app_settings')
      .select('value_num')
      .eq('key', APP_SETTINGS_KEY_ASSISTANT_HOURS_WINDOW_WEEKS)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setWeeks(parseAssistantHoursWindowWeeks((data as { value_num?: number | null } | null)?.value_num ?? null))
      })
    return () => {
      cancelled = true
    }
  }, [limited])
  const floorYmd = useMemo(() => (limited ? assistantHoursWindowFloorYmd(todayYmdInAppTz(), weeks) : null), [limited, weeks])
  return { weeks, floorYmd }
}
