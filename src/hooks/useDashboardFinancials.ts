import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { stubNetPay } from '../lib/payStubDeductions'
import { localYmdFromDate } from '../lib/payStubPayments'
import {
  buildUpcomingPayrollSummary,
  upcomingPayrollFetchStartYmd,
  type UpcomingClockSessionRow,
} from '../lib/upcomingPayrollSummary'
import {
  buildApBucket,
  buildArBucket,
  buildUnbilledBucket,
  buildUpcomingApSection,
  type FinancialBucket,
  type FinancialInvoicePaymentRow,
  type FinancialInvoiceRow,
  type FinancialJobRow,
  type FinancialPayrollStubRow,
  type FinancialSupplyInvoiceRow,
  type UpcomingPayrollApSection,
} from '../lib/dashboardFinancials'

export type DashboardFinancials = {
  ar: FinancialBucket
  ap: FinancialBucket & { supplyTotal: number; payrollTotal: number }
  /** Estimated payroll for worked-but-unreported weeks — same kernel as the Payroll ledger header. */
  apUpcoming: UpcomingPayrollApSection
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
export function useDashboardFinancials(enabled: boolean, refreshKey?: number): {
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
    void (async () => {
      try {
        // Upcoming-payroll inputs are best-effort: a failure there degrades to an empty
        // "upcoming" section (Payroll-ledger precedent) instead of failing the whole load.
        const [jobsRes, invoicesRes, supplyRes, stubsRes, usersRes, payConfigRes] = await Promise.all([
          withSupabaseRetry(
            async () =>
              await supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, job_address, status, revenue, payments_made, last_bill_date, last_work_date')
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
                .select('id, amount, invoice_date, supply_houses(name)')
                .eq('is_paid', false),
            'dashboard financials supply invoices',
          ),
          withSupabaseRetry(
            async () =>
              await supabase
                .from('pay_stubs')
                .select('id, person_name, period_start, period_end, gross_pay'),
            'dashboard financials pay stubs',
          ),
          withSupabaseRetry(
            async () => await supabase.from('users').select('id, name'),
            'dashboard financials users',
          ).catch(() => null),
          withSupabaseRetry(
            async () => await supabase.from('people_pay_config').select('person_name, hourly_wage'),
            'dashboard financials pay config',
          ).catch(() => null),
        ])
        if (cancelled) return

        const jobs = (jobsRes ?? []) as FinancialJobRow[]
        const invoices = (invoicesRes ?? []) as FinancialInvoiceRow[]
        const supplyInvoices = (supplyRes ?? []) as unknown as FinancialSupplyInvoiceRow[]
        const stubs = (stubsRes ?? []) as Array<{
          id: string
          person_name: string
          period_start: string
          period_end: string
          gross_pay: number
        }>

        const billedInvoiceIds = invoices.filter((i) => i.status === 'billed').map((i) => i.id)
        const stubIds = stubs.map((s) => s.id)

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

        const [invoicePayments, stubPayments, stubDeductions, stubAdditional, upcomingSessions] = await Promise.all([
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
        ])
        if (cancelled) return

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

        setData({
          ar: buildArBucket(jobs, invoices, invoicePayments),
          ap: buildApBucket(supplyInvoices, payrollStubs),
          apUpcoming: buildUpcomingApSection(upcomingSummary.lines),
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
  }, [enabled, refreshKey])

  return { data, loading, error }
}
