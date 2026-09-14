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

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** Billed invoices with money still open, oldest first — what the notice claims. */
export function unpaidBilledInvoices(job: JobWithDetails): JobsLedgerInvoice[] {
  const applied = new Map<string, number>()
  for (const p of job.payments ?? []) {
    if (p.invoice_id) applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
  }
  return (job.invoices ?? [])
    .filter((i) => i.status === 'billed' && Number(i.amount ?? 0) - (applied.get(i.id) ?? 0) > 0.005)
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
}

export type NoticeInvoiceDoc = { invoiceId: string; title: string; doc: PhysicalInvoiceDocument }

/** The document for each unpaid bill; a bill the job cannot render is skipped, never faked. */
export function noticeInvoiceDocs(job: JobWithDetails): NoticeInvoiceDoc[] {
  const out: NoticeInvoiceDoc[] = []
  for (const inv of unpaidBilledInvoices(job)) {
    let doc: PhysicalInvoiceDocument | null = null
    try {
      doc = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    } catch {
      doc = null
    }
    if (!doc) continue
    out.push({ invoiceId: inv.id, title: `Invoice ${doc.invoiceNumberDisplay !== '—' ? doc.invoiceNumberDisplay : `#${inv.sequence_order}`}${doc.invoiceDateDisplay && doc.invoiceDateDisplay !== '—' ? `, ${doc.invoiceDateDisplay}` : ''}`, doc })
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
