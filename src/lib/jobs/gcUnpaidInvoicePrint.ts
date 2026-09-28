/**
 * GC Review → Share → Print unpaid invoices: every unpaid bill on one GC's
 * statement, as the app's own invoice documents, in the statement's order.
 * The statement row says which bill; the job is re-read before printing, so a
 * bill paid or sent back since the board loaded is left out rather than
 * printed as owed. Pure helpers here; `gcUnpaidInvoicePrintIo.ts` does the I/O.
 */
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../jobsStagesBoard'
import { gcReviewRowKey, type GcReviewGroup } from '../gcReviewRollup'
import type { PhysicalInvoiceDocument } from '../physicalInvoiceDocument'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../physicalInvoiceDocumentForBilledInvoice'
import { invoiceOpenRemainingOnJob } from './invoiceBilling'

export type GcUnpaidInvoiceTarget = { jobId: string; invoiceId: string }

export type GcUnpaidInvoicePrintPlan = {
  /** One per bill, in the statement's row order. */
  targets: GcUnpaidInvoiceTarget[]
  /** Statement rows that are a job balance with no bill behind it — nothing to print. */
  rowsWithoutBill: number
}

/** Which bills a GC's statement names: each row's own bill, once, in the order the statement lists them. */
export function planGcUnpaidInvoicePrint(group: Pick<GcReviewGroup, 'rows'>, stageRows: readonly StageRow[]): GcUnpaidInvoicePrintPlan {
  const byKey = new Map<string, StageRow>()
  for (const r of stageRows) if (!byKey.has(gcReviewRowKey(r))) byKey.set(gcReviewRowKey(r), r)
  const targets: GcUnpaidInvoiceTarget[] = []
  const seen = new Set<string>()
  let rowsWithoutBill = 0
  for (const row of group.rows) {
    const stageRow = byKey.get(row.key)
    if (!stageRow || stageRow.kind === 'job') {
      rowsWithoutBill++
      continue
    }
    if (seen.has(stageRow.inv.id)) continue
    seen.add(stageRow.inv.id)
    targets.push({ jobId: stageRow.job.id, invoiceId: stageRow.inv.id })
  }
  return { targets, rowsWithoutBill }
}

export type GcUnpaidInvoiceDocs = {
  docs: PhysicalInvoiceDocument[]
  /** Bills paid, sent back or deleted since the board loaded. */
  noLongerUnpaid: number
  /** Bills whose job could not be read, or that the job cannot render. */
  failed: number
}

/** The document for each planned bill, from the jobs as they stand now; a bill that cannot render is counted, never faked. */
export function gcUnpaidInvoiceDocs(targets: readonly GcUnpaidInvoiceTarget[], jobsById: ReadonlyMap<string, JobWithDetails>): GcUnpaidInvoiceDocs {
  const out: GcUnpaidInvoiceDocs = { docs: [], noLongerUnpaid: 0, failed: 0 }
  for (const t of targets) {
    const job = jobsById.get(t.jobId)
    if (!job) {
      out.failed++
      continue
    }
    const inv = (job.invoices ?? []).find((i) => i.id === t.invoiceId)
    if (!inv || inv.status !== 'billed' || invoiceOpenRemainingOnJob(inv, job) <= 0.005) {
      out.noLongerUnpaid++
      continue
    }
    let doc: PhysicalInvoiceDocument | null = null
    try {
      doc = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv)
    } catch {
      doc = null
    }
    if (doc) out.docs.push(doc)
    else out.failed++
  }
  return out
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What the office is told once the PDF is up: how many printed, and every bill or row that did not and why. */
export function gcUnpaidInvoicePrintSummary(
  gcName: string,
  counts: { printed: number; rowsWithoutBill: number; noLongerUnpaid: number; failed: number },
): { message: string; complete: boolean } {
  const left: string[] = []
  if (counts.rowsWithoutBill > 0) left.push(`${plural(counts.rowsWithoutBill, 'row is a job balance', 'rows are job balances')} with no invoice`)
  if (counts.noLongerUnpaid > 0) left.push(`${plural(counts.noLongerUnpaid, 'bill is', 'bills are')} no longer unpaid`)
  if (counts.failed > 0) left.push(`${plural(counts.failed, 'bill', 'bills')} could not be built`)
  const head = counts.printed > 0 ? `${plural(counts.printed, 'unpaid invoice', 'unpaid invoices')} for ${gcName}` : `No unpaid invoices to print for ${gcName}`
  return { message: left.length > 0 ? `${head} — left out: ${left.join('; ')}.` : `${head}.`, complete: left.length === 0 }
}
