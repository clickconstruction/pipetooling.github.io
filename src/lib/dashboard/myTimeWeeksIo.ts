/**
 * The read behind My Time's picture where nothing else on the page reads the clock: Job Mode's card. The person's
 * own sessions for the weeks the picture shows, with only the columns the kernel reads. The full Dashboard's My
 * Time section makes its own wider read, since its job breakdown needs the job and the notes too.
 */
import { supabase } from '../supabase'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { payWeeksEndingAt } from '../people/utilization'
import { MY_TIME_WEEKS, buildMyTimeWeeks, type MyTimeSession, type MyTimeWeek } from './myTimeWeeks'

export type MyTimeWeeksRead = (userId: string) => Promise<MyTimeWeek[]>

/** The weeks as the picture draws them, built at the moment of the read. */
export async function fetchMyTimeWeeks(userId: string): Promise<MyTimeWeek[]> {
  const todayYmd = todayYmdInAppTz()
  const weeks = payWeeksEndingAt(todayYmd, MY_TIME_WEEKS)
  const rows = await withSupabaseRetry(
    async () =>
      await supabase
        .from('clock_sessions')
        .select('work_date, clocked_in_at, clocked_out_at, approved_at')
        .eq('user_id', userId)
        .is('rejected_at', null)
        .is('revoked_at', null)
        .gte('work_date', weeks[0]!.start)
        .lte('work_date', weeks[weeks.length - 1]!.end),
    'load my time weeks',
  )
  return buildMyTimeWeeks({ weeks, sessions: (rows ?? []) as MyTimeSession[], todayYmd, nowMs: Date.now() })
}

/** The current week's hours to a tenth, as Job Mode's This week square prints them. */
export function myTimeThisWeekHours(weeks: readonly MyTimeWeek[]): number {
  const now = weeks.find((w) => w.current)
  return now ? Math.round((now.seconds / 3600) * 10) / 10 : 0
}
