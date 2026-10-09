// The Review tab's 90-day overhead rates, read off the shared scan (`lib/overheadPoolSnapshot.ts`)
// that People → Overhead, the Dashboard, the Bridge and the job day ledger read: the pool (office +
// bid labor, office parts), the field denominators, the invoices sent, and the three rates they
// give. Review ran its own copy of the scan until v2.5014 (the owner's call of 2026-10-09). The copy
// agreed to the cent (the parity check of 2026-09-27) and differed only in two bad reads, which now
// go the shared way: a person-link read that fails prices by name instead of blanking the rates,
// and a pay config past PostgREST's 1,000 rows is read whole.

import { loadOverheadPoolSnapshot, loadOverheadPoolSnapshotInputs, type OverheadPoolSnapshot } from '../overheadPoolSnapshot'

export type ReviewOverheadRates = {
  ratePerHour: number | null
  ratePerRevenueDecimal: number | null
  ratePerLaborDollar: number | null
  loading: boolean
  windowStart: string | null
  windowEnd: string | null
  officeLabor90d: number | null
  bidLabor90d: number | null
  officeParts90d: number | null
  invoices90d: number | null
  fieldHours90d: number | null
  fieldLaborUsd90d: number | null
}

/** Nothing loaded: what the tab starts with, and what a failed scan resets to. */
export const EMPTY_REVIEW_OVERHEAD_RATES: ReviewOverheadRates = {
  ratePerHour: null,
  ratePerRevenueDecimal: null,
  ratePerLaborDollar: null,
  loading: false,
  windowStart: null,
  windowEnd: null,
  officeLabor90d: null,
  bidLabor90d: null,
  officeParts90d: null,
  invoices90d: null,
  fieldHours90d: null,
  fieldLaborUsd90d: null,
}

/** The twelve figures Review shows, off the shared snapshot. */
export function reviewOverheadRatesFromSnapshot(snap: OverheadPoolSnapshot): ReviewOverheadRates {
  return {
    ratePerHour: snap.rates.methodA,
    ratePerRevenueDecimal: snap.rates.methodB,
    ratePerLaborDollar: snap.rates.methodC,
    loading: false,
    windowStart: snap.windowStart,
    windowEnd: snap.windowEnd,
    officeLabor90d: snap.poolTrend.totals.officeLaborUsd,
    bidLabor90d: snap.poolTrend.totals.bidLaborUsd,
    officeParts90d: snap.poolTrend.totals.officePartsUsd,
    invoices90d: snap.lensDetail.denominators.invoicedRevenueUsd,
    fieldHours90d: snap.lensDetail.denominators.fieldHours,
    fieldLaborUsd90d: snap.lensDetail.denominators.fieldLaborUsd,
  }
}

/**
 * Runs the shared scan. Null when the caller cancelled while it was in flight; throws when a read
 * fails, which the hook turns into the all-null reset.
 */
export async function loadReviewOverheadRates(
  opts: { isCancelled?: () => boolean } = {},
): Promise<ReviewOverheadRates | null> {
  const inputs = await loadOverheadPoolSnapshotInputs()
  if (opts.isCancelled?.() === true) return null
  const snap = await loadOverheadPoolSnapshot(inputs, opts)
  return snap ? reviewOverheadRatesFromSnapshot(snap) : null
}
