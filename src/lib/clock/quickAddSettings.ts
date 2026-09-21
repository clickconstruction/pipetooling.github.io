/**
 * The two owner settings behind quick time add (v2.3677): who gets the door and the daily
 * ceiling. Read by the clock (the door) and by Settings → People & teams (the block); written
 * only there. `add_quick_time()` reads the same two rows, so the client and the database agree.
 */
import { supabase } from '../supabase'
import { APP_SETTINGS_KEY_QUICK_ADD_DAILY_CEILING_MINUTES, APP_SETTINGS_KEY_QUICK_ADD_ROLES_V1 } from '../appSettingsKeys'
import { parseQuickAddDailyCeiling, parseQuickAddRoles, serializeQuickAddRoles } from './quickTimeAdd'

export type QuickAddSettings = { roles: string[]; ceilingMinutes: number }

export async function fetchQuickAddSettings(): Promise<QuickAddSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value_text, value_num')
    .in('key', [APP_SETTINGS_KEY_QUICK_ADD_ROLES_V1, APP_SETTINGS_KEY_QUICK_ADD_DAILY_CEILING_MINUTES])
  if (error) throw error
  const rows = (data ?? []) as Array<{ key: string; value_text: string | null; value_num: number | null }>
  const roleRow = rows.find((r) => r.key === APP_SETTINGS_KEY_QUICK_ADD_ROLES_V1)
  const ceilingRow = rows.find((r) => r.key === APP_SETTINGS_KEY_QUICK_ADD_DAILY_CEILING_MINUTES)
  return { roles: parseQuickAddRoles(roleRow?.value_text), ceilingMinutes: parseQuickAddDailyCeiling(ceilingRow?.value_num) }
}

export async function saveQuickAddSettings(next: QuickAddSettings): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert(
    [
      { key: APP_SETTINGS_KEY_QUICK_ADD_ROLES_V1, value_text: serializeQuickAddRoles(next.roles) },
      { key: APP_SETTINGS_KEY_QUICK_ADD_DAILY_CEILING_MINUTES, value_num: parseQuickAddDailyCeiling(next.ceilingMinutes) },
    ],
    { onConflict: 'key' },
  )
  if (error) throw error
}
