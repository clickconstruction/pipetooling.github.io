import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { denverCalendarDayKey, ymdAddDays } from '../utils/dateUtils'
import { fetchAllRows } from './supabasePaging'
import {
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  buildOverheadWageLookup,
  buildOverheadWageLookupByPersonId,
  mergeOverheadDayTableRows,
  type OverheadClockSessionRow,
  type OverheadPayConfigInput,
  type OverheadWageRates,
} from './overheadDailyLabor'
import { loadOfficePartsUsdByDayExcludingInternalTransfer } from './overheadPartsBucketLoader'
import type { OverheadPartsAccountingBucketKey } from './overheadPartsAccountingBuckets'
import type { OverheadPartsDetailLine } from './fetchOverheadOfficePartsByDay'
import { buildOverheadHygieneSummary, type OverheadHygieneSummary } from './overheadHygiene'
import { bucketInvoiceRevenueByAppTzDay, computeOverheadTrailingAverages } from './overheadAvgDailyCost'
import { computeOverheadRateMethods, type OverheadRateMethods } from './overheadRateMethods'
import { buildOverheadPoolTrend, type OverheadPoolTrend } from './overheadPoolTrend'
import { buildOverheadLensSeries, type OverheadLensKey, type OverheadLensSeries } from './overheadLensSeries'
import type { OverheadPeopleLaborInput } from './overheadPeopleTable'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from './overheadOfficeJobSettings'

/**
 * The ONE 90-day overhead scan (v2.2676). Lifted verbatim from People →
 * Overhead's KPI/three-lenses effect so the Dashboard's Overhead card and
 * the tab compute from the same code path — no SQL re-implementation, no
 * second kernel to drift (the August 2026 correctness train's whole
 * lesson). The tab's effect now calls this and unpacks the result; the
 * Dashboard hook calls it behind a per-session cache.
 *
 * Window: 90 company-calendar days ending today (America/Chicago). Pool =
 * approved, wage-priced office + bid sessions + office-job parts (internal
 * transfers excluded); denominators = approved field hours / field labor $ /
 * invoices sent (Stripe test-mode excluded, Chicago-bucketed).
 *
 * Error semantics match the original effect: the core fetches throw (the
 * caller reports "90-day averages"); the unassigned-salary fetch fails soft
 * to `null` and is reported separately via `unassignedSalaryError`.
 */

export type OverheadWageLookup = {
  byName: Map<string, OverheadWageRates>
  byPersonId: Map<string, OverheadWageRates>
}

export type OverheadPoolSnapshotInputs = {
  officeJobLedgerId: string | null
  wageLookup: OverheadWageLookup
  personIdByUserId: ReadonlyMap<string, string>
}

export type OverheadPoolSnapshot = {
  windowStart: string
  windowEnd: string
  avg: {
    avg7: number
    avg30: number
    avg90: number
    per100_7: number | null
    per100_30: number | null
    per100_90: number | null
  }
  rates: OverheadRateMethods
  hygiene: OverheadHygieneSummary
  /** Non-null when the unassigned-salary fetch failed (the hygiene indicator hides; KPIs unaffected). */
  unassignedSalaryError: unknown | null
  poolTrend: OverheadPoolTrend
  lensDetail: {
    series: Record<OverheadLensKey, OverheadLensSeries>
    denominators: { fieldHours: number; invoicedRevenueUsd: number; fieldLaborUsd: number }
    pendingFieldHours: number
    overlapSessions: number
  }
  peopleLines: {
    labor: OverheadPeopleLaborInput[]
    parts: Array<{ workDate: string; line: OverheadPartsDetailLine }>
    bucketByTxId: ReadonlyMap<string, OverheadPartsAccountingBucketKey>
    endYmd: string
  }
}

export function buildOverheadWageLookups(inputs: readonly OverheadPayConfigInput[]): OverheadWageLookup {
  return { byName: buildOverheadWageLookup(inputs), byPersonId: buildOverheadWageLookupByPersonId(inputs) }
}

const SESSION_SELECT =
  'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, users!clock_sessions_user_id_fkey(name)'

/**
 * Loads the three snapshot inputs the tab otherwise gets from its page:
 * the office job id (app_settings), pay-config wages, and the users → people
 * link map. For consumers outside People (the Dashboard card).
 */
export async function loadOverheadPoolSnapshotInputs(): Promise<OverheadPoolSnapshotInputs> {
  const [officeJobLedgerId, payRows, peopleRows] = await Promise.all([
    fetchOverheadOfficeJobLedgerIdFromAppSettings(),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase
              .from('people_pay_config')
              .select('person_name, person_id, hourly_wage, office_hourly_wage, is_salary')
              .order('person_name')
              .range(from, to),
          'load overhead pay config',
        )) as OverheadPayConfigInput[] | null,
        error: null,
      }),
      'load overhead pay config',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase
              .from('people')
              .select('id, account_user_id')
              .not('account_user_id', 'is', null)
              .is('archived_at', null)
              .order('id')
              .range(from, to),
          'load overhead person links',
        )) as Array<{ id: string; account_user_id: string | null }> | null,
        error: null,
      }),
      'load overhead person links',
    ).catch(() => [] as Array<{ id: string; account_user_id: string | null }>),
  ])
  const personIdByUserId = new Map<string, string>()
  for (const r of peopleRows) if (r.account_user_id) personIdByUserId.set(r.account_user_id, r.id)
  return { officeJobLedgerId, wageLookup: buildOverheadWageLookups(payRows), personIdByUserId }
}

export async function loadOverheadPoolSnapshot(
  inputs: OverheadPoolSnapshotInputs,
  opts: { isCancelled?: () => boolean } = {},
): Promise<OverheadPoolSnapshot | null> {
  const { officeJobLedgerId, wageLookup, personIdByUserId } = inputs
  const cancelled = () => opts.isCancelled?.() === true
  // Anchor the whole 90-day window on the COMPANY calendar day
  // (America/Chicago), not the viewer's browser-local date.
  const today = denverCalendarDayKey(Date.now())
  const start = ymdAddDays(today, -89)
  // Paged (fetchAllRows): a company-wide 90-day scan silently truncates at
  // PostgREST max_rows (1000) if un-ranged. Fresh builder per page;
  // `.order('id')` keeps pages stable.
  const makeQ = () => {
    let q = supabase.from('clock_sessions').select(SESSION_SELECT).gte('work_date', start).lte('work_date', today)
    if (officeJobLedgerId) {
      q = q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`)
    } else {
      q = q.not('bid_id', 'is', null)
    }
    return q.order('id')
  }
  // Field (non-office jobs-ledger) sessions for the three-lenses denominators.
  const makeFieldQ = () => {
    let q = supabase
      .from('clock_sessions')
      .select(SESSION_SELECT)
      .gte('work_date', start)
      .lte('work_date', today)
      .not('job_ledger_id', 'is', null)
    if (officeJobLedgerId) q = q.neq('job_ledger_id', officeJobLedgerId)
    return q.order('id')
  }
  // Unassigned salary-schedule time (hygiene's third indicator); fails soft.
  const makeSalaryQ = () =>
    supabase
      .from('clock_sessions')
      .select(SESSION_SELECT)
      .gte('work_date', start)
      .lte('work_date', today)
      .eq('origin', 'salary_schedule')
      .is('job_ledger_id', null)
      .is('bid_id', null)
      .order('id')
  const page = (build: () => ReturnType<typeof makeQ>, label: string) =>
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => build().range(from, to), label)) as unknown as
          | OverheadClockSessionRow[]
          | null,
        error: null,
      }),
      label,
    )
  let unassignedSalaryError: unknown | null = null
  const [sessions, fieldSessions, salarySessions] = await Promise.all([
    page(makeQ, 'load overhead 90d sessions'),
    page(makeFieldQ, 'load overhead 90d field sessions'),
    page(makeSalaryQ, 'load overhead 90d unassigned salary sessions').catch((e: unknown) => {
      unassignedSalaryError = e
      return null
    }),
  ])
  let partsByDay: Map<string, number> = new Map()
  const partsDetailLines: Array<{ workDate: string; line: OverheadPartsDetailLine }> = []
  let partsBucketByTxId: ReadonlyMap<string, OverheadPartsAccountingBucketKey> = new Map()
  if (officeJobLedgerId) {
    // Internal Transfers are not an expense and stay out of office parts $.
    // Shared loader — the Review tab builds its pool through the same function.
    const r = await loadOfficePartsUsdByDayExcludingInternalTransfer({ officeJobLedgerId, startYmd: start, endYmd: today })
    partsByDay = r.partsUsdByDay
    partsBucketByTxId = r.bucketByTxId
    for (const [ymd, lines] of r.partsDetailByDay) for (const line of lines) partsDetailLines.push({ workDate: ymd, line })
  }
  if (cancelled()) return null
  const labor = buildOverheadDailyLabor({
    sessions,
    officeJobLedgerId,
    wageByNormalizedName: wageLookup.byName,
    wageByPersonId: wageLookup.byPersonId,
    personIdByUserId,
  })
  const fieldLabor = buildOtherJobsLaborByDay({
    sessions: fieldSessions,
    officeJobLedgerId,
    wageByNormalizedName: wageLookup.byName,
    wageByPersonId: wageLookup.byPersonId,
    personIdByUserId,
  })
  let fieldHours90 = 0
  for (const v of fieldLabor.laborHoursByDay.values()) fieldHours90 += v
  let fieldLaborUsd90 = 0
  for (const v of fieldLabor.laborUsdByDay.values()) fieldLaborUsd90 += v
  const hygiene = buildOverheadHygieneSummary({
    officeAndBidSessions: sessions,
    fieldSessions,
    unassignedSalarySessions: salarySessions,
    overheadDetailLines: [...labor.detailByDay.values()].flat(),
    otherJobsDetailLines: [...fieldLabor.detailByDay.values()].flat(),
  })
  const merged = mergeOverheadDayTableRows(labor.byDay, partsByDay, new Map(), new Map(), new Map())
  const totalsByDay = new Map<string, number>()
  for (const row of merged) totalsByDay.set(row.work_date, row.totalUsd)
  // Fetch a day wide on both sides, then re-bucket each invoice into its
  // Chicago calendar day (the v2.1249 fix). Stripe TEST-mode invoices are not
  // revenue; NULL stripe_mode = non-Stripe / legacy rows, real revenue.
  const startIsoLow = `${ymdAddDays(start, -1)}T00:00:00-00:00`
  const endIsoHigh = `${ymdAddDays(today, 2)}T00:00:00-00:00`
  const invoiceRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger_invoices')
            .select('amount, sent_to_customer_at')
            .gte('sent_to_customer_at', startIsoLow)
            .lt('sent_to_customer_at', endIsoHigh)
            .or('stripe_mode.is.null,stripe_mode.neq.test')
            .order('id')
            .range(from, to),
        'load overhead 90d revenue invoices',
      )) as Array<{ amount: number | null; sent_to_customer_at: string | null }> | null,
      error: null,
    }),
    'load overhead 90d revenue invoices',
  )
  if (cancelled()) return null
  const revenueByDay = bucketInvoiceRevenueByAppTzDay(invoiceRows, start, today)
  const { w7, w30, w90 } = computeOverheadTrailingAverages({ totalsByDay, revenueByDay, todayYmd: today })
  const rates = computeOverheadRateMethods({
    overheadPoolUsd: w90.costUsd,
    fieldHours: fieldHours90,
    invoicedRevenueUsd: w90.revenueUsd,
    fieldLaborUsd: fieldLaborUsd90,
  })
  const pendingFieldHours = fieldSessions.reduce((acc, sess) => {
    if (sess.approved_at || sess.rejected_at || sess.revoked_at || !sess.clocked_out_at) return acc
    const h = (Date.parse(sess.clocked_out_at) - Date.parse(sess.clocked_in_at)) / 3_600_000
    return Number.isFinite(h) && h > 0 ? acc + h : acc
  }, 0)
  const overlapSessions = sessions.filter(
    (sess) =>
      sess.approved_at &&
      !sess.rejected_at &&
      !sess.revoked_at &&
      sess.bid_id &&
      sess.job_ledger_id &&
      sess.job_ledger_id !== officeJobLedgerId,
  ).length
  const lensSeries = (denominatorByDay: ReadonlyMap<string, number>) =>
    buildOverheadLensSeries({ poolUsdByDay: totalsByDay, denominatorByDay, startYmd: start, endYmd: today })
  return {
    windowStart: start,
    windowEnd: today,
    avg: {
      avg7: w7.avgDailyCostUsd,
      avg30: w30.avgDailyCostUsd,
      avg90: w90.avgDailyCostUsd,
      per100_7: w7.per100RevenueUsd,
      per100_30: w30.per100RevenueUsd,
      per100_90: w90.per100RevenueUsd,
    },
    rates,
    hygiene,
    unassignedSalaryError,
    poolTrend: buildOverheadPoolTrend({ laborDays: labor.byDay, partsUsdByDay: partsByDay, startYmd: start, endYmd: today }),
    lensDetail: {
      series: { A: lensSeries(fieldLabor.laborHoursByDay), B: lensSeries(revenueByDay), C: lensSeries(fieldLabor.laborUsdByDay) },
      denominators: { fieldHours: fieldHours90, invoicedRevenueUsd: w90.revenueUsd, fieldLaborUsd: fieldLaborUsd90 },
      pendingFieldHours,
      overlapSessions,
    },
    peopleLines: {
      labor: [...labor.detailByDay.values()]
        .flat()
        .map((l) => ({ workDate: l.workDate, userName: l.userName, bucket: l.bucket, hours: l.hours, laborUsd: l.laborUsd })),
      parts: partsDetailLines,
      bucketByTxId: partsBucketByTxId,
      endYmd: today,
    },
  }
}
