import { supabase } from './supabase'
import type { Database } from '../types/database'
import { APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1 } from './appSettingsKeys'
import { withSupabaseRetry } from '../utils/errorHandling'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function parseOverheadOfficeJobLedgerId(valueText: string | null | undefined): string | null {
  if (valueText == null) return null
  const t = valueText.trim()
  if (t === '' || !UUID_RE.test(t)) return null
  return t
}

type AppSettingsValueTextRow = Pick<Database['public']['Tables']['app_settings']['Row'], 'value_text'>

export async function fetchOverheadOfficeJobLedgerIdFromAppSettings(): Promise<string | null> {
  const row: AppSettingsValueTextRow | null = await withSupabaseRetry(
    async () =>
      supabase
        .from('app_settings')
        .select('value_text')
        .eq('key', APP_SETTINGS_KEY_OVERHEAD_OFFICE_JOB_LEDGER_ID_V1)
        .maybeSingle(),
    'fetch overhead office job app setting',
  )
  return parseOverheadOfficeJobLedgerId(row?.value_text ?? null)
}

export async function upsertOverheadOfficeJobLedgerId(jobLedgerId: string): Promise<void> {
  const t = jobLedgerId.trim()
  if (!UUID_RE.test(t)) throw new Error('Invalid job id')
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
