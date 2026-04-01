/** sessionStorage cache for Dashboard Phase 1 payload (stale-while-revalidate). */

export const DASHBOARD_BOOT_CACHE_SCHEMA = 1
export const DASHBOARD_BOOT_CACHE_TTL_MS = 60_000

export type DashboardBootCacheEntry = {
  schema: number
  fetchedAt: number
  userName: string | null
  userNamesLower: string[]
  /** Same shape as checklist_instances select from Dashboard boot */
  todayChecklist: unknown[]
}

function cacheKey(userId: string, todayYmd: string): string {
  return `pt_dashboard_boot_v${DASHBOARD_BOOT_CACHE_SCHEMA}_${userId}_${todayYmd}`
}

export function readDashboardBootCache(userId: string, todayYmd: string): DashboardBootCacheEntry | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(userId, todayYmd))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardBootCacheEntry
    if (parsed.schema !== DASHBOARD_BOOT_CACHE_SCHEMA) return null
    if (typeof parsed.fetchedAt !== 'number' || Date.now() - parsed.fetchedAt > DASHBOARD_BOOT_CACHE_TTL_MS) {
      return null
    }
    if (!Array.isArray(parsed.userNamesLower) || !Array.isArray(parsed.todayChecklist)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeDashboardBootCache(
  userId: string,
  todayYmd: string,
  data: Pick<DashboardBootCacheEntry, 'userName' | 'userNamesLower' | 'todayChecklist'>,
): void {
  try {
    const entry: DashboardBootCacheEntry = {
      schema: DASHBOARD_BOOT_CACHE_SCHEMA,
      fetchedAt: Date.now(),
      userName: data.userName,
      userNamesLower: data.userNamesLower,
      todayChecklist: data.todayChecklist,
    }
    sessionStorage.setItem(cacheKey(userId, todayYmd), JSON.stringify(entry))
  } catch {
    /* quota / private mode */
  }
}
