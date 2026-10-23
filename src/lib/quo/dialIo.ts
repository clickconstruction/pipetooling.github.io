/**
 * To-do #152 (v2.5803): the one read behind every Call button, the Company phone seats (`messages_quo_seats_v1`) and
 * the two boxes (`messages_boxes_v1`), both rows every signed-in person may read. Read once a page load and shared by
 * every button on the page; a read that fails answers no seats and no boxes, so the buttons stay `tel:`, and the next
 * mount reads again.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1 } from '../appSettingsKeys'
import { BOXES_SETTINGS_KEY, parseBoxSettings, type BoxSettings } from '../messages/boxes'
import { supabase } from '../supabase'
import { parseQuoSeats, type QuoSeatRow } from './seatsCard'

export interface DialSettings {
  seats: QuoSeatRow[]
  boxes: BoxSettings | null
}

export const NO_DIAL_SETTINGS: DialSettings = { seats: [], boxes: null }

let shared: Promise<DialSettings> | null = null

export function loadDialSettings(client: SupabaseClient<Database> = supabase): Promise<DialSettings> {
  if (shared) return shared
  const read = Promise.resolve()
    .then(() => client.from('app_settings').select('key, value_text').in('key', [APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1, BOXES_SETTINGS_KEY]))
    .then((result) => {
      if (result.error) throw result.error
      const byKey = new Map((result.data ?? []).map((r) => [r.key, r.value_text]))
      return {
        seats: parseQuoSeats(byKey.get(APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1)),
        boxes: parseBoxSettings(byKey.get(BOXES_SETTINGS_KEY)),
      }
    })
    .catch(() => {
      shared = null
      return NO_DIAL_SETTINGS
    })
  shared = read
  return read
}

/** Drops the shared read, for a test or after the seats card saves. */
export function forgetDialSettings(): void {
  shared = null
}
