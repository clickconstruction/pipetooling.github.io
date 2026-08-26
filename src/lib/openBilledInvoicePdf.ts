import { fetchJobWithDetailsById } from './fetchJobWithDetailsById'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from './physicalInvoiceDocumentForBilledInvoice'
import { buildPhysicalInvoicePdfBlob } from './physicalInvoicePdf'

export type OpenBilledInvoicePdfCallbacks = {
  /** The browser refused the tab — tell the user to allow pop-ups. */
  onBlocked: () => void
  onError: (message: string) => void
}

/**
 * One-click invoice PDF (v2.2329): fetch the job, rebuild the invoice
 * document, and point a new tab at the freshly generated PDF — the same
 * builders the View bill modal uses, without the modal trip. The tab must be
 * opened synchronously (before any await) or pop-up blockers eat it; it shows
 * blank for the moment the PDF takes to build. Returns true when the PDF
 * landed in the tab.
 */
export async function openBilledInvoicePdfInNewTab(
  invoice: { id: string; job_id: string },
  cb: OpenBilledInvoicePdfCallbacks,
): Promise<boolean> {
  const win = window.open('', '_blank')
  if (!win) {
    cb.onBlocked()
    return false
  }
  let objectUrl: string | null = null
  try {
    const job = await fetchJobWithDetailsById(invoice.job_id)
    if (!job) throw new Error('Job not found or not visible.')
    const inv = job.invoices.find((i) => i.id === invoice.id)
    if (!inv) throw new Error('Invoice not found on this job.')
    const docModel = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    if (!docModel) throw new Error('This bill has no invoice document to render.')
    const blob = await buildPhysicalInvoicePdfBlob(docModel)
    objectUrl = URL.createObjectURL(blob)
    win.location.href = objectUrl
    window.setTimeout(() => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }, 60_000)
    return true
  } catch (e) {
    win.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    cb.onError(e instanceof Error ? e.message : 'Could not build the PDF')
    return false
  }
}
