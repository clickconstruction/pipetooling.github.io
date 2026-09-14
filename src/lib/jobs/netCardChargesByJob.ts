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
 */
import type { CardChargeSummary } from './cardChargeAllocationFilter'

/** job id → card charges that count toward parts (gross counted − invoice-linked, clamped at 0). */
export function netCardChargesByJobId(summary: Pick<CardChargeSummary<unknown>, 'chargesByJobId' | 'invoiceLinkedByJobId'>): Map<string, number> {
  const out = new Map<string, number>()
  for (const [jobId, gross] of summary.chargesByJobId) {
    const linked = Math.min(gross, summary.invoiceLinkedByJobId.get(jobId) ?? 0)
    out.set(jobId, gross - linked)
  }
  return out
}
