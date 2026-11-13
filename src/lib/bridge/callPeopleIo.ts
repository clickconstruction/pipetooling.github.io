import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { callPeople, type CallPerson } from './callPeople'

/**
 * The read behind `callPeople.ts` (v2.6864). The viewer's own moves, their Done press and the marks on a call went
 * with the call workflow (punch list #334, PR 7), so nothing here calls `bridge_my_moves` or
 * `bridge_mark_my_move_done` any more.
 */

/** Every teammate's own account, as the owner and the devs read the users. */
export async function loadCallPeople(db: SupabaseClient<Database>): Promise<CallPerson[]> {
  const rows = (await withSupabaseRetry(async () => db.from('users').select('id, name, role, archived_at, is_digital_twin, read_only'), 'bridge call people')) as Array<{ id: string; name: string | null; role: string | null; archived_at: string | null; is_digital_twin: boolean | null; read_only: boolean | null }> | null
  return callPeople((rows ?? []).map((u) => ({ userId: u.id, name: u.name ?? '', role: u.role, archived: !!u.archived_at, twin: !!u.is_digital_twin, readOnly: !!u.read_only })))
}
