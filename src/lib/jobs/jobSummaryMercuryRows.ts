// A job's card lines as Job Summary holds them: one mapping from the shared per-job loader
// (`fetchMercuryJobAllocationsWithAttributionForJob`) for an open row's cache and for the
// cost breakdown print, so the print lists the same lines whether or not the row had loaded
// them (Stage A step 11, docs/JOBS_TABS_ARCHITECTURE.md).

import {
  fetchMercuryJobAllocationsWithAttributionForJob,
  type MercuryJobAllocationWithAttributionRow,
} from '../fetchMercuryJobAllocationsWithAttributionForJob'
import type { JobSummaryMercuryAllocationRow } from '../../types/jobSummary'

/** The loader's rows in the cache's shape: the transaction narrowed to the six fields the row and the print read. Pure. */
export function jobSummaryMercuryRowsFromAllocations(
  rows: readonly MercuryJobAllocationWithAttributionRow[],
): JobSummaryMercuryAllocationRow[] {
  return rows.map((r) => ({
    id: r.id,
    mercury_transaction_id: r.mercury_transaction_id,
    amount: r.amount,
    note: r.note,
    attributionDisplayName: r.attributionDisplayName,
    linkedToSupplyInvoice: r.linkedToSupplyInvoice,
    isFuel: r.isFuel,
    mercury_transactions: r.mercury_transactions
      ? {
          posted_at: r.mercury_transactions.posted_at,
          counterparty_name: r.mercury_transactions.counterparty_name,
          amount: r.mercury_transactions.amount,
          note: r.mercury_transactions.note,
          external_memo: r.mercury_transactions.external_memo,
          raw: r.mercury_transactions.raw,
        }
      : null,
  }))
}

/**
 * The cost breakdown print's card lines: the row's cache, else one read through the row's own
 * loader (paged, Internal Transfers dropped, the invoice-linked and fuel flags set), so the
 * lines agree with the card total. The cache is empty when the row's card total is $0 or less
 * (the expanded-row effect loads only above $0) or its read is still running. A failed read
 * prints without the lines.
 */
export async function loadJobSummaryPrintMercuryRows(
  jobId: string,
  cachedByJobId: ReadonlyMap<string, JobSummaryMercuryAllocationRow[]>,
): Promise<{ rows: JobSummaryMercuryAllocationRow[]; cardDetailUnavailable: boolean }> {
  if (cachedByJobId.has(jobId)) return { rows: cachedByJobId.get(jobId) ?? [], cardDetailUnavailable: false }
  try {
    const rows = await fetchMercuryJobAllocationsWithAttributionForJob(jobId, 'job summary print')
    return { rows: jobSummaryMercuryRowsFromAllocations(rows), cardDetailUnavailable: false }
  } catch {
    return { rows: [], cardDetailUnavailable: true }
  }
}
