import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type DashboardGoalRow = {
  id: string
  user_id: string
  body: string
  sort_order: number
}

/** Load goals for a user, ordered. */
export async function fetchUserDashboardGoals(userId: string): Promise<DashboardGoalRow[]> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('user_dashboard_goals')
        .select('id, user_id, body, sort_order')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
    'fetch user dashboard goals',
  )
  return (data ?? []) as DashboardGoalRow[]
}

/** Whether user has ack'd goals for this calendar date (YYYY-MM-DD). */
export async function hasAckForLocalDate(userId: string, localDate: string): Promise<boolean> {
  const data = await withSupabaseRetry(
    async () =>
      await supabase
        .from('user_daily_goals_ack')
        .select('user_id')
        .eq('user_id', userId)
        .eq('local_date', localDate)
        .maybeSingle(),
    'fetch daily goals ack',
  )
  return data != null
}

/** After a clock_sessions insert: true if this was the first session for that work_date. */
export async function isFirstSessionOfWorkDate(userId: string, workDate: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('clock_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('work_date', workDate)
  if (error) throw new Error(error.message)
  return (count ?? 0) === 1
}

/** After first clock-in insert of the day: show gate if goals exist and no ack. */
export async function shouldOpenGateAfterFirstClockIn(userId: string, workDate: string): Promise<boolean> {
  const first = await isFirstSessionOfWorkDate(userId, workDate)
  if (!first) return false
  const goals = await fetchUserDashboardGoals(userId)
  if (goals.length === 0) return false
  if (await hasAckForLocalDate(userId, workDate)) return false
  return true
}

/** On app load: show gate if goals exist, no ack, and user already has a session today (refresh mid-flow). */
export async function shouldOpenGateOnAppLoad(userId: string, localDate: string): Promise<boolean> {
  const goals = await fetchUserDashboardGoals(userId)
  if (goals.length === 0) return false
  if (await hasAckForLocalDate(userId, localDate)) return false
  const { count, error } = await supabase
    .from('clock_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('work_date', localDate)
  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export async function upsertDailyGoalsAck(userId: string, localDate: string): Promise<void> {
  const { error } = await supabase.from('user_daily_goals_ack').upsert(
    {
      user_id: userId,
      local_date: localDate,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,local_date' },
  )
  if (error) throw new Error(error.message)
}
