import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_TEST_REPORT_SETTINGS_V1 } from '../appSettingsKeys'
import { DEFAULT_TEST_REPORT_SETTINGS, parseTestReportSettings, type TestReportSettings } from './testReport'

/**
 * The test-report settings row (v2.3298): the certifier, the letterhead lines
 * and the paper's text, org-wide in `app_settings` under one JSON key. Every
 * field falls back to the kernel default, so a partial row (the migration
 * seeds only the identity fields) renders the full paper.
 */
let cached: TestReportSettings | null = null

export async function fetchTestReportSettings(): Promise<TestReportSettings> {
  try {
    const data = (await withSupabaseRetry(
      async () => supabase.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_TEST_REPORT_SETTINGS_V1).maybeSingle(),
      'fetch_test_report_settings',
    )) as { value_text: string | null } | null
    const text = data?.value_text ?? ''
    let parsed: unknown = null
    if (text.trim()) {
      try {
        parsed = JSON.parse(text)
      } catch {
        parsed = null
      }
    }
    cached = parseTestReportSettings(parsed)
    return cached
  } catch {
    return cached ?? { ...DEFAULT_TEST_REPORT_SETTINGS }
  }
}

/** Last fetched value, for a first paint before the network answers. */
export function cachedTestReportSettings(): TestReportSettings {
  return cached ?? { ...DEFAULT_TEST_REPORT_SETTINGS }
}

export async function saveTestReportSettings(next: TestReportSettings): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('app_settings').upsert({ key: APP_SETTINGS_KEY_TEST_REPORT_SETTINGS_V1, value_text: JSON.stringify(next) }, { onConflict: 'key' }),
    'save_test_report_settings',
  )
  cached = { ...next }
}
