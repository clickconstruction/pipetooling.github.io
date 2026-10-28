/**
 * Push me (punch list #141 PR 2): the signed-in person's row in `user_push_hours`, read fail-soft (no row, or a table
 * not there yet, reads as any time) and written whole. *Push me any time* deletes the row. The untyped client is on
 * purpose: the table joins `types/database.ts` with the regenerate after the push, as `tell_customer_prefs` did.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import type { OfficeHours } from './hasRule'
import { parsePushHours, pushRowOf } from './pushHours'

export interface PushHoursIo {
  /** The person's hours, or null for any time. Never rejects: a read that fails reads as any time. */
  load(userId: string): Promise<OfficeHours | null>
  /** Only at these hours: the row written or replaced. */
  save(userId: string, hours: OfficeHours): Promise<void>
  /** Any time: the row removed. */
  clear(userId: string): Promise<void>
}

export function supabasePushHoursIo(client: unknown = supabase): PushHoursIo {
  const db = client as SupabaseClient
  return {
    async load(userId) {
      const result = await db.from('user_push_hours').select('days, opens, closes').eq('user_id', userId).maybeSingle()
      if (result.error) return null
      return parsePushHours(result.data as { days?: unknown; opens?: unknown; closes?: unknown } | null)
    },
    async save(userId, hours) {
      const result = await db.from('user_push_hours').upsert({ user_id: userId, ...pushRowOf(hours), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      checkSupabaseError(result, 'save your hours')
    },
    async clear(userId) {
      const result = await db.from('user_push_hours').delete().eq('user_id', userId)
      checkSupabaseError(result, 'save your hours')
    },
  }
}
