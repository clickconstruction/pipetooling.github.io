/**
 * Customer Hub — Invoices tab data assembly (Customer Hub train, PR 5).
 * All invoices across one customer's jobs plus their invoice-linked payments;
 * the pure row mapping lives in customerInvoiceRows.ts.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type {
  CustomerInvoiceInput,
  CustomerInvoiceJob,
  CustomerInvoicePaymentInput,
} from './customerInvoiceRows'

type JobRow = {
  id: string
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  status: string | null
  revenue: number | null
}

export type CustomerInvoicesData = {
  invoices: CustomerInvoiceInput[]
  payments: CustomerInvoicePaymentInput[]
  jobs: CustomerInvoiceJob[]
}

export async function fetchCustomerInvoices(customerId: string): Promise<CustomerInvoicesData> {
  const jobRows = (await withSupabaseRetry(
    () =>
      supabase
        .from('jobs_ledger')
        .select('id, hcp_number, click_number, job_name, status, revenue')
        .eq('customer_id', customerId),
    'customer invoices: jobs',
  )) as unknown as JobRow[]

  const jobs: CustomerInvoiceJob[] = (jobRows ?? []).map((j) => ({
    id: j.id,
    label: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || (j.job_name ?? '').trim() || 'Job',
    status: j.status,
    revenue: j.revenue,
  }))
  const jobIds = jobs.map((j) => j.id)
  if (jobIds.length === 0) return { invoices: [], payments: [], jobs }

  const [invoicesRes, paymentsRes] = await Promise.all([
    supabase
      .from('jobs_ledger_invoices')
      .select(
        'id, job_id, amount, status, sequence_order, billed_at, estimated_bill_date, created_at, sent_to_customer_at, external_send_channel, stripe_invoice_id, hosted_invoice_url',
      )
      .in('job_id', jobIds),
    supabase.from('jobs_ledger_payments').select('invoice_id, amount, paid_on').in('job_id', jobIds),
  ])

  return {
    invoices: (invoicesRes.data ?? []) as CustomerInvoiceInput[],
    payments: (paymentsRes.data ?? []) as CustomerInvoicePaymentInput[],
    jobs,
  }
}
