import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { TRAVEL_ASSUMED_MPH } from './jobTravelEstimate'

/**
 * Org-wide Day-view travel-hints settings (`app_settings`, dev writes / all
 * authenticated read — same pattern as the other dispatch settings keys).
 */
export const APP_SETTINGS_KEY_TRAVEL_HINTS_CONFIG = 'travel_hints_config_v1' as const

export type TravelHintsConfig = {
  /** Master switch for the Day-view travel chips + red shared dots. */
  enabled: boolean
  /** Assumed average speed (mph) for the straight-line minimum estimate. */
  assumedMph: number
  /** Option B: ask the travel-time-batch edge function for routed times (falls back to straight-line). */
  useRouting: boolean
}

export const TRAVEL_HINTS_DEFAULTS: TravelHintsConfig = {
  enabled: true,
  assumedMph: TRAVEL_ASSUMED_MPH,
  useRouting: false,
}

export function parseTravelHintsConfig(valueText: string | null | undefined): TravelHintsConfig {
  if (!valueText?.trim()) return TRAVEL_HINTS_DEFAULTS
  try {
    const v = JSON.parse(valueText) as Partial<TravelHintsConfig>
    const mph = Number(v.assumedMph)
    return {
      enabled: v.enabled !== false,
      assumedMph: Number.isFinite(mph) && mph >= 5 && mph <= 90 ? mph : TRAVEL_HINTS_DEFAULTS.assumedMph,
      useRouting: v.useRouting === true,
    }
  } catch {
    return TRAVEL_HINTS_DEFAULTS
  }
}

export async function loadTravelHintsConfig(): Promise<TravelHintsConfig> {
  try {
    const row = await withSupabaseRetry<{ value_text: string | null } | null>(
      async () =>
        supabase
          .from('app_settings')
          .select('value_text')
          .eq('key', APP_SETTINGS_KEY_TRAVEL_HINTS_CONFIG)
          .maybeSingle(),
      'load travel hints config',
    )
    return parseTravelHintsConfig(row?.value_text)
  } catch {
    return TRAVEL_HINTS_DEFAULTS
  }
}

/** Dev-only per RLS ("Devs can manage app settings"); errors surface to the caller. */
export async function upsertTravelHintsConfig(config: TravelHintsConfig): Promise<{ error: string | null }> {
  try {
    await withSupabaseRetry(
      async () =>
        supabase.from('app_settings').upsert(
          { key: APP_SETTINGS_KEY_TRAVEL_HINTS_CONFIG, value_text: JSON.stringify(config), value_num: null },
          { onConflict: 'key' },
        ),
      'upsert travel hints config',
    )
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not save travel settings' }
  }
}

/** Window event fired after saving so an already-mounted Day view re-reads the config. */
export const TRAVEL_HINTS_CONFIG_CHANGED_EVENT = 'pipetooling:travel-hints-config-changed'
