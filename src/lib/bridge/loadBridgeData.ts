import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import { loadOverheadPoolSnapshot, loadOverheadPoolSnapshotInputs } from '../overheadPoolSnapshot'
import { buildEarnedRevenue, type EarnedRevenueJob, type EarnedRevenueResult } from './earnedRevenue'
import { upcomingFridays } from './cashForecast'
import { parsePaySpeedsRpc, parsePromisedPayDatesRpc, type PaySpeedData, type PromisedPayDate } from '../jobs/billedExpectedPay'

/**
 * Bridge data loader (v2.2677) — every number the Chart Table shows, from the
 * same sources the rest of the app already trusts. Dev-only surface; the
 * page gates, this just loads. Window: `daysBack` company-calendar days
 * ending today.
 *
 * - Overhead per day + field labor per day + hygiene: the shared 90-day
 *   snapshot (`loadOverheadPoolSnapshot`) — one code path with the Overhead
 *   tab and the Dashboard card.
 * - Earned revenue: approved field sessions in the window × contract ÷
 *   expected hours (`earnedRevenue.ts`); lifetime hours per job fetched for
 *   the jobs touched.
 * - Direct cost per day: field labor $ (snapshot) + Mercury card/transfer
 *   allocations to non-office jobs by posted day + supply-house invoices
 *   allocated to non-office jobs by invoice date + sub labor sheets by job
 *   date.
 * - Levers: Ready-to-bill revenue, collections balance, bids due within 14
 *   days (bid_value, estimated start). Hazards: unpaid supply invoices by due
 *   date. Target: app_settings `bridge_target_usd_v1`.
 */

export const BRIDGE_TARGET_SETTING_KEY = 'bridge_target_usd_v1'
export const BRIDGE_CASH_SETTING_KEY = 'bridge_cash_on_hand_v1'
export const BRIDGE_FLOOR_SETTING_KEY = 'bridge_cash_floor_usd_v1'
export const BRIDGE_DEFAULT_FLOOR_USD = 5000
export const BRIDGE_DAYS_BACK = 56
export const BRIDGE_DAYS_AHEAD = 56

export type BridgeJobRow = { id: string; label: string; revenueUsd: number | null; pctComplete: number | null; status: string }

export type BridgeData = {
  todayYmd: string
  windowStart: string
  officeJobLedgerId: string | null
  earned: EarnedRevenueResult
  jobs: BridgeJobRow[]
  jobsWorked: number
  earnedByDay: Map<string, number>
  directByDay: Map<string, number>
  overheadByDay: Map<string, number>
  totals: { earnedUsd: number; fieldLaborUsd: number; materialsUsd: number; subLaborUsd: number; overheadUsd: number }
  crew: { fieldHours7d: number; fieldHoursWindow: number; officeBidHours7d: number; pendingClosedHours: number; pendingClosedSessions: number }
  /** 90-day calendar-day overhead average — the drag used for speed and the projection. */
  overheadPerDayBaseline: number
  hygiene: { unattributedNoncard: number | null; unlinkedCard: number | null }
  levers: {
    rtb: { count: number; revenueUsd: number }
    collections: { count: number; openUsd: number }
    bidsDue: Array<{ id: string; label: string; bidValueUsd: number; dueYmd: string; startOffset: number }>
  }
  hazards: Array<{ ymd: string; offset: number; label: string; usd: number }>
  targetUsd: number | null
  /** Net position + cash forecast inputs (v2.2726). */
  bankFlowByDay: Map<string, number>
  invoicesSentByDay: Map<string, number>
  paymentsReceivedByDay: Map<string, number>
  supplyDatedByDay: Map<string, number>
  supplyPaidByDay: Map<string, number>
  /** Typed cash on hand, rolled forward on the page from its as-of day. Null until someone types it. */
  cashSetting: { usd: number; asOfYmd: string } | null
  floorUsd: number
  /** Scheduled outflows in the next window: unpaid supply invoices by due date + payroll Fridays (estimated). Sub labor owed is added on the page from the finance hook's AP figure. */
  bills: Array<{ ymd: string; usd: number; label: string }>
  payrollWeeklyEstUsd: number
  /** Unscheduled spend per day (office parts at the 90-day rate). */
  dailyDrainUsd: number
  paySpeeds: PaySpeedData | null
  promisedByJob: Record<string, PromisedPayDate> | null
}

const hoursOf = (inIso: string, outIso: string | null): number => {
  if (!outIso) return 0
  const h = (Date.parse(outIso) - Date.parse(inIso)) / 3_600_000
  return Number.isFinite(h) && h > 0 ? h : 0
}
const addTo = (m: Map<string, number>, k: string, v: number) => {
  if (v) m.set(k, (m.get(k) ?? 0) + v)
}
const dayOffset = (ymd: string, todayYmd: string): number => Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${todayYmd}T00:00:00Z`)) / 86_400_000)

type SessionRow = { work_date: string; clocked_in_at: string; clocked_out_at: string | null; job_ledger_id: string | null }

export async function loadBridgeData(): Promise<BridgeData> {
  const todayYmd = denverCalendarDayKey(Date.now())
  const windowStart = ymdAddDays(todayYmd, -BRIDGE_DAYS_BACK)
  const inputs = await loadOverheadPoolSnapshotInputs()
  const officeJobLedgerId = inputs.officeJobLedgerId
  const snapPromise = loadOverheadPoolSnapshot(inputs)

  // Approved field sessions in the window (earned-revenue numerator + crew hours).
  const fieldSessions = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(async () => {
        let q = supabase
          .from('clock_sessions')
          .select('work_date, clocked_in_at, clocked_out_at, job_ledger_id')
          .gte('work_date', windowStart)
          .lte('work_date', todayYmd)
          .not('job_ledger_id', 'is', null)
          .not('approved_at', 'is', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('clocked_out_at', 'is', null)
        if (officeJobLedgerId) q = q.neq('job_ledger_id', officeJobLedgerId)
        return q.order('id').range(from, to)
      }, 'bridge field sessions')) as SessionRow[] | null,
      error: null,
    }),
    'bridge field sessions',
  )
  const jobIds = [...new Set(fieldSessions.map((s) => s.job_ledger_id).filter((v): v is string => !!v))]
  const chunks = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

  // Jobs + lifetime hours for the jobs touched.
  const jobs: BridgeJobRow[] = []
  const lifetimeHours = new Map<string, number>()
  for (const ids of chunks(jobIds, 150)) {
    const [jobRows, lifeRows] = await Promise.all([
      withSupabaseRetry(
        async () => supabase.from('jobs_ledger').select('id, job_name, hcp_number, click_number, revenue, pct_complete, status').in('id', ids),
        'bridge jobs',
      ) as Promise<Array<{ id: string; job_name: string | null; hcp_number: string | null; click_number: string | null; revenue: number | null; pct_complete: number | null; status: string }> | null>,
      fetchAllRows(
        async (from, to) => ({
          data: (await withSupabaseRetry(
            async () =>
              supabase
                .from('clock_sessions')
                .select('work_date, clocked_in_at, clocked_out_at, job_ledger_id')
                .in('job_ledger_id', ids)
                .not('approved_at', 'is', null)
                .is('rejected_at', null)
                .is('revoked_at', null)
                .not('clocked_out_at', 'is', null)
                .order('id')
                .range(from, to),
            'bridge lifetime hours',
          )) as SessionRow[] | null,
          error: null,
        }),
        'bridge lifetime hours',
      ),
    ])
    for (const j of jobRows ?? []) {
      jobs.push({
        id: j.id,
        label: `${j.hcp_number || j.click_number || ''} ${j.job_name ?? ''}`.trim(),
        revenueUsd: j.revenue == null ? null : Number(j.revenue),
        pctComplete: j.pct_complete == null ? null : Number(j.pct_complete),
        status: j.status,
      })
    }
    for (const s of lifeRows) if (s.job_ledger_id) addTo(lifetimeHours, s.job_ledger_id, hoursOf(s.clocked_in_at, s.clocked_out_at))
  }
  const earnedJobs: EarnedRevenueJob[] = jobs.map((j) => ({
    id: j.id,
    revenueUsd: j.revenueUsd,
    pctComplete: j.pctComplete,
    status: j.status,
    lifetimeHours: lifetimeHours.get(j.id) ?? 0,
  }))
  const earned = buildEarnedRevenue({
    jobs: earnedJobs,
    sessions: fieldSessions.map((s) => ({ jobId: s.job_ledger_id as string, ymd: s.work_date, hours: hoursOf(s.clocked_in_at, s.clocked_out_at) })),
  })

  // Materials: Mercury allocations to non-office jobs, by posted day.
  const materialsByDay = new Map<string, number>()
  const txRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transactions')
            .select('id, posted_at, amount')
            .gte('posted_at', `${windowStart}T00:00:00-06:00`)
            .is('duplicate_of_transaction_id', null)
            .neq('kind', 'internalTransfer')
            .order('id')
            .range(from, to),
        'bridge mercury tx',
      )) as Array<{ id: string; posted_at: string; amount: number | null }> | null,
      error: null,
    }),
    'bridge mercury tx',
  )
  const bankFlowByDay = new Map<string, number>()
  for (const t of txRows) {
    const d = calendarYmdInAppTzFromIso(t.posted_at)
    if (d >= windowStart && d <= todayYmd) addTo(bankFlowByDay, d, Number(t.amount ?? 0))
  }
  const txDay = new Map(txRows.filter((t) => Number(t.amount ?? 0) < 0).map((t) => [t.id, calendarYmdInAppTzFromIso(t.posted_at)]))
  // Every read below is paged (Phase 4 #3(c)): a 200-id `.in()` chunk can still return
  // >1,000 child rows, and the windowed whole-set reads cross PostgREST's silent cap as
  // the window's history grows — either way a Bridge day total drops rows with no error.
  type TxAllocRow = { mercury_transaction_id: string; job_id: string | null; amount: number | null }
  const txAllocRows = await fetchAllRowsChunkedIn(
    [...txDay.keys()],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('mercury_transaction_job_allocations')
            .select('mercury_transaction_id, job_id, amount')
            .in('mercury_transaction_id', chunk)
            .order('id')
            .range(from, to),
        'bridge tx allocations',
      )) as TxAllocRow[] | null,
      error: null,
    }),
    'bridge tx allocations',
    { chunkSize: 200 },
  )
  for (const a of txAllocRows) {
    if (!a.job_id || a.job_id === officeJobLedgerId) continue
    const d = txDay.get(a.mercury_transaction_id)
    if (d && d >= windowStart && d <= todayYmd) addTo(materialsByDay, d, Math.abs(Number(a.amount ?? 0)))
  }
  // Materials: supply-house invoices allocated to non-office jobs, by invoice date.
  type SupplyInvRow = { id: string; amount: number | null; invoice_date: string; paid_at: string | null }
  const invRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('supply_house_invoices')
            .select('id, amount, invoice_date, paid_at')
            .gte('invoice_date', windowStart)
            .lte('invoice_date', todayYmd)
            .order('id')
            .range(from, to),
        'bridge supply invoices',
      )) as SupplyInvRow[] | null,
      error: null,
    }),
    'bridge supply invoices',
  )
  const invById = new Map(invRows.map((r) => [r.id, r]))
  type SupplyAllocRow = { invoice_id: string; job_id: string | null; pct: number | null }
  const supplyAllocRows = await fetchAllRowsChunkedIn(
    [...invById.keys()],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('supply_house_invoice_job_allocations')
            .select('invoice_id, job_id, pct')
            .in('invoice_id', chunk)
            .order('id')
            .range(from, to),
        'bridge supply allocations',
      )) as SupplyAllocRow[] | null,
      error: null,
    }),
    'bridge supply allocations',
    { chunkSize: 200 },
  )
  for (const a of supplyAllocRows) {
    const inv = invById.get(a.invoice_id)
    if (!inv || !a.job_id || a.job_id === officeJobLedgerId) continue
    addTo(materialsByDay, inv.invoice_date, Number(inv.amount ?? 0) * (Number(a.pct ?? 0) / 100))
  }
  // Sub labor sheets by job date.
  const subByDay = new Map<string, number>()
  const sheets = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase.from('people_labor_jobs').select('id, job_date').gte('job_date', windowStart).lte('job_date', todayYmd).order('id').range(from, to),
        'bridge sub sheets',
      )) as Array<{ id: string; job_date: string }> | null,
      error: null,
    }),
    'bridge sub sheets',
  )
  const sheetDay = new Map(sheets.map((s) => [s.id, s.job_date]))
  type SubItemRow = { job_id: string; count: number | null; hrs_per_unit: number | null; labor_rate: number | null; direct_labor_amount: number | null }
  const subItems = await fetchAllRowsChunkedIn(
    [...sheetDay.keys()],
    async (chunk, from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('people_labor_job_items')
            .select('job_id, count, hrs_per_unit, labor_rate, direct_labor_amount')
            .in('job_id', chunk)
            .order('id')
            .range(from, to),
        'bridge sub items',
      )) as SubItemRow[] | null,
      error: null,
    }),
    'bridge sub items',
    { chunkSize: 200 },
  )
  for (const it of subItems) {
    const d = sheetDay.get(it.job_id)
    if (!d) continue
    const v = it.direct_labor_amount != null ? Number(it.direct_labor_amount) : Number(it.count ?? 0) * Number(it.hrs_per_unit ?? 0) * Number(it.labor_rate ?? 0)
    addTo(subByDay, d, v)
  }

  // Net position history flows (v2.2726): invoices sent, payments received,
  // supply invoices dated / paid — by company day, inside the window.
  const invoicesSentByDay = new Map<string, number>()
  const paymentsReceivedByDay = new Map<string, number>()
  const supplyDatedByDay = new Map<string, number>()
  const supplyPaidByDay = new Map<string, number>()
  for (const inv of invRows) addTo(supplyDatedByDay, inv.invoice_date, Number(inv.amount ?? 0))
  type SentRow = { amount: number | null; sent_to_customer_at: string | null }
  type PaidRow = { amount: number | null; paid_on: string | null }
  type SupplyPaidRow = { amount: number | null; paid_at: string | null }
  const [sentRows, paidRows, supplyPaidRows, settingRows, paySpeedRaw, promisesRaw] = await Promise.all([
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .select('amount, sent_to_customer_at')
              .gte('sent_to_customer_at', `${ymdAddDays(windowStart, -1)}T00:00:00-00:00`)
              .or('stripe_mode.is.null,stripe_mode.neq.test')
              .order('id')
              .range(from, to),
          'bridge invoices sent',
        )) as SentRow[] | null,
        error: null,
      }),
      'bridge invoices sent',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger_payments').select('amount, paid_on').gte('paid_on', windowStart).lte('paid_on', todayYmd).order('id').range(from, to),
          'bridge payments',
        )) as PaidRow[] | null,
        error: null,
      }),
      'bridge payments',
    ),
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(
          async () =>
            supabase
              .from('supply_house_invoices')
              .select('amount, paid_at')
              .gte('paid_at', `${ymdAddDays(windowStart, -1)}T00:00:00-00:00`)
              .order('id')
              .range(from, to),
          'bridge supply paid',
        )) as SupplyPaidRow[] | null,
        error: null,
      }),
      'bridge supply paid',
    ),
    withSupabaseRetry(async () => supabase.from('app_settings').select('key, value_text').in('key', [BRIDGE_CASH_SETTING_KEY, BRIDGE_FLOOR_SETTING_KEY]), 'bridge settings') as Promise<Array<{ key: string; value_text: string | null }> | null>,
    (async (): Promise<unknown> => {
      try {
        return (await supabase.rpc('get_billed_customer_pay_speeds' as never)).data
      } catch {
        return null
      }
    })(),
    (async (): Promise<unknown> => {
      try {
        return (await supabase.rpc('list_job_promised_pay_dates' as never)).data
      } catch {
        return null
      }
    })(),
  ])
  for (const r of sentRows ?? []) {
    if (!r.sent_to_customer_at) continue
    const d = calendarYmdInAppTzFromIso(r.sent_to_customer_at)
    if (d >= windowStart && d <= todayYmd) addTo(invoicesSentByDay, d, Number(r.amount ?? 0))
  }
  for (const r of paidRows ?? []) if (r.paid_on) addTo(paymentsReceivedByDay, r.paid_on, Number(r.amount ?? 0))
  for (const r of supplyPaidRows ?? []) {
    if (!r.paid_at) continue
    const d = calendarYmdInAppTzFromIso(r.paid_at)
    if (d >= windowStart && d <= todayYmd) addTo(supplyPaidByDay, d, Number(r.amount ?? 0))
  }
  let cashSetting: { usd: number; asOfYmd: string } | null = null
  let floorUsd = BRIDGE_DEFAULT_FLOOR_USD
  for (const r of settingRows ?? []) {
    if (r.key === BRIDGE_FLOOR_SETTING_KEY) {
      const v = Number(r.value_text)
      if (Number.isFinite(v)) floorUsd = v
    }
    if (r.key === BRIDGE_CASH_SETTING_KEY && r.value_text) {
      try {
        const parsed = JSON.parse(r.value_text) as { usd?: unknown; asOfYmd?: unknown }
        if (typeof parsed.usd === 'number' && Number.isFinite(parsed.usd) && typeof parsed.asOfYmd === 'string') cashSetting = { usd: parsed.usd, asOfYmd: parsed.asOfYmd }
      } catch {
        /* ignore a corrupt setting */
      }
    }
  }
  const paySpeeds = parsePaySpeedsRpc(paySpeedRaw)
  const promisedByJob = parsePromisedPayDatesRpc(promisesRaw)

  // Levers, hazards, hygiene counts, target — small independent reads.
  const [rtbRows, collRows, bidRows, dueRows, ncCount, cardCount, targetRow] = await Promise.all([
    withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id, revenue').eq('status', 'ready_to_bill'), 'bridge rtb') as Promise<Array<{ id: string; revenue: number | null }> | null>,
    withSupabaseRetry(async () => supabase.from('jobs_ledger').select('id, revenue, payments_made').not('collections_at', 'is', null), 'bridge collections') as Promise<Array<{ id: string; revenue: number | null; payments_made: number | null }> | null>,
    withSupabaseRetry(
      async () =>
        supabase
          .from('bids')
          .select('id, bid_number, address, bid_value, bid_due_date, estimated_job_start_date')
          .gte('bid_due_date', todayYmd)
          .lte('bid_due_date', ymdAddDays(todayYmd, 14))
          .is('bid_date_sent', null),
      'bridge bids due',
    ) as Promise<Array<{ id: string; bid_number: string | null; address: string | null; bid_value: number | null; bid_due_date: string; estimated_job_start_date: string | null }> | null>,
    withSupabaseRetry(
      async () => supabase.from('supply_house_invoices').select('amount, due_date').eq('is_paid', false).gte('due_date', todayYmd).lte('due_date', ymdAddDays(todayYmd, BRIDGE_DAYS_AHEAD)),
      'bridge supply due',
    ) as Promise<Array<{ amount: number | null; due_date: string }> | null>,
    (async (): Promise<number | null> => {
      try {
        const r = await supabase.rpc('count_unattributed_noncard_mercury_transactions')
        return typeof r.data === 'number' ? r.data : null
      } catch {
        return null
      }
    })(),
    (async (): Promise<number | null> => {
      try {
        const r = await supabase.rpc('count_unlinked_mercury_transactions_for_tally')
        return typeof r.data === 'number' ? r.data : null
      } catch {
        return null
      }
    })(),
    withSupabaseRetry(async () => supabase.from('app_settings').select('value_text').eq('key', BRIDGE_TARGET_SETTING_KEY).maybeSingle(), 'bridge target') as Promise<{ value_text: string | null } | null>,
  ])
  const snap = await snapPromise
  if (!snap) throw new Error('overhead snapshot unavailable')

  const earnedByDay = earned.earnedByDay
  const directByDay = new Map<string, number>()
  for (let d = windowStart; d <= todayYmd; d = ymdAddDays(d, 1)) {
    const v = (snap.fieldLaborUsdByDay.get(d) ?? 0) + (materialsByDay.get(d) ?? 0) + (subByDay.get(d) ?? 0)
    if (v) directByDay.set(d, v)
  }
  const overheadByDay = new Map<string, number>()
  for (const [d, v] of snap.poolUsdByDay) if (d >= windowStart && d <= todayYmd) overheadByDay.set(d, v)
  const sum = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((s, v) => s + v, 0)
  const last7 = ymdAddDays(todayYmd, -6)
  let fieldHours7d = 0
  let fieldHoursWindow = 0
  for (const s of fieldSessions) {
    const h = hoursOf(s.clocked_in_at, s.clocked_out_at)
    fieldHoursWindow += h
    if (s.work_date >= last7) fieldHours7d += h
  }
  let officeBidHours7d = 0
  for (const l of snap.peopleLines.labor) if (l.workDate >= last7) officeBidHours7d += l.hours
  const hazardsByDay = new Map<string, number>()
  for (const r of dueRows ?? []) addTo(hazardsByDay, r.due_date, Number(r.amount ?? 0))
  // Scheduled outflows for the cash forecast.
  let officeLaborWindow = 0
  for (const l of snap.peopleLines.labor) if (l.workDate >= windowStart) officeLaborWindow += l.laborUsd
  const fieldLaborWindow = [...snap.fieldLaborUsdByDay].filter(([d]) => d >= windowStart).reduce((acc, [, v]) => acc + v, 0)
  const payrollWeeklyEstUsd = ((fieldLaborWindow + officeLaborWindow) / BRIDGE_DAYS_BACK) * 7
  const bills: BridgeData['bills'] = []
  for (const [ymd, usd] of hazardsByDay) bills.push({ ymd, usd, label: 'Supply invoices due' })
  for (const ymd of upcomingFridays(todayYmd, BRIDGE_DAYS_AHEAD)) bills.push({ ymd, usd: payrollWeeklyEstUsd, label: 'Payroll (estimated)' })
  bills.sort((a, b) => (a.ymd < b.ymd ? -1 : a.ymd > b.ymd ? 1 : 0))
  const dailyDrainUsd = snap.poolTrend.totals.officePartsUsd / 90
  const targetRaw = targetRow?.value_text?.trim()
  const targetUsd = targetRaw && Number.isFinite(Number(targetRaw)) ? Number(targetRaw) : null

  return {
    todayYmd,
    windowStart,
    officeJobLedgerId,
    earned,
    jobs,
    jobsWorked: jobIds.length,
    earnedByDay,
    directByDay,
    overheadByDay,
    totals: {
      earnedUsd: sum(earnedByDay),
      fieldLaborUsd: [...snap.fieldLaborUsdByDay].filter(([d]) => d >= windowStart).reduce((s, [, v]) => s + v, 0),
      materialsUsd: sum(materialsByDay),
      subLaborUsd: sum(subByDay),
      overheadUsd: sum(overheadByDay),
    },
    crew: { fieldHours7d, fieldHoursWindow, officeBidHours7d, pendingClosedHours: snap.hygiene.pending.closedHours, pendingClosedSessions: snap.hygiene.pending.closedCount },
    overheadPerDayBaseline: snap.avg.avg90,
    hygiene: { unattributedNoncard: ncCount, unlinkedCard: cardCount },
    levers: {
      rtb: { count: (rtbRows ?? []).length, revenueUsd: (rtbRows ?? []).reduce((acc: number, r: { revenue: number | null }) => acc + Number(r.revenue ?? 0), 0) },
      collections: { count: (collRows ?? []).length, openUsd: (collRows ?? []).reduce((acc: number, r: { revenue: number | null; payments_made: number | null }) => acc + Math.max(0, Number(r.revenue ?? 0) - Number(r.payments_made ?? 0)), 0) },
      bidsDue: (bidRows ?? [])
        .filter((b) => (b.bid_value ?? 0) > 0)
        .map((b) => ({
          id: b.id,
          label: `${b.bid_number ?? 'Bid'}${b.address ? ` · ${b.address}` : ''}`,
          bidValueUsd: Number(b.bid_value),
          dueYmd: b.bid_due_date,
          startOffset: Math.max(1, b.estimated_job_start_date ? dayOffset(b.estimated_job_start_date, todayYmd) : dayOffset(b.bid_due_date, todayYmd) + 21),
        }))
        .sort((a, b) => b.bidValueUsd - a.bidValueUsd),
    },
    hazards: [...hazardsByDay]
      .map(([ymd, usd]) => ({ ymd, offset: dayOffset(ymd, todayYmd), label: 'Supply invoices due', usd }))
      .sort((a, b) => a.offset - b.offset),
    targetUsd,
    bankFlowByDay,
    invoicesSentByDay,
    paymentsReceivedByDay,
    supplyDatedByDay,
    supplyPaidByDay,
    cashSetting,
    floorUsd,
    bills,
    payrollWeeklyEstUsd,
    dailyDrainUsd,
    paySpeeds,
    promisedByJob,
  }
}

export async function saveBridgeCashOnHand(usd: number, asOfYmd: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('app_settings').upsert({ key: BRIDGE_CASH_SETTING_KEY, value_text: JSON.stringify({ usd: Math.round(usd), asOfYmd }) }, { onConflict: 'key' }),
    'save bridge cash on hand',
  )
}

export async function saveBridgeFloor(usd: number): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('app_settings').upsert({ key: BRIDGE_FLOOR_SETTING_KEY, value_text: String(Math.round(usd)) }, { onConflict: 'key' }),
    'save bridge cash floor',
  )
}

export async function saveBridgeTarget(targetUsd: number | null): Promise<void> {
  if (targetUsd == null) {
    await withSupabaseRetry(async () => supabase.from('app_settings').delete().eq('key', BRIDGE_TARGET_SETTING_KEY), 'clear bridge target')
    return
  }
  await withSupabaseRetry(
    async () => supabase.from('app_settings').upsert({ key: BRIDGE_TARGET_SETTING_KEY, value_text: String(Math.round(targetUsd)) }, { onConflict: 'key' }),
    'save bridge target',
  )
}
