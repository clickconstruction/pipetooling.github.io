import type { JobWithDetails } from '../../types/jobWithDetails'
import { fetchJobWithDetailsById } from '../fetchJobWithDetailsById'
import { buildPhysicalInvoicePdfBlob } from '../physicalInvoicePdf'
import { mergePdfBlobs } from '../jobsDocuments/demandLetterPacket'
import { gcUnpaidInvoiceDocs, gcUnpaidInvoicePrintSummary, type GcUnpaidInvoicePrintPlan } from './gcUnpaidInvoicePrint'

export type OpenGcUnpaidInvoicesCallbacks = {
  /** The browser refused the tab — tell the user to allow pop-ups. */
  onBlocked: () => void
  onError: (message: string) => void
  /** The PDF is up (or there was nothing to print): the summary line, and whether every row printed. */
  onDone: (summary: { message: string; complete: boolean; printed: number }) => void
}

/** Jobs are read a few at a time — a GC can have dozens, and the office is using the app. */
const JOB_FETCH_CONCURRENCY = 5

async function fetchJobsById(jobIds: readonly string[]): Promise<Map<string, JobWithDetails>> {
  const out = new Map<string, JobWithDetails>()
  let next = 0
  const worker = async () => {
    while (next < jobIds.length) {
      const id = jobIds[next++]!
      const job = await fetchJobWithDetailsById(id)
      if (job) out.set(id, job)
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOB_FETCH_CONCURRENCY, jobIds.length) }, worker))
  return out
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Every unpaid invoice on one GC's statement as a single PDF in a new tab —
 * the same documents View bill builds, in the statement's order. The tab must
 * be opened synchronously (before any await) or pop-up blockers eat it; it
 * says what it is building until the PDF lands.
 */
export async function openGcUnpaidInvoicesPdfInNewTab(gcName: string, plan: GcUnpaidInvoicePrintPlan, cb: OpenGcUnpaidInvoicesCallbacks): Promise<void> {
  if (plan.targets.length === 0) {
    const s = gcUnpaidInvoicePrintSummary(gcName, { printed: 0, rowsWithoutBill: plan.rowsWithoutBill, noLongerUnpaid: 0, failed: 0 })
    cb.onDone({ ...s, printed: 0 })
    return
  }
  const win = window.open('', '_blank')
  if (!win) {
    cb.onBlocked()
    return
  }
  let objectUrl: string | null = null
  try {
    win.document.write(
      `<!doctype html><title>Unpaid invoices — ${escapeHtml(gcName)}</title><body style="font-family:system-ui,sans-serif;padding:2rem">Building ${plan.targets.length} unpaid invoice${plan.targets.length === 1 ? '' : 's'} for ${escapeHtml(gcName)}…</body>`,
    )
    win.document.close()
    const jobsById = await fetchJobsById(Array.from(new Set(plan.targets.map((t) => t.jobId))))
    const built = gcUnpaidInvoiceDocs(plan.targets, jobsById)
    const summary = gcUnpaidInvoicePrintSummary(gcName, { printed: built.docs.length, rowsWithoutBill: plan.rowsWithoutBill, noLongerUnpaid: built.noLongerUnpaid, failed: built.failed })
    if (built.docs.length === 0) {
      win.close()
      cb.onDone({ ...summary, printed: 0 })
      return
    }
    const blobs: Blob[] = []
    for (const doc of built.docs) blobs.push(await buildPhysicalInvoicePdfBlob(doc))
    const blob = blobs.length === 1 ? blobs[0]! : await mergePdfBlobs(blobs)
    objectUrl = URL.createObjectURL(blob)
    win.location.href = objectUrl
    window.setTimeout(() => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }, 60_000)
    cb.onDone({ ...summary, printed: built.docs.length })
  } catch (e) {
    win.close()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    cb.onError(e instanceof Error ? e.message : 'Could not build the invoices')
  }
}
