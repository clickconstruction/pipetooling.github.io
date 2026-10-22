/**
 * Messages, cut 5's screens: Company phone seats' read and its one write, beside cut 2's Who gets a new message
 * (`messages/assignRuleIo.ts`) in Settings → Phone and texts, and written the same way. The seats are `app_settings`'s
 * `messages_quo_seats_v1`: cut 5's migration made the row, and its policy lets the owner and a dev update it and
 * nothing else, so a save that comes back with no row was refused. The people are the active GC office team, from
 * `users`: not archived, not a digital twin, not a sample account, the predicates `activeUsersQuery` reads with (v2.5539).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1 } from '../appSettingsKeys'
import { GC_OFFICE_TEAM } from '../gc/access'
import { SEATS_NOT_SAVED } from '../messages/assignRule'
import type { SeatPerson } from '../messages/assignRuleIo'
import { supabase } from '../supabase'
import { parseQuoSeats, quoSeatsText, type QuoSeatRow } from './seatsCard'

export interface QuoSeatsIo {
  load(): Promise<{ seats: QuoSeatRow[]; team: SeatPerson[] }>
  /** Resolves once the seats are saved. Rejects with words a person can act on when nothing saved. */
  save(seats: readonly QuoSeatRow[]): Promise<void>
}

const OFFICE_ROLES = [...GC_OFFICE_TEAM] as Database['public']['Tables']['users']['Row']['role'][]

export function supabaseQuoSeatsIo(client: SupabaseClient<Database> = supabase): QuoSeatsIo {
  return {
    async load() {
      const [setting, users] = await Promise.all([
        client.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1).maybeSingle(),
        client.from('users').select('id, name, role').in('role', OFFICE_ROLES).is('archived_at', null).eq('is_digital_twin', false).eq('is_sample', false).eq('is_walk_tester', false).order('name'),
      ])
      checkSupabaseError(setting, 'read the company phone seats')
      checkSupabaseError(users, 'read the office team')
      return {
        seats: parseQuoSeats(setting.data?.value_text),
        team: (users.data ?? []).map((u) => ({ id: u.id, name: u.name ?? '', role: u.role ?? '' })),
      }
    },
    async save(seats) {
      const result = await client.from('app_settings').update({ value_text: quoSeatsText(seats) }).eq('key', APP_SETTINGS_KEY_MESSAGES_QUO_SEATS_V1).select('key')
      checkSupabaseError(result, 'save the company phone seats')
      if (result.data.length === 0) throw new Error(SEATS_NOT_SAVED)
    },
  }
}
