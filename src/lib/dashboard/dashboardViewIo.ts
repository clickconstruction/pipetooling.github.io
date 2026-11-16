/**
 * The Dashboard view's read and press: `users.dashboard_view` and `set_dashboard_view`. A person reads their own
 * row, and the office reads anyone's on the People desk. Untyped until the types PR after the push. A read that
 * fails answers `full`, so a client that lands before the migration draws the Dashboard as it is today.
 */
import { supabase } from '../supabase'
import { DASHBOARD_VIEW_PICKER_WORDS, parseDashboardView, type DashboardView } from './shortDashboard'

export type DashboardViewIo = { read(userId: string): Promise<DashboardView>; set(userId: string, view: DashboardView): Promise<void> }

type Db = {
  from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } }
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>
}

export function supabaseDashboardViewIo(client: unknown = supabase): DashboardViewIo {
  const db = client as Db
  return {
    async read(userId) {
      const r = await db.from('users').select('dashboard_view').eq('id', userId).maybeSingle()
      if (r.error) return 'full'
      return parseDashboardView((r.data as { dashboard_view?: unknown } | null)?.dashboard_view)
    },
    async set(userId, view) {
      const r = await db.rpc('set_dashboard_view', { p_user_id: userId, p_view: view })
      if (r.error) throw r.error
      const d = (r.data ?? {}) as { ok?: boolean; error?: string }
      if (d.error) throw new Error(d.error)
      if (!d.ok) throw new Error(DASHBOARD_VIEW_PICKER_WORDS.notSaved)
    },
  }
}
