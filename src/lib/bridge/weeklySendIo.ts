/**
 * The weekly send's switch and last run, read and written for the Bridge's card (v2.5883; `weeklySend.ts` holds the
 * keys and the words). The switch is `app_settings` `bridge_weekly_sheet_on_v1`, which a dev may update and nothing
 * else; the last run is the function's row, read here and never written. One interface, so the card's smoke hands it
 * a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { WEEKLY_SEND_NOT_SAVED, WEEKLY_SHEET_LAST_RUN_KEY, WEEKLY_SHEET_ON_KEY, parseWeeklySendRun, weeklySheetIsOn, type WeeklySendRun } from './weeklySend'

export interface WeeklySendIo {
  load(): Promise<{ on: boolean; lastRun: WeeklySendRun | null }>
  /** Resolves once the switch reads `on`. Rejects with words a person can act on when nothing changed. */
  setOn(on: boolean): Promise<void>
}

export function supabaseWeeklySendIo(client: SupabaseClient<Database> = supabase): WeeklySendIo {
  return {
    async load() {
      const rows = await client.from('app_settings').select('key, value_text').in('key', [WEEKLY_SHEET_ON_KEY, WEEKLY_SHEET_LAST_RUN_KEY])
      checkSupabaseError(rows, 'read the weekly email switch')
      const row = (key: string) => (rows.data ?? []).find((r) => r.key === key)
      return { on: weeklySheetIsOn(row(WEEKLY_SHEET_ON_KEY)?.value_text), lastRun: parseWeeklySendRun(row(WEEKLY_SHEET_LAST_RUN_KEY)?.value_text) }
    },
    async setOn(on) {
      const result = await client.from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', WEEKLY_SHEET_ON_KEY).select('key')
      checkSupabaseError(result, 'turn the weekly email on or off')
      // No row back: the policy refused the update, or the row is not there before its migration is pushed.
      if (result.data.length === 0) throw new Error(WEEKLY_SEND_NOT_SAVED)
    },
  }
}
