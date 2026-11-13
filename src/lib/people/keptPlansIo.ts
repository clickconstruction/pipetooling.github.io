import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { KeptPlanRow } from './keptPlans'

/**
 * The read of the plans kept for a yes (`dev_seat_kept_plans`, punch list #315, upgrade 3a). The table is a dev's
 * alone by its RLS. The list reads the words and never the arguments: `args` and `reply` hold the plan itself and are
 * not selected here. Waiting and stale rows only, since those are what the list shows.
 *
 * Fail-soft: a read that fails names its reason and the list is simply not drawn. The table is not in the generated
 * types until the types PR after its migration, so the client is read untyped here.
 */
const db = supabase as unknown as import('@supabase/supabase-js').SupabaseClient

const COLUMNS = 'id, person_id, verb, words, author_label, session_label, kept_at, state, decided_label, decided_at, decided_why'

type Res<T> = { data: T | null; error: { message: string } | null }

export async function loadKeptPlans(): Promise<{ rows: KeptPlanRow[]; heldWhy: string | null }> {
  try {
    const r = (await db.from('dev_seat_kept_plans').select(COLUMNS).in('state', ['waiting', 'stale']).order('kept_at', { ascending: true }).limit(200)) as unknown as Res<KeptPlanRow[]>
    if (r.error) return { rows: [], heldWhy: r.error.message }
    return { rows: r.data ?? [], heldWhy: null }
  } catch (e) {
    return { rows: [], heldWhy: formatErrorMessage(e) }
  }
}
