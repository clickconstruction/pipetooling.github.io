/**
 * Residential R6's screens: the Inboxes card's read and its one write (`messages/boxesCard.ts`), written as Company
 * phone seats' (`quo/seatsCardIo.ts`). The row is `app_settings` `messages_boxes_v1`: R6's migration made it, and its
 * policy lets the owner and a dev update it and nothing else, so a save that comes back with no row was refused. Anyone
 * signed in reads it, as `app_settings` is read. One interface, so the card's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { supabase } from '../supabase'
import { BOXES_SETTINGS_KEY, type BoxSettings } from './boxes'
import { BOXES_NOT_SAVED, boxesFromRow, boxesText } from './boxesCard'

export interface BoxesCardIo {
  load(): Promise<BoxSettings>
  /** Resolves once the boxes are saved. Rejects with words a person can act on when nothing saved. */
  save(boxes: BoxSettings): Promise<void>
}

export function supabaseBoxesCardIo(client: SupabaseClient<Database> = supabase): BoxesCardIo {
  return {
    async load() {
      const setting = await client.from('app_settings').select('value_text').eq('key', BOXES_SETTINGS_KEY).maybeSingle()
      checkSupabaseError(setting, 'read the inboxes')
      return boxesFromRow(setting.data?.value_text)
    },
    async save(boxes) {
      const result = await client.from('app_settings').update({ value_text: boxesText(boxes) }).eq('key', BOXES_SETTINGS_KEY).select('key')
      checkSupabaseError(result, 'save the inboxes')
      if (result.data.length === 0) throw new Error(BOXES_NOT_SAVED)
    },
  }
}
