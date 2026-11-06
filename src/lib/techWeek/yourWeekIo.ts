/**
 * The Your week card's reads (punch list #255, v2.6589): `my_week()` and `my_customer_words()`, both answering for the
 * signed-in person alone. Untyped until the types PR after the push; a function not there yet reads as a failure the
 * card draws nothing for.
 */
import { supabase } from '../supabase'

export type YourWeekIo = { myWeek(): Promise<unknown>; myWords(): Promise<unknown> }

type Rpc = { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> }
export function supabaseYourWeekIo(client: unknown = supabase): YourWeekIo {
  const db = client as Rpc
  const read = async (fn: string): Promise<unknown> => {
    const r = await db.rpc(fn)
    if (r.error) throw r.error
    return r.data
  }
  return { myWeek: () => read('my_week'), myWords: () => read('my_customer_words') }
}

