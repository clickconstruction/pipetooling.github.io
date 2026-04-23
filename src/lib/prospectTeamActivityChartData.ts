import type { ProspectTeamRow } from './prospectTeamActivity'

/** Local calendar YYYY-MM-DD (matches `loadProspectTeamActivity` date keys). */
export function dateKeyForLocalDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Oldest → newest: 30 days ending today (same window as `loadProspectTeamActivity`). */
export function getOrderedDateKeysLast30Days(): string[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const out: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    out.push(dateKeyForLocalDay(d))
  }
  return out
}

export function formatProspectTeamDateLabelShort(dateKey: string): string {
  const parts = dateKey.split('-')
  const y = parseInt(parts[0] ?? '', 10)
  const mo = parseInt(parts[1] ?? '', 10)
  const day = parseInt(parts[2] ?? '', 10)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(day)) return dateKey
  const dt = new Date(y, mo - 1, day)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export type ProspectTeamChartUserSeries = { userId: string; name: string }

/** One Recharts row per day: `dateKey`, `dateLabel`, plus each `userId` → Marked+Updated sum. */
export type ProspectTeamChartRow = Record<string, string | number>

export function buildProspectTeamActivityChartData(
  teamDataByDate: Record<string, ProspectTeamRow[]>,
): { chartRows: ProspectTeamChartRow[]; userSeries: ProspectTeamChartUserSeries[] } {
  const orderedKeys = getOrderedDateKeysLast30Days()
  let roster: ProspectTeamRow[] = []
  for (const k of orderedKeys) {
    const rows = teamDataByDate[k]
    if (rows && rows.length > 0) {
      roster = rows
      break
    }
  }
  if (roster.length === 0) {
    return { chartRows: [], userSeries: [] }
  }
  const userSeries: ProspectTeamChartUserSeries[] = roster.map((r) => ({
    userId: r.user_id,
    name: r.name,
  }))

  const chartRows: ProspectTeamChartRow[] = orderedKeys.map((dateKey) => {
    const rows = teamDataByDate[dateKey] ?? []
    const byId = new Map(rows.map((r) => [r.user_id, r]))
    const row: ProspectTeamChartRow = {
      dateKey,
      dateLabel: formatProspectTeamDateLabelShort(dateKey),
    }
    for (const u of userSeries) {
      const r = byId.get(u.userId)
      const n = r ? r.cards_marked + r.cards_updated : 0
      row[u.userId] = n
    }
    return row
  })

  return { chartRows, userSeries }
}
