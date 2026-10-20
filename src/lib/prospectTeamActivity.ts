import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { checkSupabaseError, withSupabaseRetry } from '../utils/errorHandling'
import { isZzTestName } from './jobs/zzTestJobSweep'

export type ProspectTeamRow = {
  user_id: string
  name: string
  email: string | null
  cards_marked: number
  cards_updated: number
}

/**
 * Last 30 calendar days of prospect calling activity: per user per day, unique prospect_ids
 * from timer events ("Marked") and from comments ("Updated"). Same aggregation as Prospects → Team.
 */
export async function loadProspectTeamActivity(
  supabase: SupabaseClient<Database>,
  /** One kind of prospect (v2.5563, the Activity tab of a lane); missing: every kind (Quickfill's team chart). */
  kind?: string,
  /** `hideZz` (v2.5583): leave out the touches on ZZ-named prospects, the ZZ rule for everyone but a dev. */
  opts?: { hideZz?: boolean },
): Promise<Record<string, ProspectTeamRow[]>> {
  const hideZz = opts?.hideZz === true
  // The prospect ridden along: its kind when a lane is asked for, its name when ZZ rows are hidden.
  const prospectJoin = kind || hideZz ? `, prospect:prospects!inner(${[kind ? 'kind' : '', hideZz ? 'company_name' : ''].filter(Boolean).join(', ')})` : ''
  return await withSupabaseRetry(
    async () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - 29)
      const startIso = startDate.toISOString()
      const endIso = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString()

      const [usersRes, timerRes, commentsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, email, role')
          // Office roles plus estimators who were granted Prospects access.
          .or('role.in.(dev,master_technician,assistant,controller),and(role.eq.estimator,estimator_prospects_access.eq.true)')
          .order('name'),
        kind
          ? supabase
              .from('prospect_timer_events')
              .select(`user_id, prospect_id, created_at${prospectJoin}`)
              .eq('prospect.kind', kind)
              .gte('created_at', startIso)
              .lte('created_at', endIso)
          : supabase
              .from('prospect_timer_events')
              .select(`user_id, prospect_id, created_at${prospectJoin}`)
              .gte('created_at', startIso)
              .lte('created_at', endIso),
        kind
          ? supabase
              .from('prospect_comments')
              .select(`created_by, prospect_id, created_at${prospectJoin}`)
              .eq('prospect.kind', kind)
              .gte('created_at', startIso)
              .lte('created_at', endIso)
          : supabase
              .from('prospect_comments')
              .select(`created_by, prospect_id, created_at${prospectJoin}`)
              .gte('created_at', startIso)
              .lte('created_at', endIso),
      ])

      checkSupabaseError(usersRes, 'load prospect team users')
      checkSupabaseError(timerRes, 'load prospect team timer events')
      checkSupabaseError(commentsRes, 'load prospect team comments')

      const users = (usersRes.data ?? []) as Array<{
        id: string
        name: string | null
        email: string | null
        role: string
      }>
      type Ridden = { prospect?: { company_name?: string | null } | null }
      const keep = (r: Ridden) => !hideZz || !isZzTestName(r.prospect?.company_name)
      const timerRows = ((timerRes.data ?? []) as unknown as Array<{
        user_id: string
        prospect_id: string | null
        created_at: string
      } & Ridden>).filter(keep)
      const commentRows = ((commentsRes.data ?? []) as unknown as Array<{
        created_by: string
        prospect_id: string
        created_at: string
      } & Ridden>).filter(keep)

      const userList: ProspectTeamRow[] = users.map((u) => ({
        user_id: u.id,
        name: (u.name || u.email || 'Unknown').trim(),
        email: u.email,
        cards_marked: 0,
        cards_updated: 0,
      }))

      const markedByDateUser = new Map<string, Map<string, Set<string>>>()
      const updatedByDateUser = new Map<string, Map<string, Set<string>>>()
      function getDateKey(iso: string): string {
        const d = new Date(iso)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      for (const r of timerRows) {
        if (r.prospect_id) {
          const dk = getDateKey(r.created_at)
          let byUser = markedByDateUser.get(dk)
          if (!byUser) {
            byUser = new Map()
            markedByDateUser.set(dk, byUser)
          }
          const set = byUser.get(r.user_id) ?? new Set()
          set.add(r.prospect_id)
          byUser.set(r.user_id, set)
        }
      }
      for (const r of commentRows) {
        const dk = getDateKey(r.created_at)
        let byUser = updatedByDateUser.get(dk)
        if (!byUser) {
          byUser = new Map()
          updatedByDateUser.set(dk, byUser)
        }
        const set = byUser.get(r.created_by) ?? new Set()
        set.add(r.prospect_id)
        byUser.set(r.created_by, set)
      }

      const result: Record<string, ProspectTeamRow[]> = {}
      for (let i = 0; i < 30; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - (29 - i))
        const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const markedByUser = markedByDateUser.get(dk)
        const updatedByUser = updatedByDateUser.get(dk)
        result[dk] = userList.map((u) => ({
          ...u,
          cards_marked: markedByUser?.get(u.user_id)?.size ?? 0,
          cards_updated: updatedByUser?.get(u.user_id)?.size ?? 0,
        }))
      }
      return { data: result, error: null }
    },
    'load prospect team activity',
  )
}
