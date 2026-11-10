import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { isMissingRpcError } from '../customers/customersListBundle'
import { callPeople, parseMoveMarks, parseMyMoves, type CallPerson, type MoveMark, type MyMove } from './callPeople'

/**
 * The reads and the write behind `callPeople.ts` (v2.6864). The two functions arrive with the
 * migration `20261110213000_bridge_moves_reach_people`; until it is pushed the read answers
 * with no moves, so the Needs you card is as it was.
 */

/** The viewer's own open moves on the standing call. Empty when the function is not there yet. */
export async function loadMyBridgeMoves(db: SupabaseClient<Database>): Promise<MyMove[]> {
  const { data, error } = await db.rpc('bridge_my_moves' as never)
  if (error) {
    if (isMissingRpcError(error.message)) return []
    throw new Error(error.message)
  }
  return parseMyMoves(data)
}

/** The viewer says one of their moves is done. Throws the function's own words when it refuses. */
export async function markMyBridgeMoveDone(db: SupabaseClient<Database>, callId: string, idx: number): Promise<void> {
  const { data, error } = await db.rpc('bridge_mark_my_move_done' as never, { p_call_id: callId, p_idx: idx } as never)
  if (error) throw new Error(error.message)
  const answer = (data ?? {}) as { error?: unknown }
  if (typeof answer.error === 'string' && answer.error) throw new Error(answer.error)
}

/** The accounts a move can go to: every teammate's own account, as the owner and the devs read the users. */
export async function loadCallPeople(db: SupabaseClient<Database>): Promise<CallPerson[]> {
  const rows = (await withSupabaseRetry(async () => db.from('users').select('id, name, role, archived_at, is_digital_twin, read_only'), 'bridge call people')) as Array<{ id: string; name: string | null; role: string | null; archived_at: string | null; is_digital_twin: boolean | null; read_only: boolean | null }> | null
  return callPeople((rows ?? []).map((u) => ({ userId: u.id, name: u.name ?? '', role: u.role, archived: !!u.archived_at, twin: !!u.is_digital_twin, readOnly: !!u.read_only })))
}

/** The Done stamps on the newest calls, for the Bridge's card. The owner and the devs read the table itself. */
export async function loadMoveMarks(db: SupabaseClient<Database>, limit = 6): Promise<MoveMark[]> {
  const rows = (await withSupabaseRetry(
    async () => db.from('bridge_calls').select('id, moves').order('week_start', { ascending: false }).order('created_at', { ascending: false }).limit(limit),
    'bridge call marks',
  )) as Array<{ id: string; moves: unknown }> | null
  return parseMoveMarks(rows ?? [])
}
