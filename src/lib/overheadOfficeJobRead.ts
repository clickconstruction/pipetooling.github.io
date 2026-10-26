/**
 * The overhead office job's id, read from `app_settings` with the client passed in (v2.5880), so the Bridge's weekly
 * sheet can make the read as the service role on the edge. `overheadOfficeJobSettings.ts` binds the app's client
 * for its 21 readers and keeps the two writes.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1 } from './appSettingsKeys'
import { withSupabaseRetry } from '../utils/errorHandling'

export const OFFICE_JOB_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseOverheadOfficeJobLedgerId(valueText: string | null | undefined): string | null {
  if (valueText == null) return null
  const t = valueText.trim()
  if (t === '' || !OFFICE_JOB_UUID_RE.test(t)) return null
  return t
}

type AppSettingsValueTextRow = Pick<Database['public']['Tables']['app_settings']['Row'], 'value_text'>

export async function readOverheadOfficeJobLedgerId(db: SupabaseClient<Database>): Promise<string | null> {
  const row: AppSettingsValueTextRow | null = await withSupabaseRetry(
    async () =>
      db
        .from('app_settings')
        .select('value_text')
        .eq('key', APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1)
        .maybeSingle(),
    'fetch overhead office job app setting',
  )
  return parseOverheadOfficeJobLedgerId(row?.value_text ?? null)
}
