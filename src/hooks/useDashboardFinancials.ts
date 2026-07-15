import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { stubNetPay } from '../lib/payStubDeductions'
import { fetchSubLaborDueJobRows } from './useSubLaborDueTotal'
import { localYmdFromDate } from '../lib/payStubPayments'
import {
  buildUpcomingPayrollSummary,
  upcomingPayrollFetchStartYmd,
  type UpcomingClockSessionRow,
} from '../lib/upcomingPayrollSummary'
import {
  buildApBucket,
  buildApBucketFromAggregates,
  buildArBuckets,
  buildUnbilledBucket,
  buildUpcomingApSection,
  mergeUpcomingIntoAp,
  upcomingApSectionFromAggregates,
  financialJobLabel,
  type FinancialBucket,
  type FinancialInvoicePaymentRow,
  type FinancialInvoiceRow,
  type FinancialJobRow,
  type FinancialPayrollStubRow,
  type FinancialSupplyInvoiceRow,
  type UpcomingPayrollApSection,
} from '../lib/dashboardFinancials'

/** Detail for one unpaid supply-house bill — powers the AP row click-through modal. */
export type DashboardApBill = {
  /** Matches the AP FinancialItem key (`supply:<invoice id>`). */
  itemKey: string
  houseName: string
  invoiceNumber: string
  purchaseOrderNumber: string | null
  invoiceDateYmd: string | null
  dueDateYmd: string | null
  amount: number
  /** Attachment URL (Google Drive in practice); null when none recorded. */
  link: string | null
  /** Job allocations for this bill (pct desc); label via financialJobLabel. */
  jobs: Array<{ jobId: string; label: string; pct: number }>
}

export type DashboardFinancials = {
  /** Headline AR — excludes jobs flagged into Collections. */
  ar: FinancialBucket
  /** Parked receivables: billed jobs flagged difficult to collect. ar + arCollections = all billed-unpaid. */
  arCollections: FinancialBucket
  /** Includes the estimated upcoming payroll (mergeUpcomingIntoAp) — all team labor owed, not just stubbed weeks. */
  ap: FinancialBucket & { supplyTotal: number; payrollTotal: number; subLaborTotal: number; upcomingTotal: number }
  /** Estimated payroll for worked-but-unreported weeks — same kernel as the Payroll ledger header. */
  apUpcoming: UpcomingPayrollApSection
  /** Keyed by AP item key. */
  apBills: Record<string, DashboardApBill>
  unbilled: FinancialBucket
}

const CHUNK = 200

async function chunked<T>(ids: string[], fetchChunk: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    out.push(...(await fetchChunk(ids.slice(i, i + CHUNK))))
  }
  return out
}

/**
 * Data for the Dashboard "Financials" one-pager (AR / AP / Not billed). Fetches once per mount
 * for privileged roles; all math lives in the pure dashboardFinancials kernel so the cards match
 * Jobs Stages / Supply Houses / the Payroll ledger.
 */
export function useDashboardFinancials(
  enabled: boolean,
  refreshKey?: number,
  /**
   * Assistants can't read pay_stubs/people_pay_config since the pay lockdown (v2.660) —
   * they get org-level aggregates from get_dashboard_payroll_totals instead of per-person rows.
   */
  viewerRole?: string | null,
): {
  data: DashboardFinancials | null
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<DashboardFinancials | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const assistantAggregates = viewerRole === 'assistant'
    void (async () => {
      try {
        // Upcoming-payroll inputs are best-effort: a failure there degrades to an empty
        // "upcoming" section (Payroll-ledger precedent) instead of failing the whole load.
        const [jobsRes, invoicesRes, supplyRes, stubsRes, usersRes, payConfigRes, payrollTotalsRes, subLaborRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, job_address, status, revenue, payments_made, last_bill_date, last_work_date, collections_at, pct_complete')
                .in('status', ['billed', 'ready_to_bill', 'working']),
            'dashboard financials jobs',
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('jobs_ledger_invoices')
                .select('id, job_id, amount, status, billed_at')
                .in('status', ['ready_to_bill', 'billed']),
            'dashboard financials invoices',
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('supply_house_invoices')
                .select('id, amount, invoice_date, due_date, link, invoice_number, purchase_order_number, supply_houses(name)')
                .eq('is_paid', false),
            'dashboard financials supply invoices',
          ),
          assistantAggregates
            ? Promise.resolve(null)
            : withSupabaseRetry(
                async () =>
                  await supabase
                    .from('pay_stubs')
                    .select('id, person_name, period_start, period_end, gross_pay'),
                'dashboard financials pay stubs',
              ),
          assistantAggregates
            ? Promise.resolve(null)
            : withSupabaseRetry(
                async () => await supabase.from('users').select('id, name'),
                'dashboard financials users',
              ).catch(() => null),
          assistantAggregates
            ? Promise.resolve(null)
            : withSupabaseRetry(
                async () => await supabase.from('people_pay_config').select('person_name, hourly_wage'),
                'dashboard financials pay config',
              ).catch(() => null),
          // Assistant path: org-level payroll aggregates (never per-person rows).
          assistantAggregates
            ? withSupabaseRetry(
                async () => await supabase.rpc('get_dashboard_payroll_totals'),
                'dashboard financials payroll totals',
              )
                .then(
                  (t) =>
                    t as {
                      payroll_due_total: number
                      payroll_due_count: number
                      upcoming_total: number
                      upcoming_person_week_count: number
                    } | null,
                )
                .catch(() => null)
            : Promise.resolve(null),
          // Sub-labor balances are best-effort too — RLS or errors degrade to $0, not a failed load.
          fetchSubLaborDueJobRows().catch(() => []),
        ])
        if (cancelled) return

        const jobs = (jobsRes ?? []) as FinancialJobRow[]
        const invoices = (invoicesRes ?? []) as FinancialInvoiceRow[]
        const supplyInvoices = (supplyRes ?? []) as unknown as Array<
          FinancialSupplyInvoiceRow & {
            due_date: string | null
            link: string | null
            invoice_number: string
            purchase_order_number: string | null
          }
        >
        const apBills: Record<string, DashboardApBill> = {}
        for (const inv of supplyInvoices) {
          apBills[`supply:${inv.id}`] = {
            itemKey: `supply:${inv.id}`,
            houseName: (inv.supply_houses?.name ?? '').trim() || 'Supply house',
            invoiceNumber: inv.invoice_number,
            purchaseOrderNumber: inv.purchase_order_number?.trim() || null,
            invoiceDateYmd: inv.invoice_date,
            dueDateYmd: inv.due_date,
            amount: Number(inv.amount ?? 0),
            link: inv.link?.trim() || null,
            jobs: [],
          }
        }
        const stubs = (stubsRes ?? []) as Array<{
          id: string
          person_name: string
          period_start: string
          period_end: string
          gross_pay: number
        }>

        const billedInvoiceIds = invoices.filter((i) => i.status === 'billed').map((i) => i.id)
        const stubIds = stubs.map((s) => s.id)
        const supplyInvoiceIds = supplyInvoices.map((i) => i.id)

        // Upcoming-payroll inputs — mirrors PeoplePayStubsTab's upcomingInputs (payroll is
        // person_name-keyed, clock_sessions is user_id-keyed; trimmed-name match).
        const userIdByPersonName: Record<string, string> = {}
        for (const u of (usersRes ?? []) as Array<{ id: string; name: string | null }>) {
          const n = (u.name ?? '').trim()
          if (n && !userIdByPersonName[n]) userIdByPersonName[n] = u.id
        }
        const hourlyWageByPersonName: Record<string, number> = {}
        const personNames: string[] = []
        for (const r of (payConfigRes ?? []) as Array<{ person_name: string; hourly_wage: number | null }>) {
          const n = r.person_name.trim()
          if (!n || !userIdByPersonName[n] || n in hourlyWageByPersonName) continue
          hourlyWageByPersonName[n] = Number(r.hourly_wage ?? 0)
          personNames.push(n)
        }
        const stubsByPerson: Record<string, Array<{ period_start: string; period_end: string }>> = {}
        const lastStubEndByPerson: Record<string, string> = {}
        for (const s of stubs) {
          const n = s.person_name.trim()
          ;(stubsByPerson[n] ??= []).push({ period_start: s.period_start, period_end: s.period_end })
          if (!lastStubEndByPerson[n] || s.period_end > lastStubEndByPerson[n]!) lastStubEndByPerson[n] = s.period_end
        }
        const todayYmd = localYmdFromDate(new Date())
        const upcomingFetchStart = upcomingPayrollFetchStartYmd({ personNames, lastStubEndByPerson, todayYmd })
        const rosterIds = personNames.map((n) => userIdByPersonName[n]!)

        const [invoicePayments, stubPayments, stubDeductions, stubAdditional, upcomingSessions, supplyAllocations] = await Promise.all([
          chunked(billedInvoiceIds, async (chunk) =>
            ((await withSupabaseRetry(
              async () =>
                await supabase.from('jobs_ledger_payments').select('invoice_id, amount').in('invoice_id', chunk),
              'dashboard financials invoice payments',
            )) ?? []) as FinancialInvoicePaymentRow[],
          ),
          chunked(stubIds, async (chunk) =>
            ((await withSupabaseRetry(
              async () => await supabase.from('pay_stub_payments').select('pay_stub_id, amount').in('pay_stub_id', chunk),
              'dashboard financials stub payments',
            )) ?? []) as Array<{ pay_stub_id: string; amount: number | null }>,
          ),
          chunked(stubIds, async (chunk) =>
            ((await withSupabaseRetry(
              async () => await supabase.from('pay_stub_deductions').select('pay_stub_id, amount').in('pay_stub_id', chunk),
              'dashboard financials stub deductions',
            )) ?? []) as Array<{ pay_stub_id: string; amount: number | null }>,
          ),
          chunked(stubIds, async (chunk) =>
            ((await withSupabaseRetry(
              async () =>
                await supabase.from('pay_stub_additional_lines').select('pay_stub_id, line_total').in('pay_stub_id', chunk),
              'dashboard financials stub additional lines',
            )) ?? []) as Array<{ pay_stub_id: string; line_total: number | null }>,
          ),
          personNames.length === 0
            ? Promise.resolve([] as UpcomingClockSessionRow[])
            : withSupabaseRetry(
                async () =>
                  await supabase
                    .from('clock_sessions')
                    .select('user_id, work_date, clocked_in_at, clocked_out_at')
                    .in('user_id', rosterIds)
                    .gte('work_date', upcomingFetchStart)
                    .is('rejected_at', null)
                    .is('revoked_at', null),
                'dashboard financials upcoming sessions',
              )
                .then((d) => (d ?? []) as UpcomingClockSessionRow[])
                .catch(() => [] as UpcomingClockSessionRow[]),
          // Job allocations per unpaid supply bill — best-effort (the bill modal shows '—' without them).
          chunked(supplyInvoiceIds, async (chunk) =>
            ((await withSupabaseRetry(
              async () =>
                await supabase
                  .from('supply_house_invoice_job_allocations')
                  .select('invoice_id, job_id, pct')
                  .in('invoice_id', chunk),
              'dashboard financials supply allocations',
            )) ?? []) as Array<{ invoice_id: string; job_id: string; pct: number | null }>,
          ).catch(() => [] as Array<{ invoice_id: string; job_id: string; pct: number | null }>),
        ])
        if (cancelled) return

        // Resolve labels for allocated jobs not already in the (status-filtered) jobs fetch.
        const jobLabelById = new Map<string, string>(jobs.map((j) => [j.id, financialJobLabel(j)]))
        const missingJobIds = [...new Set(supplyAllocations.map((a) => a.job_id))].filter((id) => !jobLabelById.has(id))
        if (missingJobIds.length > 0) {
          try {
            const extraJobs = await chunked(missingJobIds, async (chunk) =>
              ((await withSupabaseRetry(
                async () =>
                  await supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name').in('id', chunk),
                'dashboard financials allocation job labels',
              )) ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null }>,
            )
            for (const j of extraJobs) jobLabelById.set(j.id, financialJobLabel(j))
          } catch {
            // labels fall back to '—' below
          }
        }
        if (cancelled) return
        for (const a of supplyAllocations) {
          const bill = apBills[`supply:${a.invoice_id}`]
          if (!bill) continue
          bill.jobs.push({ jobId: a.job_id, label: jobLabelById.get(a.job_id) ?? '—', pct: Number(a.pct ?? 0) })
        }
        for (const bill of Object.values(apBills)) bill.jobs.sort((a, b) => b.pct - a.pct)

        const sumByStub = (rows: Array<{ pay_stub_id: string }>, value: (r: never) => number) => {
          const m = new Map<string, number>()
          for (const r of rows) m.set(r.pay_stub_id, (m.get(r.pay_stub_id) ?? 0) + value(r as never))
          return m
        }
        const paidByStub = sumByStub(stubPayments, (r: { amount: number | null }) => Number(r.amount ?? 0))
        const lessByStub = sumByStub(stubDeductions, (r: { amount: number | null }) => Number(r.amount ?? 0))
        const addByStub = sumByStub(stubAdditional, (r: { line_total: number | null }) => Number(r.line_total ?? 0))

        const payrollStubs: FinancialPayrollStubRow[] = stubs.map((s) => ({
          id: s.id,
          person_name: s.person_name,
          period_start: s.period_start,
          period_end: s.period_end,
          netPay: stubNetPay(Number(s.gross_pay ?? 0), lessByStub.get(s.id) ?? 0, addByStub.get(s.id) ?? 0),
          paidSum: paidByStub.get(s.id) ?? 0,
        }))

        const upcomingSummary = buildUpcomingPayrollSummary({
          personNames,
          userIdByPersonName,
          hourlyWageByPersonName,
          stubsByPerson,
          sessions: upcomingSessions,
          todayYmd,
          nowMs: Date.now(),
        })

        const arBuckets = buildArBuckets(jobs, invoices, invoicePayments)
        const apBase = assistantAggregates
          ? buildApBucketFromAggregates(
              supplyInvoices,
              {
                dueTotal: Number(payrollTotalsRes?.payroll_due_total ?? 0),
                dueCount: Number(payrollTotalsRes?.payroll_due_count ?? 0),
              },
              subLaborRows,
            )
          : buildApBucket(supplyInvoices, payrollStubs, subLaborRows)
        const apUpcoming = assistantAggregates
          ? upcomingApSectionFromAggregates({
              upcomingTotal: Number(payrollTotalsRes?.upcoming_total ?? 0),
              upcomingCount: Number(payrollTotalsRes?.upcoming_person_week_count ?? 0),
            })
          : buildUpcomingApSection(upcomingSummary.lines)
        setData({
          ar: arBuckets.ar,
          arCollections: arBuckets.collections,
          // All team labor owed counts toward AP — stubbed weeks at net-pay remainder plus the
          // estimated upcoming weeks (the drill-down still breaks the estimate out on its own line).
          ap: mergeUpcomingIntoAp(apBase, apUpcoming),
          apUpcoming,
          apBills,
          unbilled: buildUnbilledBucket(jobs, invoices),
        })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load financials')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, refreshKey, viewerRole])

  return { data, loading, error }
}
