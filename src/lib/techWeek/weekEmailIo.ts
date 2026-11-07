/**
 * The Monday email's switch, last run, preview and test (punch list #255, v2.6607): the switch is `app_settings`
 * `your_week_email_on_v1`, which a dev may update and nothing else; the last run is the function's row, read here and
 * never written; the preview and the test call `your-week-email` with the signed-in session. One interface, so the
 * card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { parseWeeklySendRun, weeklySheetIsOn, type WeeklySendRun } from '../bridge/weeklySend'
import { WEEK_EMAIL_WORDS, YOUR_WEEK_EMAIL_LAST_RUN_KEY, YOUR_WEEK_EMAIL_ON_KEY, type WeekEmail } from './weekEmail'

export interface WeekEmailIo {
  load(): Promise<{ on: boolean; lastRun: WeeklySendRun | null }>
  /** Resolves once the switch reads `on`. Rejects with words a person can act on when nothing changed. */
  setOn(on: boolean): Promise<void>
  /** The caller's own email for last week, as the Monday run would send it; null when they have no card. */
  previewMine(): Promise<{ mine: WeekEmail | null; to: Array<{ name: string; email: string }> | undefined }>
  /** Sends the caller their own last week's card, [TEST] before the subject. */
  testMine(): Promise<string>
}

type FnResult = { data: unknown; error: { message?: string } | null }

function fnError(r: FnResult, fallback: string): string | null {
  if (r.error) return r.error.message || fallback
  const d = r.data as { ok?: boolean; error?: string } | null
  if (d && d.ok === false) return d.error || fallback
  return null
}

export function supabaseWeekEmailIo(client: SupabaseClient<Database> = supabase): WeekEmailIo {
  return {
    async load() {
      const rows = await client.from('app_settings').select('key, value_text').in('key', [YOUR_WEEK_EMAIL_ON_KEY, YOUR_WEEK_EMAIL_LAST_RUN_KEY])
      checkSupabaseError(rows, 'read the Monday email switch')
      const row = (key: string) => (rows.data ?? []).find((r) => r.key === key)
      return { on: weeklySheetIsOn(row(YOUR_WEEK_EMAIL_ON_KEY)?.value_text), lastRun: parseWeeklySendRun(row(YOUR_WEEK_EMAIL_LAST_RUN_KEY)?.value_text) }
    },
    async setOn(on) {
      const result = await client.from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', YOUR_WEEK_EMAIL_ON_KEY).select('key')
      checkSupabaseError(result, 'turn the Monday email on or off')
      if (result.data.length === 0) throw new Error(WEEK_EMAIL_WORDS.notSaved)
    },
    async previewMine() {
      const r = (await client.functions.invoke('your-week-email', { body: { dry: true } })) as FnResult
      const err = fnError(r, 'The preview failed.')
      if (err) throw new Error(err)
      const d = r.data as { mine?: WeekEmail | null; to?: Array<{ name: string; email: string }> }
      return { mine: d.mine ?? null, to: d.to }
    },
    async testMine() {
      const r = (await client.functions.invoke('your-week-email', { body: { test: true } })) as FnResult
      const err = fnError(r, 'The test send failed.')
      if (err) throw new Error(err)
      return String((r.data as { to?: string }).to ?? '')
    },
  }
}
