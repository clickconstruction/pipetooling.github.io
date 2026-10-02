import type { GcReviewRow } from '../gcReviewRollup'

/**
 * GC Review on a phone: an opened GC lists each bill as a short card instead of
 * the six-column table, which ran wider than the screen. The card's link names
 * the job; the line under the address says who and when.
 */
export type GcReviewBillCardWords = {
  /** "650 · ATI Schertz — As per plans": the job number, then its name when it has one. */
  job: string
  /** "Billed Jul 15, 2026 · 79 d", led by the customer when the job's name does not already say it. */
  when: string
}

type CardRow = Pick<GcReviewRow, 'hcp' | 'jobName' | 'customerName' | 'referenceDateDisplay' | 'ageDays'>

export function gcReviewBillCardWords(r: CardRow): GcReviewBillCardWords {
  const job = r.jobName ? `${r.hcp} · ${r.jobName}` : r.hcp
  // The customer is said once: left out when the job's name holds it, or when the job has none ('—').
  const customer = r.customerName.trim()
  const customerShown = customer !== '' && customer !== '—' && !r.jobName.toLowerCase().includes(customer.toLowerCase())
  const dated = r.referenceDateDisplay !== '' && r.referenceDateDisplay !== '—'
  const billed = dated ? `${r.referenceDateDisplay}${r.ageDays != null ? ` · ${r.ageDays} d` : ''}` : null
  const when = customerShown
    ? `${customer} · ${billed ? `billed ${billed}` : 'no bill date'}`
    : billed
      ? `Billed ${billed}`
      : 'No bill date'
  return { job, when }
}
