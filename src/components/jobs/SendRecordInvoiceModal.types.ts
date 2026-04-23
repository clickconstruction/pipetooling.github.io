import type { Database } from '../../types/database'
import type { JobBillingContext } from '../../lib/jobBillingContext'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type SendRecordInvoicePayload =
  | { kind: 'job'; job: JobBillingContext }
  | { kind: 'invoice'; job: JobBillingContext; invoice: Pick<JobsLedgerInvoice, 'id' | 'amount' | 'status'> }
