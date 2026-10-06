// People → Review's vehicle line (punch list #52 PR 5, v2.4653). A vehicle deal's fuel stays on the
// jobs it was put on — Review's parts count it as every job screen does — so the person's vehicle
// line charges only their fuel on NO job: read through the same window and kernel as People →
// Spending (`list_card_charges_window`, `buildSpendingRollup`), so Review and Spending agree on it.

import { fetchCardChargesWindow, CARD_CHARGES_WINDOW_MAX_DAYS, type CardChargeWindowRow } from '../banking/cardChargesWindow'
import type { CategoryTagLookups } from '../banking/categoryTags'
import { ymdAddDays } from '../../utils/dateUtils'
import { buildSpendingRollup, type SpendingRollup } from './spendingRollup'
import { loadSpendingDirectory } from './loadSpending'

/**
 * users.id → that person's fuel on no job: fuel-tag card charges (or the part of one) that are not
 * on a job, the Office job, a supply-house invoice or a payroll mark. A refund comes off. Pure.
 */
export function fuelOffJobsByUserId(rollup: SpendingRollup): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rollup.rows) {
    if (!r.who.userId) continue
    const usd = r.looseCharges.filter((l) => l.fuel).reduce((s, l) => s + l.notOnJobUsd, 0)
    if (Math.abs(usd) >= 0.005) out.set(r.who.userId, Math.round(usd * 100) / 100)
  }
  return out
}

/** Company days start..end cut into windows the read accepts (at most 366 days each), in order. Pure. */
export function cardChargeWindows(startYmd: string, endYmd: string): Array<{ startYmd: string; endYmd: string }> {
  const out: Array<{ startYmd: string; endYmd: string }> = []
  let from = startYmd
  while (from <= endYmd) {
    const last = ymdAddDays(from, CARD_CHARGES_WINDOW_MAX_DAYS - 1)
    const to = last < endYmd ? last : endYmd
    out.push({ startYmd: from, endYmd: to })
    from = ymdAddDays(to, 1)
  }
  return out
}

/** The period's card charges, then each person's fuel on no job. Throws when the read fails, so Review can say so. */
export async function loadFuelOffJobsByUserId(args: {
  startYmd: string
  endYmd: string
  lookups: CategoryTagLookups
  fuelTagId: string | null
  officeJobId: string | null
}): Promise<Map<string, number>> {
  if (!args.fuelTagId) return new Map()
  const charges: CardChargeWindowRow[] = []
  for (const w of cardChargeWindows(args.startYmd, args.endYmd)) charges.push(...(await fetchCardChargesWindow(w)))
  const directory = await loadSpendingDirectory(charges)
  const rollup = buildSpendingRollup({
    charges,
    lookups: args.lookups,
    fuelTagId: args.fuelTagId,
    officeJobId: args.officeJobId,
    // Every loose charge is fuel on no job, whatever Tally's sorting floor says.
    sortingFloorYmd: null,
    directory,
  })
  return fuelOffJobsByUserId(rollup)
}
