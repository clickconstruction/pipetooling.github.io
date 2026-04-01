import { supabase } from './supabase'
import { fetchDashboardPhase1 } from './dashboardBootQueries'
import { toLocalDateString } from './dailyGoalsGate'
import { writeDashboardBootCache } from './dashboardBootCache'

/** Warm Phase 1 data for Dashboard (nav hover / idle). Best-effort; ignores errors. */
export async function prefetchDashboardPhase1(authUserId: string): Promise<void> {
  const today = toLocalDateString(new Date())
  try {
    const [userRes, allUsersRes, , checklistRes] = await fetchDashboardPhase1(supabase, authUserId, today)
    if (userRes.error) return
    const user = userRes.data as { name: string | null } | null
    const allUsers = allUsersRes.data ?? []
    const userNamesLower: string[] = []
    for (const u of allUsers) {
      if (u.name) userNamesLower.push(u.name.trim().toLowerCase())
    }
    writeDashboardBootCache(authUserId, today, {
      userName: user?.name ?? null,
      userNamesLower,
      todayChecklist: checklistRes.data ?? [],
    })
  } catch {
    /* ignore */
  }
}
