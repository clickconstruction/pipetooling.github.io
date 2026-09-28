// The Review tab's own 90-day overhead scan, moved verbatim out of the effect
// in `PeopleReviewTab.tsx`: the pool (office + bid labor, office parts), the
// field denominators, the invoices sent, and the three rates they give.
// `lib/overheadPoolSnapshot.ts` runs the same scan for People → Overhead, the
// Dashboard, the Bridge and the job day ledger; Review still reads this one
// (PEOPLE_REVIEW_TAB map, region A — adopt the snapshot only after a parity check).

import { supabase } from '../supabase'
import { fetchAllRows } from '../supabasePaging'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
import {
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  buildOverheadWageLookupByPersonId,
  mergeOverheadDayTableRows,
  type OverheadClockSessionRow,
} from '../overheadDailyLabor'
import { bucketInvoiceRevenueByAppTzDay } from '../overheadAvgDailyCost'
import { computeOverheadRateMethods } from '../overheadRateMethods'
import { loadOfficePartsUsdByDayExcludingInternalTransfer } from '../overheadPartsBucketLoader'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../overheadOfficeJobSettings'

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

/**
 * Runs the scan. Null when the caller cancelled while it was in flight (the
 * two points the effect checked); throws when a read fails — the hook turns
 * that into the all-null reset.
 */
export async function loadReviewOverheadRates(
  opts: { isCancelled?: () => boolean } = {},
): Promise<ReviewOverheadRates | null> {
  const cancelled = () => opts.isCancelled?.() === true
  // Anchor the whole 90-day window on the COMPANY calendar day
  // (America/Chicago), not the viewer's browser-local date — a viewer
  // in another timezone near midnight used to see the entire
  // session/parts/revenue window shifted by a day.
  const today = denverCalendarDayKey(Date.now())
  const start = ymdAddDays(today, -89)
  const officeJobLedgerId = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
  // Paged fetches (fetchAllRows): these are company-wide 90-day scans
  // that silently truncate at PostgREST max_rows (1000) if un-ranged —
  // a truncated field-hours denominator inflates every Method A/B/C
  // rate. Fresh builder per page; `.order('id')` keeps pages stable.
  const sessionSelect =
    'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)'
  const makeOverheadQ = () => {
    let q = supabase.from('clock_sessions').select(sessionSelect).gte('work_date', start).lte('work_date', today)
    if (officeJobLedgerId) {
      q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
    } else {
      q = q.not('bid_id', 'is', null)
    }
    return q.order('id')
  }
  const makeFieldQ = () => {
    let q = supabase
      .from('clock_sessions')
      .select(sessionSelect)
      .gte('work_date', start)
      .lte('work_date', today)
      .not('job_ledger_id', 'is', null)
    if (officeJobLedgerId) q = q.neq('job_ledger_id', officeJobLedgerId)
    return q.order('id')
  }
  // Fetch a day wide on both sides, then re-bucket each invoice into
  // its Chicago calendar day (bucketInvoiceRevenueByAppTzDay — the same
  // tested kernel the Overhead tab's KPI effect uses) — the old
  // UTC-bounded window pulled in the previous evening's invoices and
  // dropped everything sent after ~6pm on the last day.
  const startIsoLow = `${ymdAddDays(start, -1)}T00:00:00-00:00`
  const endIsoHigh = `${ymdAddDays(today, 2)}T00:00:00-00:00`
  const [overheadSessionsRes, fieldSessionsRes, partsRes, invoiceRowsRes, personLinkRows] = await Promise.all([
    fetchAllRows(
      async (f, t) => ({
        data: (await withSupabaseRetry(async () => makeOverheadQ().range(f, t), 'load review 90d overhead sessions')) as unknown as OverheadClockSessionRow[] | null,
        error: null,
      }),
      'load review 90d overhead sessions',
    ),
    fetchAllRows(
      async (f, t) => ({
        data: (await withSupabaseRetry(async () => makeFieldQ().range(f, t), 'load review 90d field sessions')) as unknown as OverheadClockSessionRow[] | null,
        error: null,
      }),
      'load review 90d field sessions',
    ),
    // Shared loader (same one the Overhead tab's 90-day KPI effect
    // uses): office parts by day with Internal Transfers EXCLUDED —
    // they're money moving between the org's own accounts, not an
    // expense. The raw fetch here used to count them, so the Review
    // tab's pool, rates, and split-model partsRate over-charged
    // whenever a transfer hit the office job in the window.
    officeJobLedgerId
      ? loadOfficePartsUsdByDayExcludingInternalTransfer({
          officeJobLedgerId,
          startYmd: start,
          endYmd: today,
        }).then((r) => r.partsUsdByDay)
      : Promise.resolve(new Map<string, number>()),
    fetchAllRows(
      async (f, t) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .select('amount, sent_to_customer_at')
              .gte('sent_to_customer_at', startIsoLow)
              .lt('sent_to_customer_at', endIsoHigh)
              // Stripe TEST-mode invoices are not revenue — keep them
              // out of the Method B denominator. NULL stripe_mode =
              // non-Stripe (HCP/physical) or pre-v2.1114 legacy rows,
              // both real revenue, so a bare .neq() would wrongly drop
              // them under SQL <> NULL semantics.
              .or('stripe_mode.is.null,stripe_mode.neq.test')
              .order('id')
              .range(f, t),
          'load review 90d invoices',
        )) as Array<{ amount: number | null; sent_to_customer_at: string | null }> | null,
        error: null,
      }),
      'load review 90d invoices',
    ),
    // users.id → people.id link rows for the person-id-first wage join
    // (C1): a rename between users.name and pay-config person_name no
    // longer zeroes that person's labor $ in the pool / Method C.
    fetchAllRows(
      async (f, t) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase
              .from('people')
              .select('id, account_user_id')
              .not('account_user_id', 'is', null)
              .is('archived_at', null)
              .order('id')
              .range(f, t),
          'load review 90d person links',
        )) as Array<{ id: string; account_user_id: string | null }> | null,
        error: null,
      }),
      'load review 90d person links',
    ),
  ])
  if (cancelled()) return null
  const cfgRows = await withSupabaseRetry(
    async () =>
      supabase
        .from('people_pay_config')
        .select('person_name, person_id, hourly_wage, office_hourly_wage, is_salary'),
    'load review 90d pay config',
  )
  if (cancelled()) return null
  const cfgList = (cfgRows ?? []) as Array<{
    person_name: string
    person_id: string | null
    hourly_wage: number | null
    office_hourly_wage: number | null
    is_salary: boolean | null
  }>
  // Dual-rate fields included so office/bid overhead $ uses the office
  // rate — same pricing as the Overhead tab and payroll.
  const cfgInputs = cfgList.map((r) => ({
    person_name: r.person_name,
    person_id: r.person_id ?? null,
    hourly_wage: r.hourly_wage ?? null,
    office_hourly_wage: r.office_hourly_wage ?? null,
    is_salary: r.is_salary,
  }))
  const wageMap = buildOverheadWageLookup(cfgInputs)
  const wageByPersonId = buildOverheadWageLookupByPersonId(cfgInputs)
  const personIdByUserId = new Map<string, string>()
  for (const p of personLinkRows) {
    if (p.account_user_id) personIdByUserId.set(p.account_user_id, p.id)
  }
  const overheadLabor = buildOverheadDailyLabor({
    sessions: (overheadSessionsRes ?? []) as OverheadClockSessionRow[],
    officeJobLedgerId,
    wageByNormalizedName: wageMap,
    wageByPersonId,
    personIdByUserId,
  })
  const merged = mergeOverheadDayTableRows(overheadLabor.byDay, partsRes, new Map(), new Map(), new Map())
  let overheadTotal = 0
  for (const row of merged) overheadTotal += row.totalUsd
  let officeLabor90d = 0
  let bidLabor90d = 0
  for (const row of overheadLabor.byDay) {
    officeLabor90d += row.officeLaborUsd
    bidLabor90d += row.bidLaborUsd
  }
  let officeParts90d = 0
  for (const v of partsRes.values()) officeParts90d += v
  // Field hours + field labor $ via the shared kernel (same math the
  // Overhead tab's three-lenses strip uses): approved, closed sessions
  // on non-office jobs-ledger work; hours always count, labor $ prices
  // at the person's FIELD wage (id-first join, name fallback) and $0
  // when no wage is configured — identical to the old inline loop.
  const fieldLabor = buildOtherJobsLaborByDay({
    sessions: (fieldSessionsRes ?? []) as OverheadClockSessionRow[],
    officeJobLedgerId,
    wageByNormalizedName: wageMap,
    wageByPersonId,
    personIdByUserId,
  })
  let fieldHours = 0
  for (const v of fieldLabor.laborHoursByDay.values()) fieldHours += v
  let fieldLaborUsd = 0
  for (const v of fieldLabor.laborUsdByDay.values()) fieldLaborUsd += v
  const invoiceRows = (invoiceRowsRes ?? []) as Array<{
    amount: number | null
    sent_to_customer_at: string | null
  }>
  // Shared bucketing kernel (same call as the Overhead tab's KPI
  // effect) instead of an inline re-implementation — the kernel's unit
  // tests pin the inclusive [start, today] Chicago-day window.
  const revenueByDay = bucketInvoiceRevenueByAppTzDay(invoiceRows, start, today)
  let revenueTotal = 0
  for (const v of revenueByDay.values()) revenueTotal += v
  // Shared three-lenses kernel — the SAME code that renders the
  // Overhead tab's rate strip, so the two surfaces cannot drift.
  const rates = computeOverheadRateMethods({
    overheadPoolUsd: overheadTotal,
    fieldHours,
    invoicedRevenueUsd: revenueTotal,
    fieldLaborUsd,
  })
  return {
    ratePerHour: rates.methodA,
    ratePerRevenueDecimal: rates.methodB,
    ratePerLaborDollar: rates.methodC,
    loading: false,
    windowStart: start,
    windowEnd: today,
    officeLabor90d,
    bidLabor90d,
    officeParts90d,
    invoices90d: revenueTotal,
    fieldHours90d: fieldHours,
    fieldLaborUsd90d: fieldLaborUsd,
  }
}
