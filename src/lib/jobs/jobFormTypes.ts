/**
 * Shared row/model types for the Edit/New Job form (JobFormModal) and its
 * extracted pure helpers. Kept in one place so the modal and the `lib/jobs`
 * kernels agree on the shapes without a circular import back into the component.
 */
import type { Database } from '../../types/database'
import type { StageKind } from './stagePlan'

export type JobFormServiceType = { id: string; name: string; color: string | null }

export type MeServiceTypeColumns = {
  role?: string
  estimator_service_type_ids?: string[] | null
  primary_service_type_ids?: string[] | null
  superintendent_service_type_ids?: string[] | null
  subcontractor_service_type_ids?: string[] | null
  helpers_service_type_ids?: string[] | null
}

export type MaterialRow = { id: string; description: string; amount: number }

export type PaymentRow = {
  id: string
  amount: number
  paid_on: string | null
  /** Optional: the date the payment was SENT (check date); paid_on stays "received" (v2.2303). */
  sent_on: string | null
  note: string | null
  payment_type: string | null
  reference_number: string | null
  /** Set when loaded from DB; payments applied to an invoice cannot be removed in this form. */
  invoice_id: string | null
  /** Set when loaded from DB; Bank Payments flow links a Mercury transaction. */
  mercury_transaction_id: string | null
}

export type FixtureRow = {
  id: string
  name: string
  count: number
  /** Unit price in dollars; null when unset. */
  line_unit_price: number | null
  line_description: string
  /**
   * jobs_ledger_invoices.id billing this line item (job-stages billing,
   * v2.1069). Carried through the save engine's delete+reinsert so the link
   * survives id churn; null = unbilled segment. Linked rows lock in ①.
   */
  invoice_id: string | null
  /**
   * Stage Plan (v2.3083+): `order` = numbered stage, `any` = its own dates,
   * null = a plain line item. `undefined` = never loaded / newly added — saves
   * as the column default (`any`).
   */
  stage_kind?: StageKind | null
  /** The eye: this line item shows on the GC portal's stage sequence. */
  shared_with_gc?: boolean
}

export type JobsLedgerInvoiceRow = Database['public']['Tables']['jobs_ledger_invoices']['Row']
