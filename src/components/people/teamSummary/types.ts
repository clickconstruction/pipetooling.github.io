// Shared types for the Team Summary inline React surface.
//
// These mirror the types currently defined inline inside `People.tsx`
// (`HoursBreakdown`, `GrossRevenueBreakdown`, `NetRevenueBreakdown`,
// `ProfitAfterOverheadBreakdown`, `OverheadSessionLine`, `TeamSummaryRow`).
// We intentionally redefine them here rather than exporting from `People.tsx`
// to avoid a load-order tangle with the People component's local-function
// scope — the shapes are stable and the structural-typing compiler check
// catches any drift at the wiring site.

export type HoursBreakdown = {
  source: 'salary' | 'hourly' | 'unknown'
  onlyPaidJobs: boolean
  dailyRows: Array<{
    date: string
    hours: number
    crewAllocations: Array<{ hcp: string; jobName: string; address: string; pct: number; hours: number }>
  }>
  subLaborRows: Array<{ hcp: string; date: string; hours: number }>
  totals: {
    daily: number
    crew: number
    subLabor: number
    totalHours: number
  }
}

export type GrossRevenueBreakdown = {
  jobs: Array<{
    jobId: string
    hcp: string
    jobName: string
    totalBill: number
    pctComplete: number
    pctCompleteSource: 'set' | 'assumed'
    valueCreated: number
    totalLaborOnJob: number
    costInPeriod: number
    ratio: number
    allocatedRevenue: number
  }>
  total: number
}

export type NetRevenueBreakdown = {
  jobs: Array<{
    jobId: string
    hcp: string
    jobName: string
    valueCreated: number
    partsCost: number
    totalLaborOnJob: number
    revenueBeforeOverhead: number
    costInPeriod: number
    ratio: number
    allocatedNet: number
  }>
  total: number
}

export type ProfitAfterOverheadBreakdown = {
  jobs: Array<{
    jobId: string
    hcp: string
    jobName: string
    allocatedNet: number
    hoursInPeriod: number
  }>
  totalNet: number
  totalHours: number
  fieldHours: number
  overheadHours: number
  unaccountedHours: number
}

export type OverheadSessionLine = {
  workDate: string
  bucket: 'office' | 'bid'
  /** e.g. "8:00 AM" in the company TZ. */
  startTime: string
  /** e.g. "5:00 PM" in the company TZ. */
  endTime: string
  /** Approved closed session hours. */
  hours: number
  /** Bid display number with "B" prefix (e.g. "B201"). Empty for office. */
  bidHcp: string
  /** Bid project name. Empty for office. */
  bidName: string
  /** Bid address. Empty for office or when address blank. */
  bidAddress: string
}

export type TeamSummaryRow = {
  personName: string
  profit: number
  gross: number
  revPerHour: number
  profitPerHour: number
  totalHours: number
  overheadHours: number
  officeHours: number
  bidHours: number
  fieldHours: number
  hourlyWage: number
  overheadLaborCost: number
  hoursBreakdown: HoursBreakdown
  grossBreakdown: GrossRevenueBreakdown
  netBreakdown: NetRevenueBreakdown
  profitBreakdown: ProfitAfterOverheadBreakdown
  overheadSessions: OverheadSessionLine[]
}

/** Pay-config classification used to label "Source:" rows in the modals. */
export type PayConfigSource = 'salary' | 'hourly' | 'unknown'

/**
 * One row in the breakdowns payload that drives the table + drilldown
 * modals. Built by `enrichTeamSummaryRowsForInline()` from the raw
 * `TeamSummaryRow[]`.
 */
export type TeamSummaryBreakdown = {
  idx: number
  name: string
  hb: HoursBreakdown
  gb: GrossRevenueBreakdown
  nb: NetRevenueBreakdown
  pb: ProfitAfterOverheadBreakdown
  totalHours: number
  overheadHours: number
  officeHours: number
  bidHours: number
  fieldHours: number
  hourlyWage: number
  overheadLaborCost: number
  overheadSessions: OverheadSessionLine[]
  gross: number
  /** Net Revenue (before overhead). Stored under `net` for backward-compat
   * with the iframe code that this component replaces. */
  net: number
  /** Net after overhead deduction; null when overheadRate isn't loaded. */
  profitAfterOverhead: number | null
  revPerHour: number
  netPerHour: number
  profitPerHourAfterOverhead: number | null
  payConfigSource: PayConfigSource
}

/**
 * 90-day overhead rate decomposition used by the "Overhead rate" drilldown.
 * Matches `reviewOverheadRates` in `People.tsx`.
 */
export type OverheadRateDecomp = {
  ratePerHour: number | null
  ratePerRevenueDecimal: number | null
  ratePerLaborDollar: number | null
  windowStart: string | null
  windowEnd: string | null
  officeLabor90d: number
  bidLabor90d: number
  officeParts90d: number
  invoices90d: number
  fieldHours90d: number
  fieldLaborUsd90d: number
}

/** Sort/filter key on the Team Summary table header. */
export type TeamSummarySortKey =
  | 'name'
  | 'totalHours'
  | 'overheadHours'
  | 'overheadLaborCost'
  | 'fieldHours'
  | 'gross'
  | 'net'
  | 'profitAfterOverhead'
  | 'revPerHour'
  | 'netPerHour'
  | 'profitPerHourAfterOverhead'

/** Drilldown modal `type` discriminant. */
export type TeamSummaryDrilldownType =
  | 'hours'
  | 'overhead_hours'
  | 'overhead_labor'
  | 'field_hours'
  | 'gross'
  | 'net'
  | 'profit'
  | 'rev_per_hr'
  | 'net_per_hr'
  | 'profit_per_hr'
  | 'overhead_rate'
