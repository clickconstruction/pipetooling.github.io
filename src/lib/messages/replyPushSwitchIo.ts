/**
 * Residential R5's push: Reply push's read and its one write (`replyPushSwitch.ts`). The switch is `app_settings`'s
 * `REPLY_PUSH_ON_KEY` row, which the owner and a dev may update and nothing else. One interface, so the card's smoke
 * hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { REPLY_PUSH_ON_KEY } from './notifyPlan'
import { REPLY_PUSH_NOT_SAVED, replyPushIsOn } from './replyPushSwitch'

export interface ReplyPushSwitchIo {
  load(): Promise<{ on: boolean }>
  /** Resolves once the switch reads `on`. Rejects with words a person can act on when nothing changed. */
  setOn(on: boolean): Promise<void>
}

export function supabaseReplyPushSwitchIo(client: SupabaseClient<Database> = supabase): ReplyPushSwitchIo {
  return {
    async load() {
      const setting = await client.from('app_settings').select('value_text').eq('key', REPLY_PUSH_ON_KEY).maybeSingle()
      checkSupabaseError(setting, 'read the reply push switch')
      return { on: replyPushIsOn(setting.data?.value_text) }
    },
    async setOn(on) {
      const result = await client.from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', REPLY_PUSH_ON_KEY).select('key')
      checkSupabaseError(result, 'turn the reply push on or off')
      // No row back: the policy refused the update, or the row is not there before its migration is pushed.
      if (result.data.length === 0) throw new Error(REPLY_PUSH_NOT_SAVED)
    },
  }
}
