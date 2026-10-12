/**
 * Messages, cut 2's screens, PR D: Phone and texts' read and its one write. The seats are `app_settings`'s
 * `messages_assign_rule_v1`: cut 2's migration made the row, and its policy lets the owner and a dev update it and
 * nothing else. The people are the GC office team, from `users`. One interface, so the section's smoke hands it a fake.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { checkSupabaseError } from '../../utils/errorHandling'
import { APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1 } from '../appSettingsKeys'
import { GC_OFFICE_TEAM } from '../gc/access'
import { supabase } from '../supabase'
import { SEATS_NOT_SAVED, assignSeatsText, parseAssignSeats, type AssignRuleSeats } from './assignRule'

/** Someone who can be picked for a seat, or whose name a saved seat shows. */
export interface SeatPerson {
  id: string
  name: string
  role: string
}

export interface AssignRuleIo {
  load(): Promise<{ seats: AssignRuleSeats; team: SeatPerson[] }>
  /** Resolves once the seats are saved. Rejects with words a person can act on when nothing saved. */
  save(seats: AssignRuleSeats): Promise<void>
}

const OFFICE_ROLES = [...GC_OFFICE_TEAM] as Database['public']['Tables']['users']['Row']['role'][]

export function supabaseAssignRuleIo(client: SupabaseClient<Database> = supabase): AssignRuleIo {
  return {
    async load() {
      const [setting, users] = await Promise.all([
        client.from('app_settings').select('value_text').eq('key', APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1).maybeSingle(),
        client.from('users').select('id, name, role').in('role', OFFICE_ROLES).order('name'),
      ])
      checkSupabaseError(setting, 'read who gets a new message')
      checkSupabaseError(users, 'read the office team')
      return {
        seats: parseAssignSeats(setting.data?.value_text),
        team: (users.data ?? []).map((u) => ({ id: u.id, name: u.name ?? '', role: u.role ?? '' })),
      }
    },
    async save(seats) {
      const result = await client.from('app_settings').update({ value_text: assignSeatsText(seats) }).eq('key', APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1).select('key')
      checkSupabaseError(result, 'save who gets a new message')
      if (result.data.length === 0) throw new Error(SEATS_NOT_SAVED)
    },
  }
}
