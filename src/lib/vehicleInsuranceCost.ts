/**
 * Vehicle insurance cost (v2.2180): the per-vehicle figure lives in
 * `vehicles.weekly_insurance_cost` (pay stubs + the fleet total read it).
 * Carriers quote per month or per year, so the card takes any unit and
 * stores weekly; these helpers keep the math in one place.
 */

export type InsuranceCostUnit = 'wk' | 'mo' | 'yr'

export const INSURANCE_COST_UNITS: ReadonlyArray<{ key: InsuranceCostUnit; label: string }> = [
  { key: 'wk', label: '/ wk' },
  { key: 'mo', label: '/ mo' },
  { key: 'yr', label: '/ yr' },
]

const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12

/** Typed amount in `unit` → weekly dollars, rounded to the cent. null when not a usable number. */
export function weeklyInsuranceCostFromInput(raw: string, unit: InsuranceCostUnit): number | null {
  const n = parseFloat(raw.replace(/[$,\s]/g, ''))
  if (!Number.isFinite(n) || n < 0) return null
  const weekly = unit === 'wk' ? n : unit === 'mo' ? (n * MONTHS_PER_YEAR) / WEEKS_PER_YEAR : n / WEEKS_PER_YEAR
  return Math.round(weekly * 100) / 100
}

/** Weekly dollars → the three views the card shows. */
export function insuranceCostViews(weekly: number): { wk: number; mo: number; yr: number } {
  const w = Math.max(0, weekly)
  return { wk: w, mo: (w * WEEKS_PER_YEAR) / MONTHS_PER_YEAR, yr: w * WEEKS_PER_YEAR }
}

function usd(n: number, cents: boolean): string {
  return cents
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Math.round(n).toLocaleString('en-US')}`
}

/** "$52.00/wk · ≈ $225/mo · $2,704/yr" — the card's always-on line. */
export function formatInsuranceCostLine(weekly: number): string {
  const v = insuranceCostViews(weekly)
  return `${usd(v.wk, true)}/wk · ≈ ${usd(v.mo, false)}/mo · ${usd(v.yr, false)}/yr`
}

/**
 * What the fleet actually pays this week for a vehicle (D5): the stored cost
 * while it sits on a plan, $0 while it's off one — the number itself is kept
 * so re-adding the vehicle doesn't lose it.
 */
export function effectiveWeeklyInsuranceCost(weeklyCost: number | null | undefined, onPlan: boolean): number {
  return onPlan ? Math.max(0, weeklyCost ?? 0) : 0
}

/** Plan roll-up for the Insurance plans modal: total of priced vehicles + how many have no cost yet. */
export function insurancePlanTotals(weeklyCosts: ReadonlyArray<number | null | undefined>): {
  weekly: number
  priced: number
  unpriced: number
} {
  let weekly = 0
  let priced = 0
  let unpriced = 0
  for (const c of weeklyCosts) {
    if (c != null && c > 0) {
      weekly += c
      priced++
    } else unpriced++
  }
  return { weekly: Math.round(weekly * 100) / 100, priced, unpriced }
}
