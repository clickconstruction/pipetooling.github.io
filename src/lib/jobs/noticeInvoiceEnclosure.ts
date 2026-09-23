/**
 * The invoice behind a § 53.056 notice (v2.3437). Tex. Prop. Code
 * § 53.056(a-3): "The notice may include an invoice or billing statement."
 * The same machinery the demand letter uses for Exhibit A (v2.3429): the
 * app's physical-invoice document for every billed, unpaid invoice on the
 * job, rendered to PDF and merged behind the notice with an INVOICE stamp, or
 * appended as print pages. Pure helpers here; the modal and the run do the I/O.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Database } from '../../types/database'
import { buildPhysicalInvoiceEmailBodies, type PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../physicalInvoiceDocumentForBilledInvoice'
import type { DemandExhibitInput } from '../jobsDocuments/demandLetterPacket'
import { demandDate, fallbackInvoiceNumber } from '../jobsDocuments/demandLetter'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** Billed invoices with money still open, oldest first — what the notice claims — each with what is still owed on it. */
export function unpaidBilledInvoicesWithOpen(job: JobWithDetails): Array<{ inv: JobsLedgerInvoice; open: number }> {
  const applied = new Map<string, number>()
  for (const p of job.payments ?? []) {
    if (p.invoice_id) applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  return (job.invoices ?? [])
    .map((inv) => ({ inv, open: Number(inv.amount ?? 0) - (applied.get(inv.id) ?? 0) }))
    .filter(({ inv, open }) => inv.status === 'billed' && open > 0.005)
    .sort((a, b) => a.inv.sequence_order - b.inv.sequence_order)
}

/** Billed invoices with money still open, oldest first — what the notice claims. */
export function unpaidBilledInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  return unpaidBilledInvoicesWithOpen(job).map(({ inv }) => inv)
}

export type NoticeInvoiceDoc = {
  invoiceId: string
  title: string
  doc: PhysicalInvoiceDocument
  /** The pay page (v2.3758): a Stripe bill has a payment page and so a code; null = paper only, no code. */
  stripeInvoiceId: string | null
  /** What is still owed on this bill (the pay page's "Still owed"). */
  openAmount: number
  /** The bill's line as the invoice reads it — the pay page's description. */
  description: string
}

export const PAY_PAGE_DESCRIPTION_MAX = 140

/**
 * The bill's line for the pay page (v2.3758): a bill with one service line is that line (a
 * trip charge, a change order — the Stripe memo under it is the mailing note, not the work);
 * a bill with many lines reads its scope (the memo) when it has one, else the first line and
 * how many more. Never longer than a row.
 */
export function payPageDescription(doc: Pick<PhysicalInvoiceDocument, 'serviceLines' | 'narrativeTitle' | 'lineDescription'>): string {
  const lines = (doc.serviceLines ?? []).map((l) => (l.description ?? '').trim()).filter(Boolean)
  const scope = (doc.narrativeTitle || doc.lineDescription || '').trim()
  let out = ''
  if (lines.length === 1) out = lines[0]!
  else if (scope) out = scope
  else if (lines.length > 1) out = `${lines[0]} + ${lines.length - 1} more`
  out = out.replace(/\s+/g, ' ')
  return out.length > PAY_PAGE_DESCRIPTION_MAX ? `${out.slice(0, PAY_PAGE_DESCRIPTION_MAX - 1).trimEnd()}…` : out
}

/** The document for each unpaid bill; a bill the job cannot render is skipped, never faked. */
export function noticeInvoiceDocs(job: JobWithDetails): NoticeInvoiceDoc[] {
  const out: NoticeInvoiceDoc[] = []
  for (const { inv, open } of unpaidBilledInvoicesWithOpen(job)) {
    let doc: PhysicalInvoiceDocument | null = null
    try {
      doc = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    } catch {
      doc = null
    }
    if (!doc) continue
    // The number the bill shows (never "#0" for the primary bill) and the day it went out (v2.3445).
    const number = doc.invoiceNumberDisplay !== '—' && doc.invoiceNumberDisplay !== '#0' ? doc.invoiceNumberDisplay : fallbackInvoiceNumber(inv, job.hcp_number)
    const billed = ((inv.billed_at ?? inv.sent_to_customer_at ?? '') as string).slice(0, 10)
    out.push({
      invoiceId: inv.id,
      title: `Invoice ${number}${/^\d{4}-\d{2}-\d{2}$/.test(billed) ? `, ${demandDate(billed)}` : ''}`,
      doc,
      stripeInvoiceId: (inv.stripe_invoice_id ?? '').trim() || null,
      openAmount: Math.round(open * 100) / 100,
      description: payPageDescription(doc),
    })
  }
  return out
}

/** "Invoice #1, August 18, 2026 enclosed" / "Invoices #1 and #2 enclosed" — the notice's reference strip. */
export function noticeEnclosureRefItem(docs: readonly NoticeInvoiceDoc[]): string {
  if (docs.length === 0) return ''
  if (docs.length === 1) return `${docs[0]!.title} enclosed`
  return `${docs.length} invoices enclosed`
}

/** The exhibit inputs for the packet merge, stamped INVOICE rather than EXHIBIT. */
export function noticeInvoiceExhibitInputs(docs: readonly NoticeInvoiceDoc[], toPdf: (doc: PhysicalInvoiceDocument) => Promise<Blob>): Promise<DemandExhibitInput[]> {
  return Promise.all(docs.map(async (d) => ({ label: 'A' as const, stamp: 'INVOICE', title: d.title, blob: await toPdf(d.doc) })))
}

/** Print pages for the enclosed invoices — one section per invoice, each on its own sheet. */
export function noticeInvoicePrintSections(docs: readonly NoticeInvoiceDoc[]): string[] {
  return docs.map(
    (d) =>
      `<div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:0.72rem;color:#8a1c1c;font-weight:700;letter-spacing:0.08em;border:2px solid #8a1c1c;display:inline-block;padding:3px 6px;margin-bottom:0.8rem">INVOICE · enclosed with the § 53.056 notice (Tex. Prop. Code § 53.056(a-3))</div>` +
      buildPhysicalInvoiceEmailBodies(d.doc).html,
  )
}
