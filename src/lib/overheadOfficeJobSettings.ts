import { supabase } from './supabase'
import { APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1 } from './appSettingsKeys'
import { withSupabaseRetry } from '../utils/errorHandling'
import { OFFICE_JOB_UUID_RE, readOverheadOfficeJobLedgerId } from './overheadOfficeJobRead'

// The read lives in `overheadOfficeJobRead.ts` with the client passed in (v2.5880); this file binds the app's
// client and keeps the two writes.
export { parseOverheadOfficeJobLedgerId } from './overheadOfficeJobRead'

export function fetchOverheadOfficeJobLedgerIdFromAppSettings(): Promise<string | null> {
  return readOverheadOfficeJobLedgerId(supabase)
}

export async function upsertOverheadOfficeJobLedgerId(jobLedgerId: string): Promise<void> {
  const t = jobLedgerId.trim()
  if (!OFFICE_JOB_UUID_RE.test(t)) throw new Error('Invalid job id')
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').upsert(
        { key: APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1, value_text: t },
        { onConflict: 'key' },
      ),
    'upsert overhead office job app setting',
  )
}

export async function deleteOverheadOfficeJobLedgerIdSetting(): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('app_settings').delete().eq('key', APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1),
    'delete overhead office job app setting',
  )
}
