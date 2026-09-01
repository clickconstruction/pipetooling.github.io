/**
 * Link-vs-create guard for the AR bank-payments modal: when the assistant
 * points a deposit allocation at a billed line whose job already carries a
 * hand-recorded payment of the same amount that no deposit is linked to,
 * the right move is usually to LINK that payment (the "Payment received"
 * allocation kind) — creating a new payment would count the money twice.
 *
 * This kernel only detects the collision; the modal renders the steer and
 * the assistant decides. Candidates come from
 * `list_unlinked_payments_for_bank_payments`, which already returns only
 * payments with no Mercury deposit linked.
 */

export type CollisionPaymentSlice = {
  payment_id: string
  job_id: string
  amount: number | string
  paid_on: string | null
}

const toCents = (v: number | string | null | undefined): number => Math.round(Math.abs(Number(v) || 0) * 100)

/**
 * Unlinked recorded payments on the target's job whose amount equals the
 * allocation to the cent, in the order given. Empty for a non-positive or
 * unparseable allocation amount.
 */
export function findRecordedPaymentCollisions(
  jobId: string,
  allocationAmount: number,
  recordedPayments: CollisionPaymentSlice[],
): CollisionPaymentSlice[] {
  const cents = Number.isFinite(allocationAmount) ? Math.round(allocationAmount * 100) : 0
  if (cents <= 0) return []
  return recordedPayments.filter((p) => p.job_id === jobId && toCents(p.amount) === cents)
}
