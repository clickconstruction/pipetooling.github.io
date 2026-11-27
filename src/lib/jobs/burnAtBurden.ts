/**
 * The burn at the burden (punch list #448). A job's budget prices its labor hours at the crew rate, which is the
 * average field wage times the burden factor (`app_settings.labor_burden_factor_v1`, 1.20 as seeded). The burn
 * counted the same hours at raw wages, so one comparison used two rulers. The burn's team labor is priced at the
 * burden here, before it reaches `buildJobBurn`, and nothing else is: subs and parts pass as they are, and the
 * Costs tab's own labor lines keep the wages paid.
 *
 * Pure, and read by the client alone. `jobBurn.ts` is copied to the edge functions and is not touched: the
 * multiply happens on the events on their way in, so no function is behind after this.
 */
import { val } from '../valuesInPlace'
import { moneyWords } from '../moneyParts'

/** The charge events' source for a person's clocked hours at their wage. */
const TEAM_LABOR = 'team_labor'

/** A factor the burn can use: a number of 1 or more. Anything else reads as 1, the wages as they are. */
export function burnBurden(factor: number | null | undefined): number {
  return typeof factor === 'number' && Number.isFinite(factor) && factor >= 1 ? factor : 1
}

/** Wages priced at the burden. */
export function laborAtBurden(wagesUsd: number, factor: number | null | undefined): number {
  return (Number(wagesUsd) || 0) * burnBurden(factor)
}

/**
 * The job's charge events as the burn reads them: each team labor event at its wage times the burden, every other
 * event as it is. The list handed in is not changed, and a factor of 1 hands the same list back.
 */
export function chargeEventsAtBurden<E extends { source: string; amount: number }>(events: readonly E[], factor: number | null | undefined): readonly E[] {
  const f = burnBurden(factor)
  if (f === 1) return events
  return events.map((e) => (e.source === TEAM_LABOR ? { ...e, amount: (Number(e.amount) || 0) * f } : e))
}

/** The burn's labor, with what it stands on: the wages paid, the factor, and the two multiplied. */
export type BurnLabor = { wagesUsd: number; burden: number; usd: number }

export function burnLaborOf(wagesUsd: number, factor: number | null | undefined): BurnLabor {
  const burden = burnBurden(factor)
  return { wagesUsd: Number(wagesUsd) || 0, burden, usd: laborAtBurden(wagesUsd, burden) }
}

/** `1.20`, `1.25`, `1.2` never: the factor to two places, as Settings shows it. */
export const burdenWords = (factor: number): string => burnBurden(factor).toFixed(2)

const usd0 = (n: number): string => moneyWords(Math.round(n), { cents: false })

/** `$3,000 wages × 1.20`, its two values marked: what stands behind the Labor row's dollars. */
export function burnLaborBasisWords(l: BurnLabor): string {
  return `${val('wages', usd0(l.wagesUsd))} wages × ${val('burden', burdenWords(l.burden))}`
}

/** `labor $3,000 wages × 1.20 = $3,600`, its three values marked: the one line on the Spent so far tile. */
export function burnLaborLineWords(l: BurnLabor): string {
  return `labor ${burnLaborBasisWords(l)} = ${val('labor', usd0(l.usd))}`
}
