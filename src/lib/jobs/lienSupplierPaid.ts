/**
 * Mark a supply house paid from the Legal desk (punch list #175 step 3, v2.5838). The office records a
 * supplier payment by checking the invoice off as paid under Materials → Supply houses; on job 891 the
 * receipt sat on Evidence for two days while the Liens window still counted six unpaid invoices. The
 * desk's card now offers the same check on each owed house's row: the day it was paid and which of the
 * house's unpaid invoices on this job it covers. The write (`lienSupplierPaidIo.ts`) is the Supply houses
 * tab's own — `is_paid = true` and `paid_at` on `supply_house_invoices` — so every reader agrees. Pure.
 */
import { formatUsdNoCents } from './jobFormatting'
import type { LienSupplierUnpaidInvoice } from './lienJobSuppliers'

export type LienSupplierPaidDraft = { paidOn: string; invoiceIds: string[] }

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** Why the draft cannot be saved; null when it can. */
export function supplierPaidDraftProblem(draft: LienSupplierPaidDraft, todayYmd: string): string | null {
  if (!YMD.test(draft.paidOn)) return 'Pick the day it was paid.'
  if (draft.paidOn > todayYmd) return 'The day it was paid cannot be ahead of today.'
  if (draft.invoiceIds.length === 0) return 'Tick at least one invoice.'
  return null
}

/** The invoices the draft names, in the house's order. */
export function supplierPaidPicked(invoices: ReadonlyArray<LienSupplierUnpaidInvoice>, draft: LienSupplierPaidDraft): LienSupplierUnpaidInvoice[] {
  const ids = new Set(draft.invoiceIds)
  return invoices.filter((i) => ids.has(i.id))
}

/** The button: *Mark 3 invoices paid · $8,950* — the whole invoices, as the house is paid, not this job's slice. */
export function supplierPaidButtonWords(picked: ReadonlyArray<LienSupplierUnpaidInvoice>): string {
  if (picked.length === 0) return 'Mark paid'
  const total = picked.reduce((s, i) => s + i.amount, 0)
  return `Mark ${picked.length} ${picked.length === 1 ? 'invoice' : 'invoices'} paid · ${formatUsdNoCents(total)}`
}

/** One invoice's line in the form: *#48812 · Jul 14 · $4,120 (this job $2,060) · job account*. */
export function supplierPaidInvoiceWords(inv: LienSupplierUnpaidInvoice): string {
  const parts: string[] = []
  parts.push(inv.invoiceNumber ? `#${inv.invoiceNumber}` : 'no number')
  if (inv.invoiceDate) parts.push(new Date(`${inv.invoiceDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))
  parts.push(Math.abs(inv.amount - inv.allocated) > 0.005 ? `${formatUsdNoCents(inv.amount)} (this job ${formatUsdNoCents(inv.allocated)})` : formatUsdNoCents(inv.amount))
  if (inv.onJobAccount) parts.push('job account')
  return parts.join(' · ')
}

/** A line that warns when a ticked invoice is split across jobs: the whole invoice is marked paid, not only this job's part. */
export function supplierPaidSplitWarning(picked: ReadonlyArray<LienSupplierUnpaidInvoice>): string {
  const split = picked.filter((i) => Math.abs(i.amount - i.allocated) > 0.005)
  if (split.length === 0) return ''
  return `${split.length === 1 ? 'One invoice is' : `${split.length} invoices are`} split across jobs: marking ${split.length === 1 ? 'it' : 'them'} paid marks the whole invoice paid, on every job it is on.`
}

/** The toast after a save. */
export function supplierPaidSavedWords(houseName: string, count: number): string {
  return `Marked ${count} ${count === 1 ? 'invoice' : 'invoices'} from ${houseName} paid. The Liens window and Held for suppliers read it too.`
}
