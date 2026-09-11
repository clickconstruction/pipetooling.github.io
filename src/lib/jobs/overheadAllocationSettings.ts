import { supabase } from '../supabase'
import type { Database } from '../../types/database'
import { APP_SETTINGS_KEY_OVERHEAD_ALLOCATION_V1 } from '../appSettingsKeys'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { OVERHEAD_ALLOCATION_LEGACY, normalizeOverheadAllocationSettings, type OverheadAllocationSettings } from './overheadAllocation'

/**
 * The org-wide overhead allocation (v2.3259): one `app_settings` row, JSON in
 * `value_text`. Every reader of Job Summary's true profit — the table, Burn, the
 * Days view — charges from the same settings, so there is one truth. Absent or
 * unreadable → the original day-share (`OVERHEAD_ALLOCATION_LEGACY`). Devs write
 * it (the `app_settings` "Devs can manage" policy); everyone authenticated reads.
 */
type AppSettingsValueTextRow = Pick<Database['public']['Tables']['app_settings']['Row'], 'value_text'>

/** `null` → legacy; anything else is normalized field by field. */
export function parseOverheadAllocationSetting(valueText: string | null | undefined): OverheadAllocationSettings {
  if (valueText == null || valueText.trim() === '') return { ...OVERHEAD_ALLOCATION_LEGACY }
  return normalizeOverheadAllocationSettings(valueText)
}

export function serializeOverheadAllocationSetting(s: OverheadAllocationSettings): string {
  const n = normalizeOverheadAllocationSettings(s)
  return JSON.stringify({ smoothDays: n.smoothDays, carryShare: n.carryShare, idleCapDays: n.idleCapDays, openDef: n.openDef })
}

export async function fetchOverheadAllocationSettingFromAppSettings(): Promise<OverheadAllocationSettings> {
  const row: AppSettingsValueTextRow | null = await withSupabaseRetry(
    async () => supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_OVERHEAD_ALLOCATION_V1).maybeSingle(),
    'fetch overhead allocation app setting',
  )
  return parseOverheadAllocationSetting(row?.value_text ?? null)
}

export async function upsertOverheadAllocationSetting(s: OverheadAllocationSettings): Promise<OverheadAllocationSettings> {
  const value_text = serializeOverheadAllocationSetting(s)
  await withSupabaseRetry(
    async () => supabase.from('app_settings').upsert({ key: APP_SETTINGS_KEY_OVERHEAD_ALLOCATION_V1, value_text }, { onConflict: 'key' }),
    'upsert overhead allocation app setting',
  )
  return parseOverheadAllocationSetting(value_text)
}
