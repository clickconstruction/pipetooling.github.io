/**
 * Messages, cut 5's screens: Settings → Flows' reads for the reminders the app sends itself, and the switch's one write
 * (`appSends.ts`). Both settings are `app_settings` rows every signed-in user reads; the switch's own UPDATE policy lets
 * only the owner and a dev write it, so a write that matches no row was refused. The team's quick replies give the
 * words the run would send. One interface, so the tab's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1, APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1 } from '../appSettingsKeys'
import type { QuickReply } from '../quickReplies/kernel'
import { supabase } from '../supabase'
import { APP_SENDS_NOT_SAVED, appSendsFrom, appSendsText, lastRunFrom, withAppSend, type LastRun } from './appSends'
import type { FlowKind } from './facts'
import type { AppSends } from './nudgeDispatch'
import { quickRepliesFrom, type RunQuickReplyRow } from './nudgeRunInputs'

export interface AppSendsRead {
  sends: AppSends
  lastRun: LastRun | null
  /** The team's quick replies; empty when their read failed, so the step's own words show. */
  quickReplies: QuickReply[]
}

export interface AppSendsIo {
  load(): Promise<AppSendsRead>
  /** Turns one step on or off over the switch as stored now, and resolves with the switch as written. Rejects with words a person can act on when nothing changed. */
  set(kind: FlowKind, stepId: string, on: boolean): Promise<AppSends>
}

const QUICK_REPLY_COLUMNS = 'id, text, for_kind, step_key, scope, added_by, added_at, removed_at'

export function supabaseAppSendsIo(client: SupabaseClient<Database> = supabase): AppSendsIo {
  return {
    async load() {
      const [settings, replies] = await Promise.all([
        client.from('app_settings').select('key, value_text').in('key', [APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1, APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1]),
        // cut 3's table is not in the generated types until the types pass that follows its migration.
        client.from('quick_replies' as never).select(QUICK_REPLY_COLUMNS) as unknown as PromiseLike<{
          data: RunQuickReplyRow[] | null
          error: SupabaseResultError | null
        }>,
      ])
      checkSupabaseError(settings, 'read the app’s reminders')
      const valueOf = (key: string) => settings.data.find((r) => r.key === key)?.value_text ?? null
      return {
        sends: appSendsFrom(valueOf(APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1)),
        lastRun: lastRunFrom(valueOf(APP_SETTINGS_KEY_MESSAGES_NUDGE_LAST_RUN_V1)),
        quickReplies: replies.error ? [] : quickRepliesFrom(replies.data ?? []),
      }
    },
    async set(kind, stepId, on) {
      // Read the switch again first, so turning one step on keeps a step someone turned on since the tab was read.
      const now = await client.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1).maybeSingle()
      checkSupabaseError(now, 'read the app’s reminders')
      const next = withAppSend(appSendsFrom(now.data?.value_text ?? null), kind, stepId, on)
      const result = await client.from('app_settings').update({ value_text: appSendsText(next) }).eq('key', APP_SETTINGS_KEY_MESSAGES_NUDGE_APP_SENDS_V1).select('key')
      checkSupabaseError(result, 'turn the app’s reminder on or off')
      if (result.data.length === 0) throw new Error(APP_SENDS_NOT_SAVED)
      return next
    },
  }
}
