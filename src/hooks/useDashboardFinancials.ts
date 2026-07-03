import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { stubNetPay } from '../lib/payStubDeductions'
import {
  buildApBucket,
  buildArBucket,
  buildUnbilledBucket,
  type FinancialBucket,
  type FinancialInvoicePaymentRow,
  type FinancialInvoiceRow,
  type FinancialJobRow,
  type FinancialPayrollStubRow,
  type FinancialSupplyInvoiceRow,
} from '../lib/dashboardFinancials'

export type DashboardFinancials = {
  ar: FinancialBucket
  ap: FinancialBucket & { supplyTotal: number; payrollTotal: number }
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
        const [jobsRes, invoicesRes, supplyRes, stubsRes] = await Promise.all([
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

        const [invoicePayments, stubPayments, stubDeductions, stubAdditional] = await Promise.all([
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

        setData({
          ar: buildArBucket(jobs, invoices, invoicePayments),
          ap: buildApBucket(supplyInvoices, payrollStubs),
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
