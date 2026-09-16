/**
 * The card-charge figure a job's PARTS cost counts (v2.2692, one rule): gross
 * card charges with Internal Transfers already out (`summarizeCardChargeAllocations`)
 * minus the slice linked to a supply-house invoice — that slice is the same
 * purchase the invoice allocation already counts, so it is counted once.
 *
 * Jobs → Job Summary computed this inline (`Jobs.tsx`); People → Review summed
 * gross allocations with neither exclusion, so the two disagreed on any job with
 * an internal transfer or an invoice-linked card purchase (J963: $1,465 vs $710).
 * Both now read this.
 *
 * Signs (v2.3519): the summary is signed cost — a refund at the counter is a
 * negative row — so the net can be below zero on a job whose parts all went
 * back. It is not clamped: a net credit is real and belongs on the job.
 */
import type { CardChargeSummary } from './cardChargeAllocationFilter'

/** job id → card charges that count toward parts (gross counted − invoice-linked; a net refund stays negative). */
export function netCardChargesByJobId(summary: Pick<CardChargeSummary<unknown>, 'chargesByJobId' | 'invoiceLinkedByJobId'>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [jobId, gross] of summary.chargesByJobId) {
    out.set(jobId, gross - (summary.invoiceLinkedByJobId.get(jobId) ?? 0))
  }
  return out
}
