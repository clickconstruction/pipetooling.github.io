/**
 * The bills and receipts lists behind Money (v2.6840, punch list #303, PR 2): the page shows the
 * next fourteen days, and the rest of the eight weeks waits behind one press. The two lists were
 * the longest block on the page, 2.1 phone screens at its very bottom.
 */

export const MONEY_LIST_DAYS = 14

export type ListWindow<T> = {
  /** The rows to draw: the next fourteen days, or all of them. */
  shown: T[]
  /** What the fourteen days leave out: how many days have something, and the dollars on them. */
  later: { count: number; usd: number }
}

/** `rows` are in day order; `lastYmd` is the last day of the fourteen. */
export function listWindow<T extends { ymd: string; usd: number }>(rows: ReadonlyArray<T>, lastYmd: string, all: boolean): ListWindow<T> {
  const near = rows.filter((r) => r.ymd <= lastYmd)
  const far = rows.filter((r) => r.ymd > lastYmd)
  return { shown: all ? [...rows] : near, later: { count: far.length, usd: far.reduce((s, r) => s + r.usd, 0) } }
}

/** The press under a list: "Show the 6 later days, $41.2k", or the way back; null when the fourteen days hold everything. */
export function laterPress(later: { count: number; usd: number }, all: boolean, money: (usd: number) => string): string | null {
  if (later.count === 0) return null
  if (all) return `Show the next ${MONEY_LIST_DAYS} days only`
  return `Show the ${later.count} later ${later.count === 1 ? 'day' : 'days'}, ${money(later.usd)}`
}
