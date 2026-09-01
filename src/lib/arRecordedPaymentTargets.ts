/**
 * AR modal (v2.1191): "Payment received" allocation targets — recorded
 * jobs_ledger_payments rows (Edit Job → Payments received) that can be LINKED
 * to a Mercury deposit instead of creating a new payment. Rows come from the
 * list_unlinked_payments_for_bank_payments RPC; these helpers shape them for
 * the allocation line's SearchableSelect.
 */

export type ArRecordedPaymentCandidate = {
  payment_id: string
  job_id: string
  amount: number
  paid_on: string | null
  note: string | null
  payment_type: string | null
  reference_number: string | null
  invoice_id: string | null
  hcp_number: string | null
  click_number: string | null
  job_name: string | null
  /** v2.1614: the payment's invoice was Stripe-hosted — linking requires the out-of-band confirmation. */
  stripe_hosted?: boolean
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Displayed job number — HCP wins over Click, same precedence as effectiveJobLedgerNumber. */
export function arRecordedPaymentJobNumber(c: Pick<ArRecordedPaymentCandidate, 'hcp_number' | 'click_number'>): string {
  return (c.hcp_number ?? '').trim() || (c.click_number ?? '').trim()
}

/** One-line search label: "#941 Berg AirBnb — check $2,500.00 · 2026-07-22 · chk 1042". */
export function arRecordedPaymentSearchLabel(c: ArRecordedPaymentCandidate): string {
  const num = arRecordedPaymentJobNumber(c)
  const name = (c.job_name ?? '').trim()
  const head = [num ? `#${num}` : '', name].filter(Boolean).join(' ') || 'Job'
  const type = (c.payment_type ?? '').trim()
  const amount = money(Math.abs(Number(c.amount) || 0))
  const detail = [
    [type, amount].filter(Boolean).join(' '),
    (c.paid_on ?? '').trim(),
    (c.note ?? '').trim() || (c.reference_number ?? '').trim(),
    c.stripe_hosted ? 'Stripe bill' : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return detail ? `${head} — ${detail}` : head
}

/**
 * SearchableSelect options for one allocation line: all candidates except those
 * already chosen on OTHER lines (so two lines can't link the same payment).
 */
export function arRecordedPaymentOptions(
  candidates: ArRecordedPaymentCandidate[],
  takenPaymentIds: ReadonlySet<string>,
): Array<{ value: string; label: string }> {
  return candidates
    .filter((c) => !takenPaymentIds.has(c.payment_id))
    .map((c) => ({ value: c.payment_id, label: arRecordedPaymentSearchLabel(c) }))
}

/** Locked amount string for a linked-payment allocation line (whole-row link). */
export function arRecordedPaymentAmountStr(c: Pick<ArRecordedPaymentCandidate, 'amount'>): string {
  return (Math.abs(Number(c.amount) || 0)).toFixed(2)
}

/**
 * v2.2597: the billed-line search dead-ends at "No matches" when a job's line
 * is fully covered by an already-recorded payment (Mark Paid before the bank
 * deposit was allocated — Taunya, J989: job sent back to Billed, invoice paid,
 * $250 check recorded, nothing left for the billed-line picker to show). The
 * recorded payments the same query WOULD match, so the no-matches action can
 * steer the line to the Payment-received kind. Mirrors SearchableSelect's
 * filter exactly: case-insensitive substring on the option label.
 */
export function arRecordedPaymentMatchesForQuery(
  candidates: ArRecordedPaymentCandidate[],
  takenPaymentIds: ReadonlySet<string>,
  query: string,
): ArRecordedPaymentCandidate[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return candidates.filter(
    (c) => !takenPaymentIds.has(c.payment_id) && arRecordedPaymentSearchLabel(c).toLowerCase().includes(q),
  )
}
