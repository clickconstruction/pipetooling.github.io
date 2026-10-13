/**
 * Messages, cut 5: the texts switch's read and its one write (`textsSwitch.ts`). The switch is `app_settings`'s
 * `messages_texts_on_v1`, which every signed-in user reads and only the owner and a dev may update. One interface, so
 * the Settings card's smoke and the send window's hand it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_MESSAGES_TEXTS_ON_V1 } from '../appSettingsKeys'
import { supabase } from '../supabase'
import { TEXTS_NOT_SAVED, textsAreOn } from './textsSwitch'

export interface TextsSwitchIo {
  /** Whether texts are on. A row not there yet reads off. */
  load(): Promise<boolean>
  /** Resolves once the switch reads `on`. Rejects with words a person can act on when nothing changed. */
  setOn(on: boolean): Promise<void>
}

export function supabaseTextsSwitchIo(client: SupabaseClient<Database> = supabase): TextsSwitchIo {
  return {
    async load() {
      const result = await client.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_MESSAGES_TEXTS_ON_V1).maybeSingle()
      checkSupabaseError(result, 'read the texts switch')
      return textsAreOn(result.data?.value_text)
    },
    async setOn(on) {
      const result = await client.from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', APP_SETTINGS_KEY_MESSAGES_TEXTS_ON_V1).select('key')
      checkSupabaseError(result, 'turn texts on or off')
      if (result.data.length === 0) throw new Error(TEXTS_NOT_SAVED)
    },
  }
}
