import { supabase } from '../supabase'
import { buildProspectWeekReport, weekRange, type WeekCallRow, type WeekCallbackRow, type WeekReport, type WeekTimerRow } from './prospectWeekReport'
import type { ProspectKind } from './prospectKinds'

/**
 * One lane's week on the Activity tab: who may call, their calls and landings, their timed seconds and the
 * callbacks they set, each read joined to its prospect for the kind (v2.5559), then `buildProspectWeekReport`.
 * Moved out of `src/pages/Prospects.tsx` with the tab; the four reads are unchanged.
 */
export async function loadProspectWeekReport(kind: ProspectKind, offset: number, nowMs: number = Date.now()): Promise<WeekReport> {
  const range = weekRange(nowMs, offset)
  const startIso = new Date(range.startMs).toISOString()
  const endIso = new Date(range.endMs).toISOString()
  const [usersRes, callsRes, timersRes, callbacksRes] = await Promise.all([
    supabase
      .from('users')
      .select('id, name, email, role')
      // Same audience as loadProspectTeamActivity: office roles + estimators with Prospects access.
      .or('role.in.(dev,master_technician,assistant,controller),and(role.eq.estimator,estimator_prospects_access.eq.true)'),
    // Each read joins the prospect for its kind (v2.5559), so the report is one kind's week.
    supabase
      .from('prospect_comments')
      .select('created_by, interaction_type, created_at, prospect:prospects!inner(kind)')
      .in('interaction_type', ['didnt_answer', 'answered', 'converted'])
      .eq('prospect.kind', kind)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the cast the page carried (the map's quirk 1): removed in a types pass, never in a move
    (supabase as any)
      .from('prospect_timer_events')
      .select('user_id, timer_seconds, created_at, prospect:prospects!inner(kind)')
      .eq('prospect.kind', kind)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
    supabase
      .from('prospect_callbacks')
      .select('user_id, created_at, prospect:prospects!inner(kind)')
      .eq('prospect.kind', kind)
      .gte('created_at', startIso)
      .lt('created_at', endIso),
  ])
  const users = ((usersRes.data ?? []) as { id: string; name: string | null; email: string | null }[]).map((u) => ({
    id: u.id,
    name: (u.name || u.email || 'Unknown').trim(),
  }))
  return buildProspectWeekReport(
    (callsRes.data ?? []) as WeekCallRow[],
    (timersRes.data ?? []) as WeekTimerRow[],
    (callbacksRes.data ?? []) as WeekCallbackRow[],
    users,
  )
}
