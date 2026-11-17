/**
 * The time arithmetic of the Follow Up card's clock: the windows My time reads, and the sums over
 * `prospect_timer_events` rows. Moved out of `src/pages/Prospects.tsx`, where each loader wrote its own reduce.
 * Every boundary is the reader's own midnight, as the page has always read it.
 */

/** The seconds of every row, added. A row with no seconds adds nothing. */
export function sumTimerSeconds(rows: readonly { timer_seconds: number | null }[]): number {
  return rows.reduce((acc, r) => acc + (r.timer_seconds ?? 0), 0)
}

/** The seconds added per prospect. A row with no prospect is left out. */
export function sumTimerSecondsByProspect(rows: readonly { prospect_id: string | null; timer_seconds: number | null }[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const r of rows) {
    if (r.prospect_id) {
      map[r.prospect_id] = (map[r.prospect_id] ?? 0) + (r.timer_seconds ?? 0)
    }
  }
  return map
}

export type MyTimeWindows = {
  /** Today's first millisecond, in the reader's zone. */
  startOfToday: Date
  /** Today's last millisecond. */
  endOfToday: Date
  /** Yesterday's first millisecond. Yesterday ends where today starts. */
  startOfYesterday: Date
  /** This moment, seven days back: the last seven days run to now, not to a midnight. */
  sevenDaysAgo: Date
}

export function myTimeWindows(now: Date): MyTimeWindows {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return { startOfToday, endOfToday, startOfYesterday, sevenDaysAgo }
}
