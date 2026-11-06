/**
 * The People desk's week-signal read and press (punch list #255, v2.6589): `users.week_signal` and `set_week_signal`.
 * Untyped until the types PR after the push.
 */
import { supabase } from '../supabase'
import { parseWeekSignal, type WeekSignal } from './weekSignal'

export type WeekSignalIo = { read(userId: string): Promise<WeekSignal | null>; set(userId: string, signal: WeekSignal | null): Promise<void> }

type Db = {
  from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } }
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

export function supabaseWeekSignalIo(client: unknown = supabase): WeekSignalIo {
  const db = client as Db
  return {
    async read(userId) {
      const r = await db.from('users').select('week_signal').eq('id', userId).maybeSingle()
      if (r.error) return null
      return parseWeekSignal((r.data as { week_signal?: unknown } | null)?.week_signal)
    },
    async set(userId, signal) {
      const r = await db.rpc('set_week_signal', { p_user_id: userId, p_signal: signal })
      if (r.error) throw r.error
      const d = (r.data ?? {}) as { ok?: boolean; error?: string }
      if (d.error) throw new Error(d.error)
      if (!d.ok) throw new Error('The signal was not saved.')
    },
  }
}

