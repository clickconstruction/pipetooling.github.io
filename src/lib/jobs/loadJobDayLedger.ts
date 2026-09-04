import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'
import { fetchAllRows, fetchAllRowsChunkedIn } from '../supabasePaging'
import {
  buildOtherJobsLaborByDay,
  buildOverheadDailyLabor,
  mergeOverheadDayTableRows,
  type OverheadClockSessionRow,
} from '../overheadDailyLabor'
import { loadOfficePartsUsdByDayExcludingInternalTransfer } from '../overheadPartsBucketLoader'
import { bucketInvoiceRevenueByAppTzDay } from '../overheadAvgDailyCost'
import { loadOverheadPoolSnapshotInputs, type OverheadPoolSnapshotInputs } from '../overheadPoolSnapshot'
import { buildJobDayLedger, type JobDayLedger, type JobDayLedgerJobLabel, type JobDayLedgerStatusSpan } from './jobDayLedger'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

/**
 * Loads the job day ledger for a window (v2.2692) — the same scans People →
 * Overhead's 90-day snapshot runs, widened to any [start, end]: office + bid
 * sessions (the pool's labor), office-job parts (internal transfers excluded),
 * field sessions on every other job, invoices sent (lens B's denominator),
 * pending field sessions (hygiene), and each touched job's approved hours
 * BEFORE the window (so a job that started last quarter says so instead of
 * silently reading as cheap). Everything paged; runs under the caller's RLS.
 */
const SESSION_SELECT =
  'id, user_id, work_date, clocked_in_at, clocked_out_at, job_ledger_id, bid_id, approved_at, rejected_at, revoked_at, notes, users!clock_sessions_user_id_fkey(name)'

type PriorRow = { job_ledger_id: string | null; clocked_in_at: string; clocked_out_at: string | null }

const hoursOf = (inIso: string, outIso: string | null): number => {
  if (!outIso) return 0
  const h = (Date.parse(outIso) - Date.parse(inIso)) / 3_600_000
  return Number.isFinite(h) && h > 0 ? h : 0
}

export async function loadJobDayLedger(args: {
  startYmd: string
  endYmd: string
  inputs?: OverheadPoolSnapshotInputs
  isCancelled?: () => boolean
}): Promise<JobDayLedger | null> {
  const { startYmd, endYmd } = args
  const cancelled = () => args.isCancelled?.() === true
  const inputs = args.inputs ?? (await loadOverheadPoolSnapshotInputs())
  const { officeJobLedgerId, wageLookup, personIdByUserId } = inputs

  const makeOverheadQ = () => {
    let q = supabase.from('clock_sessions').select(SESSION_SELECT).gte('work_date', startYmd).lte('work_date', endYmd)
    q = officeJobLedgerId ? q.or(`job_ledger_id.eq.${officeJobLedgerId},bid_id.not.is.null`) : q.not('bid_id', 'is', null)
    return q.order('id')
  }
  const makeFieldQ = () => {
    let q = supabase.from('clock_sessions').select(SESSION_SELECT).gte('work_date', startYmd).lte('work_date', endYmd).not('job_ledger_id', 'is', null)
    if (officeJobLedgerId) q = q.neq('job_ledger_id', officeJobLedgerId)
    return q.order('id')
  }
  const page = (build: () => ReturnType<typeof makeOverheadQ>, label: string) =>
    fetchAllRows(
      async (from, to) => ({
        data: (await withSupabaseRetry(async () => build().range(from, to), label)) as unknown as OverheadClockSessionRow[] | null,
        error: null,
      }),
      label,
    )

  const [overheadSessions, fieldSessions] = await Promise.all([
    page(makeOverheadQ, 'job day ledger overhead sessions'),
    page(makeFieldQ, 'job day ledger field sessions'),
  ])
  if (cancelled()) return null

  let partsByDay: Map<string, number> = new Map()
  if (officeJobLedgerId) {
    const r = await loadOfficePartsUsdByDayExcludingInternalTransfer({ officeJobLedgerId, startYmd, endYmd })
    partsByDay = r.partsUsdByDay
  }
  if (cancelled()) return null

  const labor = buildOverheadDailyLabor({ sessions: overheadSessions, officeJobLedgerId, wageByNormalizedName: wageLookup.byName, wageByPersonId: wageLookup.byPersonId, personIdByUserId })
  const field = buildOtherJobsLaborByDay({ sessions: fieldSessions, officeJobLedgerId, wageByNormalizedName: wageLookup.byName, wageByPersonId: wageLookup.byPersonId, personIdByUserId })
  const poolUsdByDay = new Map<string, number>()
  for (const row of mergeOverheadDayTableRows(labor.byDay, partsByDay, new Map(), new Map(), new Map())) poolUsdByDay.set(row.work_date, row.totalUsd)

  let pendingFieldSessions = 0
  let pendingFieldHours = 0
  for (const s of fieldSessions) {
    if (s.approved_at || s.rejected_at || s.revoked_at || !s.clocked_out_at) continue
    pendingFieldSessions += 1
    pendingFieldHours += hoursOf(s.clocked_in_at, s.clocked_out_at)
  }

  // Invoices sent in-window, Chicago-bucketed, Stripe test-mode excluded (lens B).
  const invoiceRows = await fetchAllRows(
    async (from, to) => ({
      data: (await withSupabaseRetry(
        async () =>
          supabase
            .from('jobs_ledger_invoices')
            .select('amount, sent_to_customer_at')
            .gte('sent_to_customer_at', `${ymdAddDays(startYmd, -1)}T00:00:00-00:00`)
            .lt('sent_to_customer_at', `${ymdAddDays(endYmd, 2)}T00:00:00-00:00`)
            .or('stripe_mode.is.null,stripe_mode.neq.test')
            .order('id')
            .range(from, to),
        'job day ledger invoices',
      )) as Array<{ amount: number | null; sent_to_customer_at: string | null }> | null,
      error: null,
    }),
    'job day ledger invoices',
  )
  let invoicedRevenueUsd = 0
  for (const v of bucketInvoiceRevenueByAppTzDay(invoiceRows, startYmd, endYmd).values()) invoicedRevenueUsd += v
  if (cancelled()) return null

  // Approved hours before the window on the jobs touched inside it, and their
  // display labels (the Days view's chips — the page's ledger list may not hold
  // every touched job because of the HCP filter).
  const touchedJobIds = [...new Set([...field.detailByDay.values()].flat().map((l) => l.jobLedgerId))]
  const priorHoursByJob = new Map<string, number>()
  const jobLabels = new Map<string, JobDayLedgerJobLabel>()
  const statusSpansByJob = new Map<string, JobDayLedgerStatusSpan>()
  if (touchedJobIds.length > 0) {
    const [labelRows, eventRows] = await Promise.all([
      fetchAllRowsChunkedIn(
        touchedJobIds,
        (chunk, from, to) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, status').in('id', chunk).order('id').range(from, to),
        'job day ledger job labels',
      ).catch(() => []) as Promise<Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; status: string | null }>>,
      // Working → Billed/Paid moves for the Timeline's status definition (v2.2711); fails soft to no spans.
      fetchAllRowsChunkedIn(
        touchedJobIds,
        (chunk, from, to) => supabase.from('job_status_events').select('job_id, to_status, changed_at').in('job_id', chunk).order('changed_at').range(from, to),
        'job day ledger status events',
      ).catch(() => []) as Promise<Array<{ job_id: string; to_status: string; changed_at: string }>>,
    ])
    for (const j of labelRows) jobLabels.set(j.id, { number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', name: (j.job_name ?? '').trim(), status: j.status })
    const sortedEvents = [...eventRows].sort((a, b) => a.changed_at.localeCompare(b.changed_at))
    for (const e of sortedEvents) {
      const ymd = denverCalendarDayKey(Date.parse(e.changed_at))
      const span = statusSpansByJob.get(e.job_id)
      if (!span) {
        if (e.to_status === 'working' || e.to_status === 'ready_to_bill' || e.to_status === 'billed' || e.to_status === 'paid') {
          const isEnd = e.to_status === 'billed' || e.to_status === 'paid'
          statusSpansByJob.set(e.job_id, {
            startYmd: ymd,
            endYmd: isEnd ? ymd : null,
            billedYmd: e.to_status === 'billed' ? ymd : null,
            paidYmd: e.to_status === 'paid' ? ymd : null,
          })
        }
      } else {
        if (span.endYmd == null && (e.to_status === 'billed' || e.to_status === 'paid')) span.endYmd = ymd
        if (span.billedYmd == null && e.to_status === 'billed') span.billedYmd = ymd
        if (span.paidYmd == null && e.to_status === 'paid') span.paidYmd = ymd
      }
    }
    const priorRows = (await fetchAllRowsChunkedIn(
      touchedJobIds,
      (chunk, from, to) =>
        supabase
          .from('clock_sessions')
          .select('job_ledger_id, clocked_in_at, clocked_out_at')
          .in('job_ledger_id', chunk)
          .lt('work_date', startYmd)
          .not('approved_at', 'is', null)
          .is('rejected_at', null)
          .is('revoked_at', null)
          .not('clocked_out_at', 'is', null)
          .order('id')
          .range(from, to),
      'job day ledger prior hours',
    )) as PriorRow[]
    for (const r of priorRows) if (r.job_ledger_id) priorHoursByJob.set(r.job_ledger_id, (priorHoursByJob.get(r.job_ledger_id) ?? 0) + hoursOf(r.clocked_in_at, r.clocked_out_at))
  }
  if (cancelled()) return null

  return buildJobDayLedger({
    startYmd,
    endYmd,
    officeJobLedgerId,
    fieldDetailByDay: field.detailByDay,
    poolUsdByDay,
    priorHoursByJob,
    jobLabels,
    statusSpansByJob,
    pendingFieldSessions,
    pendingFieldHours,
    invoicedRevenueUsd,
    addDays: ymdAddDays,
  })
}
