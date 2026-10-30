/**
 * The one write of a supply-house invoice or credit (punch list #179 PR 2, v2.6088): the payload the Add / Edit
 * invoice form builds and the three writes it makes, lifted out of `SupplyHousesTab.saveInvoice` so the form keeps one
 * money path whether the bill was typed or filled from its PDF. The rules are the form's own, unchanged: the kind
 * decides the sign (`signedAmountForSave`), `paid_at` is sent only when the office typed a day that differs
 * (`paidAtPayload`), `on_job_account` and `credits_invoice_id` go only when they change, and the job allocations are
 * deleted then inserted. New here: the read a filled bill keeps (`bill_read`, `bill_attachment_id`), sent only when the
 * draft carries one, so a typed bill's save names no new column and may land before the migration is pushed.
 *
 * The database is an interface, so the test hands it a fake; `supabaseSupplyInvoiceDb` is the app's.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { BillRowRead } from './bills/billRead'
import { amountProblem, creditsInvoicePatch, paidAtPayload, signedAmountForSave, type InvoiceJobAllocation, type SupplyDocumentKind } from './supplyHouseInvoiceForm'

/** The form's state at Save. */
export interface SupplyInvoiceDraft {
  /** A row id the form chose up front (a bill dropped on the form names its own row in its link); the database picks one otherwise. */
  id?: string
  supplyHouseId: string
  kind: SupplyDocumentKind
  number: string
  dateYmd: string
  dueDateYmd: string
  /** The box's positive digits; the kind applies the sign. */
  amountTyped: string
  purchaseOrderNumber: string
  link: string
  isPaid: boolean
  paidOnYmd: string
  onJobAccount: boolean
  allocations: InvoiceJobAllocation[]
  /** The credit's invoice, '' for none. */
  creditsInvoiceId: string
  /** The read a bill filled from its PDF keeps; undefined leaves the column alone, null clears it. */
  billRead?: BillRowRead | null
  billAttachmentId?: string | null
}

/** The row being edited, as much of it as the payload rules read. Null for a new row. */
export interface PriorSupplyInvoice {
  id: string
  on_job_account?: boolean | null
  paid_at?: string | null
  credits_invoice_id?: string | null
}

export type SupplyInvoicePayload = Record<string, unknown> & { supply_house_id: string; invoice_number: string; invoice_date: string; amount: number; document_kind: SupplyDocumentKind }

/** The job the whole invoice is on, or null when it is on none or split: the job-account flag lives on one job only. */
export function singleAllocatedJobId(allocations: readonly InvoiceJobAllocation[]): string | null {
  return allocations.length === 1 && allocations[0]!.job_id ? allocations[0]!.job_id : null
}

/** The row to write, or the one problem that stops it, in the form's words. */
export function supplyInvoicePayload(draft: SupplyInvoiceDraft, prior: PriorSupplyInvoice | null): { ok: true; payload: SupplyInvoicePayload } | { ok: false; problem: string } {
  if (!draft.number.trim() || !draft.dateYmd) return { ok: false, problem: 'The number and the date are needed.' }
  const problem = amountProblem(draft.kind, draft.amountTyped)
  if (problem) return { ok: false, problem }
  const amount = signedAmountForSave(draft.kind, draft.amountTyped)
  if (amount == null) return { ok: false, problem: 'Amount must be a number.' }
  // Per-property flag: forced off unless the invoice is allocated to exactly one job.
  const effectiveOnJobAccount = draft.onJobAccount && singleAllocatedJobId(draft.allocations) != null
  const priorOnJobAccount = prior ? prior.on_job_account === true : false
  const payload: SupplyInvoicePayload = {
    ...(draft.id && !prior ? { id: draft.id } : {}),
    supply_house_id: draft.supplyHouseId,
    invoice_number: draft.number.trim(),
    invoice_date: draft.dateYmd,
    due_date: draft.dueDateYmd.trim() || null,
    amount,
    document_kind: draft.kind,
    link: draft.link.trim() || null,
    is_paid: draft.isPaid,
    // Only when the office typed a day that differs from what's stored: the trigger stamps now() on the flip to paid
    // and nulls it on the flip back.
    ...paidAtPayload(draft.isPaid, draft.paidOnYmd, prior?.paid_at),
    purchase_order_number: draft.purchaseOrderNumber.trim() || null,
    // Sent only when it changes, so untouched saves keep working in the merge-to-db-push window.
    ...(effectiveOnJobAccount !== priorOnJobAccount ? { on_job_account: effectiveOnJobAccount } : {}),
    ...creditsInvoicePatch(draft.kind, draft.creditsInvoiceId, prior),
    // The read a filled bill keeps (punch list #179): only when the draft carries one, the same window rule.
    ...(draft.billRead !== undefined ? { bill_read: draft.billRead, bill_attachment_id: draft.billAttachmentId ?? null } : {}),
  }
  return { ok: true, payload }
}

/** The allocation rows to insert: a job with a share. */
export function allocationRows(invoiceId: string, allocations: readonly InvoiceJobAllocation[]): Array<{ invoice_id: string; job_id: string; pct: number }> {
  return allocations.filter((a) => a.job_id && Number(a.pct) > 0).map((a) => ({ invoice_id: invoiceId, job_id: a.job_id, pct: Number(a.pct) }))
}

type DbError = { message: string } | null

export interface SupplyInvoiceDb {
  insertInvoice(payload: SupplyInvoicePayload): Promise<{ id: string | null; error: DbError }>
  updateInvoice(id: string, payload: SupplyInvoicePayload): Promise<{ error: DbError }>
  deleteAllocations(invoiceId: string): Promise<{ error: DbError }>
  insertAllocations(rows: Array<{ invoice_id: string; job_id: string; pct: number }>): Promise<{ error: DbError }>
}

export type SupplyInvoiceSaved = { ok: true; id: string; allocationProblem: string | null } | { ok: false; problem: string }

/**
 * The save: the row, then the allocations. A row that fails stops with its reason; allocations that fail leave the
 * row and name their reason, as the form has always done.
 */
export async function saveSupplyInvoice(db: SupplyInvoiceDb, draft: SupplyInvoiceDraft, prior: PriorSupplyInvoice | null): Promise<SupplyInvoiceSaved> {
  const built = supplyInvoicePayload(draft, prior)
  if (!built.ok) return built
  let id: string
  if (prior) {
    const { error } = await db.updateInvoice(prior.id, built.payload)
    if (error) return { ok: false, problem: formatErrorMessage(error, 'The invoice was not saved.') }
    id = prior.id
  } else {
    const inserted = await db.insertInvoice(built.payload)
    if (inserted.error || !inserted.id) return { ok: false, problem: formatErrorMessage(inserted.error ?? { message: 'No row came back.' }, 'The invoice was not saved.') }
    id = inserted.id
  }
  let allocationProblem: string | null = null
  if (draft.allocations.length > 0) {
    await db.deleteAllocations(id)
    const rows = allocationRows(id, draft.allocations)
    if (rows.length > 0) {
      const { error } = await db.insertAllocations(rows)
      if (error) allocationProblem = formatErrorMessage(error, 'The jobs were not saved on the invoice.')
    }
  } else if (prior) {
    await db.deleteAllocations(id)
  }
  return { ok: true, id, allocationProblem }
}

/** The app's database: the same two tables the form has always written. */
export const supabaseSupplyInvoiceDb: SupplyInvoiceDb = {
  async insertInvoice(payload) {
    // `bill_read` and `bill_attachment_id` are not in the generated types until the regen after the push.
    const { data, error } = await supabase.from('supply_house_invoices').insert(payload as never).select('id').single()
    return { id: (data as { id?: string } | null)?.id ?? null, error }
  },
  async updateInvoice(id, payload) {
    const { error } = await supabase.from('supply_house_invoices').update(payload as never).eq('id', id)
    return { error }
  },
  async deleteAllocations(invoiceId) {
    const { error } = await supabase.from('supply_house_invoice_job_allocations').delete().eq('invoice_id', invoiceId)
    return { error }
  },
  async insertAllocations(rows) {
    const { error } = await supabase.from('supply_house_invoice_job_allocations').insert(rows)
    return { error }
  },
}
