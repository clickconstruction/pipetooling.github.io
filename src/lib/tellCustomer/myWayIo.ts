/**
 * My way (v2.5597): the signed-in person's row in `tell_customer_prefs`, read fail-soft (no row, or a table not there
 * yet, reads as ask) and written one moment at a time.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { MY_WAY_DEFAULT, myWaysFrom, type MyWay, type MyWays } from './myWay'
import type { TellMoment } from './tellCustomer'

export interface MyWayIo {
  load(userId: string): Promise<MyWays>
  set(userId: string, moment: Exclude<TellMoment, 'rescheduled'>, way: MyWay): Promise<MyWays>
}

export function supabaseMyWayIo(client: unknown = supabase): MyWayIo {
  const db = client as SupabaseClient
  return {
    async load(userId) {
      const result = await db.from('tell_customer_prefs').select('booked, estimate').eq('user_id', userId).maybeSingle()
      if (result.error) return MY_WAY_DEFAULT
      return myWaysFrom(result.data as { booked?: unknown; estimate?: unknown } | null)
    },
    async set(userId, moment, way) {
      const was = await this.load(userId)
      const next: MyWays = { ...was, [moment]: way }
      const result = await db.from('tell_customer_prefs').upsert({ user_id: userId, booked: next.booked, estimate: next.estimate, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      checkSupabaseError(result, 'save your way')
      return next
    },
  }
}
