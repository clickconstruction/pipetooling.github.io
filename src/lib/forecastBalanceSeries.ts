/**
 * Forecast balance step-line (v2.1197): cumulative money balance over the dense
 * day rail. Events are dated money deltas — anchored projections land on their
 * step's resolved start (before) or end (after) day; line items land on their
 * own item_date when present, else their step's resolved end day.
 */

export type ForecastBalanceEvent = { ymd: string; delta: number }

export type ForecastBalanceSeries = {
  /** Balance at the END of each day in `dayKeys` (events dated <= that day applied). */
  values: number[]
  /** Balance entering the window: all events dated before dayKeys[0]. */
  initial: number
  min: number
  max: number
  /** Balance after every event, including those beyond the window's end. */
  final: number
}

export function buildForecastBalanceSeries(
  dayKeys: readonly string[],
  events: readonly ForecastBalanceEvent[],
): ForecastBalanceSeries {
  const deltaByYmd = new Map<string, number>()
  let initial = 0
  let total = 0
  const first = dayKeys[0]
  for (const e of events) {
    const d = Number(e.delta) || 0
    total += d
    if (first != null && e.ymd < first) {
      initial += d
      continue
    }
    deltaByYmd.set(e.ymd, (deltaByYmd.get(e.ymd) ?? 0) + d)
  }
  const values: number[] = []
  let running = initial
  let min = initial
  let max = initial
  for (const ymd of dayKeys) {
    running += deltaByYmd.get(ymd) ?? 0
    values.push(running)
    if (running < min) min = running
    if (running > max) max = running
  }
  // `final` counts every event (including any dated past the window's end, which
  // are deliberately not part of the drawn series) so it matches the toolbar chip.
  return { values, initial, min, max, final: total }
}
