/**
 * The crew rate a bid is costed at (the Labor refresh PR 4): one company
 * number, never blank, with a per-bid override.
 *
 *   company rate = the average recorded field wage over the last 90 days
 *                  (Σ wage-priced field labor $ ÷ Σ field hours, off the job
 *                  day ledger People → Overhead already builds) × the burden
 *                  factor (`app_settings.labor_burden_factor_v1`, 1.20 by default)
 *
 * The per-bid override is `cost_estimates.labor_rate`. When it is set it wins;
 * when it is null the New view reads the company rate and offers to write it
 * onto the bid so Pricing and the documents read the same number.
 *
 * Overhead per field hour (lens A over the same 90 days: pool ÷ field hours)
 * rides along as a fact — shown beside the rate, never added to the direct
 * cost (the job's Burn treats overhead the same way). Pure.
 */
import type { JobDayLedgerDay } from '../jobs/jobDayLedger'

export const CREW_RATE_WINDOW_DAYS = 90

export type CrewRate = {
  /** Σ field labor $ ÷ Σ field hours over the window; null when no field hours were recorded. */
  avgFieldWage: number | null
  fieldHours: number
  burden: number
  /** avgFieldWage × burden; null with avgFieldWage. */
  companyRate: number | null
  /** Overhead pool ÷ field hours over the window (lens A); null without field hours. */
  overheadPerFieldHour: number | null
  fromYmd: string
  toYmd: string
}

/** The company rate off the day ledger's days, restricted to [fromYmd, toYmd]. */
export function crewRateFromLedgerDays(days: ReadonlyArray<Pick<JobDayLedgerDay, 'ymd' | 'fieldHours' | 'fieldLaborUsd' | 'poolUsd'>>, args: { fromYmd: string; toYmd: string; burden: number }): CrewRate {
  let fieldHours = 0
  let fieldLaborUsd = 0
  let poolUsd = 0
  for (const d of days) {
    if (d.ymd < args.fromYmd || d.ymd > args.toYmd) continue
    fieldHours += Number(d.fieldHours) || 0
    fieldLaborUsd += Number(d.fieldLaborUsd) || 0
    poolUsd += Number(d.poolUsd) || 0
  }
  const burden = Number.isFinite(args.burden) && args.burden >= 1 ? args.burden : 1
  const avgFieldWage = fieldHours > 0 ? fieldLaborUsd / fieldHours : null
  return {
    avgFieldWage,
    fieldHours,
    burden,
    companyRate: avgFieldWage != null ? avgFieldWage * burden : null,
    overheadPerFieldHour: fieldHours > 0 ? poolUsd / fieldHours : null,
    fromYmd: args.fromYmd,
    toYmd: args.toYmd,
  }
}

export type EffectiveLaborRate = {
  rate: number | null
  /** Where the number came from: the bid's own box, the company rate, or nothing yet. */
  source: 'override' | 'company' | 'none'
}

/** The rate a bid is costed at right now: its override when set (> 0), else the company rate, else nothing. */
export function effectiveLaborRate(args: { override: number | null | undefined; companyRate: number | null | undefined }): EffectiveLaborRate {
  if (args.override != null && Number.isFinite(args.override) && args.override > 0) return { rate: args.override, source: 'override' }
  if (args.companyRate != null && Number.isFinite(args.companyRate) && args.companyRate > 0) return { rate: args.companyRate, source: 'company' }
  return { rate: null, source: 'none' }
}

/** "$35.76 / h = $29.80 avg recorded field wage (90 d) × 1.20 burden" — the card's one line. */
export function crewRateWords(r: CrewRate, fmt: (n: number) => string): string {
  if (r.companyRate == null || r.avgFieldWage == null) return `no recorded field hours in the last ${CREW_RATE_WINDOW_DAYS} days`
  return `$${fmt(r.avgFieldWage)} avg recorded field wage (${CREW_RATE_WINDOW_DAYS} d, ${Math.round(r.fieldHours).toLocaleString('en-US')} h) × ${r.burden.toFixed(2)} burden`
}
