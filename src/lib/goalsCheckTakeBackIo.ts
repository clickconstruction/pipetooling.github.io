/**
 * Taking today's goals check back (punch list #443, row 19): the reads and the delete. The rule is
 * `goalsCheckTakeBack.ts`.
 *
 * All of it runs as the signed-in person, on that person's own rows. `user_daily_goals_ack` has one policy, for
 * every statement, that lets a person reach the rows under their own `user_id`, so the delete needs no migration
 * and can reach nobody else's record.
 */
import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { GOALS_CHECK_NOT_TAKEN_BACK, type GoalsCheckToday } from './goalsCheckTakeBack'

/** A count read with no rows. Throws when the read fails or answers no count, so nothing is said on half an answer. */
function countOf(result: { count: number | null; error: unknown }): number {
  if (result.error) throw result.error
  if (typeof result.count !== 'number') throw new Error('Today’s check could not be read. Nothing was taken back.')
  return result.count
}

/**
 * The person's own day: the records that the check was passed, how many goals they have, and how many clock
 * sessions they have today. `days` is `goalsCheckDays`. Throws when any of the three reads fails.
 */
export async function readGoalsCheckToday(userId: string, days: ReadonlyArray<string>): Promise<GoalsCheckToday> {
  const [acks, goals, sessions] = await Promise.all([
    withSupabaseRetry(
      () => supabase.from('user_daily_goals_ack').select('local_date, completed_at').eq('user_id', userId).in('local_date', [...days]).order('local_date', { ascending: true }),
      'read today’s goals check',
    ),
    supabase.from('user_dashboard_goals').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('clock_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('work_date', [...days]),
  ])
  return {
    acks: (acks ?? []).map((a) => ({ localDate: a.local_date, completedAtIso: a.completed_at })),
    goals: countOf(goals),
    sessions: countOf(sessions),
  }
}

/**
 * Take the person's own records for today back. The delete is sent once, names the one `user_id` and the days, and
 * a delete that reaches no row is said. Returns how many records went.
 */
export async function takeGoalsCheckBack(userId: string, days: ReadonlyArray<string>): Promise<number> {
  if (!userId || days.length === 0) throw new Error(GOALS_CHECK_NOT_TAKEN_BACK)
  const gone = await withSupabaseRetry(
    () => supabase.from('user_daily_goals_ack').delete().eq('user_id', userId).in('local_date', [...days]).select('local_date'),
    'take today’s goals check back',
    { maxRetries: 0 },
  )
  if (!gone || gone.length === 0) throw new Error(GOALS_CHECK_NOT_TAKEN_BACK)
  return gone.length
}
