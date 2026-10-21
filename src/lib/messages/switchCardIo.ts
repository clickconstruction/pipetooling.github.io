/**
 * Punch list #140 PR 2: the switch card's one read, the eight `app_settings` rows the loop runs on (`switchCard.ts`),
 * keyed by their key. A row that is not there is left out, and the kernel reads it as off. One interface, so the
 * card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { SWITCH_SETTING_KEYS, type SwitchRaw } from './switchCard'

export interface SwitchCardIo {
  load(): Promise<Record<string, SwitchRaw>>
}

export function supabaseSwitchCardIo(client: SupabaseClient<Database> = supabase): SwitchCardIo {
  return {
    async load() {
      const rows = await client.from('app_settings').select('key, value_text, value_num').in('key', [...SWITCH_SETTING_KEYS])
      checkSupabaseError(rows, 'read the Messages switches')
      const out: Record<string, SwitchRaw> = {}
      for (const r of rows.data ?? []) out[r.key] = { value_text: r.value_text ?? null, value_num: r.value_num ?? null }
      return out
    },
  }
}
