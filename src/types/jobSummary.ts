/** Row shapes for the Jobs → Job Summary tab, shared between Jobs.tsx (state/loaders) and JobsJobSummaryTab. */
import type { Database } from './database'

export type JobSummaryClockSessionRow = {
  id: string
  user_id: string
  clocked_in_at: string | null
  clocked_out_at: string | null
  work_date: string | null
  revoked_at: string | null
  users: { name: string } | null
}

/** Per RPC get_invoice_allocation_lines_for_jobs; invoice_link mirrors supply_house_invoices.link (Materials "View"). */
export type JobSummaryInvoiceAllocationLine = {
  job_id: string
  invoice_id: string
  allocated_amount: number
  invoice_number: string
  invoice_date: string
  invoice_total_amount: number
  supply_house_name: string
  website_url: string | null
  /** Document URL; preferred over website_url for the invoice # link. */
  invoice_link: string | null
  pct: number
}

export type JobSummaryMercuryAllocationRow = {
  id: string
  mercury_transaction_id: string
  amount: number
  note: string | null
  attributionDisplayName: string | null
  mercury_transactions: {
    posted_at: string | null
    counterparty_name: string | null
    amount: number
    note: string | null
    external_memo: string | null
    raw: Database['public']['Tables']['mercury_transactions']['Row']['raw']
  } | null
}
