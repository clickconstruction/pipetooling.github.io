import type { Database } from '../../types/database'
import type { JobBillingContext } from '../../lib/jobBillingContext'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type SendRecordInvoicePayload =
  | { kind: 'job'; job: JobBillingContext }
  | {
      kind: 'invoice'
      job: JobBillingContext
      /**
       * A stored `stripe_invoice_memo` pre-fills the modal's memo; for non-primary rows
       * (standalone charges like Turnaway trip charges) it also pre-fills the Stripe line
       * description, producing a single clean invoice line.
       */
      invoice: Pick<JobsLedgerInvoice, 'id' | 'amount' | 'status'> & {
        stripe_invoice_memo?: string | null
        is_primary_rtb_bundle?: boolean | null
      }
    }
