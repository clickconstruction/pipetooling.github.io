/**
 * Residential R5's push: Reply push's read and its one write (`replyPushSwitch.ts`). The switch is `app_settings`'s
 * `REPLY_PUSH_ON_KEY` row, which the owner and a dev may update and nothing else; since v2.5540 the read and a second
 * write take the office's wait too (`OFFICE_WAIT_KEY`, `value_num`, the same policy shape). One interface, so the
 * card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { REPLY_PUSH_ON_KEY } from './notifyPlan'
import { OFFICE_WAIT_KEY } from './notifyRule'
import { OFFICE_WAIT_NOT_SAVED, readOfficeWait, REPLY_PUSH_NOT_SAVED, replyPushIsOn } from './replyPushSwitch'

export interface ReplyPushSwitchIo {
  load(): Promise<{ on: boolean; waitMinutes: number }>
  /** Resolves once the switch reads `on`. Rejects with words a person can act on when nothing changed. */
  setOn(on: boolean): Promise<void>
  /** Resolves once the office's wait reads `minutes`. Rejects with words a person can act on when nothing changed. */
  setWait(minutes: number): Promise<void>
}

export function supabaseReplyPushSwitchIo(client: SupabaseClient<Database> = supabase): ReplyPushSwitchIo {
  return {
    async load() {
      const rows = await client.from('app_settings').select('key, value_text, value_num').in('key', [REPLY_PUSH_ON_KEY, OFFICE_WAIT_KEY])
      checkSupabaseError(rows, 'read the reply push switch')
      const row = (key: string) => (rows.data ?? []).find((r) => r.key === key)
      return { on: replyPushIsOn(row(REPLY_PUSH_ON_KEY)?.value_text), waitMinutes: readOfficeWait(row(OFFICE_WAIT_KEY)?.value_num) }
    },
    async setOn(on) {
      const result = await client.from('app_settings').update({ value_text: on ? 'true' : 'false' }).eq('key', REPLY_PUSH_ON_KEY).select('key')
      checkSupabaseError(result, 'turn the reply push on or off')
      // No row back: the policy refused the update, or the row is not there before its migration is pushed.
      if (result.data.length === 0) throw new Error(REPLY_PUSH_NOT_SAVED)
    },
    async setWait(minutes) {
      const result = await client.from('app_settings').update({ value_num: minutes }).eq('key', OFFICE_WAIT_KEY).select('key')
      checkSupabaseError(result, 'save the office’s wait')
      if (result.data.length === 0) throw new Error(OFFICE_WAIT_NOT_SAVED)
    },
  }
}
