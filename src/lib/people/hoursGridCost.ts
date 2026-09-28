/** People → Hours: what a person's day costs on the grid, and the cost-first order the Due summaries read. */

import { effectiveHoursForCost, type SalariedPayConfigFlags } from '../salariedEffectiveHours'

export type HoursGridCostConfig = SalariedPayConfigFlags & { hourly_wage?: number | null }

/** Wage × the hours that count for cost: the flat 8 / 0 for a salaried person, the hours recorded for everyone else. */
export function hoursGridDayCost(cfg: HoursGridCostConfig | undefined, workDate: string, recordedHours: number): number {
  const wage = cfg?.hourly_wage ?? 0
  return wage * effectiveHoursForCost(cfg, workDate, recordedHours)
}

/**
 * The hours recorded for a person's day, read from the grid's rows. Indexed once, so a whole
 * range costs one pass over the rows and not one search per cell; the first row for a
 * person's day wins, as the search it replaces did.
 */
export function recordedHoursLookup(rows: ReadonlyArray<{ person_name: string; work_date: string; hours: number | null }>): (personName: string, workDate: string) => number {
  const byCell = new Map<string, number>()
  for (const r of rows) {
    const key = `${r.person_name}\u0000${r.work_date}`
    if (!byCell.has(key)) byCell.set(key, r.hours ?? 0)
  }
  return (personName, workDate) => byCell.get(`${personName}\u0000${workDate}`) ?? 0
}

/** The people with the highest total first; equal totals keep the order given. Each total is worked out once. */
export function sortPeopleByTotalDesc(people: readonly string[], totalFor: (personName: string) => number): string[] {
  const totals = new Map<string, number>()
  for (const p of people) if (!totals.has(p)) totals.set(p, totalFor(p))
  return [...people].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
}
