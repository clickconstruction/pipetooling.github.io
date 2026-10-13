/**
 * Messages, cut 6: Read bids@'s read and its one write (`emailReader.ts`). The switch is `app_settings`'s
 * `gmail_sync_on_v1`, which the owner and a dev may update and nothing else; how the reader is doing is
 * `gmail_sync_state`'s one row, which the office team reads. One interface, so the card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1 } from '../appSettingsKeys'
import { supabase } from '../supabase'
import { READER_NOT_SAVED, readerIsOn, type ReaderHealth } from './emailReader'

export interface EmailReaderIo {
  load(): Promise<{ on: boolean; health: ReaderHealth | null }>
  /** Resolves once the switch reads `on`. Rejects with words a person can act on when nothing changed. */
  setOn(on: boolean): Promise<void>
}

export function supabaseEmailReaderIo(client: SupabaseClient<Database> = supabase): EmailReaderIo {
  return {
    async load() {
      const [setting, state] = await Promise.all([
        client.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1).maybeSingle(),
        // The reader's table is not in the generated types until the types pass that follows its migration.
        client.from('gmail_sync_state' as never).select('last_ok_at, last_error').maybeSingle() as unknown as PromiseLike<{
          data: ReaderHealth | null
          error: SupabaseResultError | null
        }>,
      ])
      checkSupabaseError(setting, 'read the bids@ switch')
      checkSupabaseError(state, 'read how the bids@ reader is doing')
      return { on: readerIsOn(setting.data?.value_text), health: state.data }
    },
    async setOn(on) {
      const result = await client.from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', APP_SETTINGS_KEY_GMAIL_SYNC_ON_V1).select('key')
      checkSupabaseError(result, 'turn reading bids@ on or off')
      if (result.data.length === 0) throw new Error(READER_NOT_SAVED)
    },
  }
}
