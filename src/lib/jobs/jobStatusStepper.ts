/**
 * Edit-tab status stepper (v2.1773): which one-tap moves the strip offers,
 * mirroring the update_job_status RPC's adjacency rules exactly — the RPC is
 * the enforcement, this map just disables pills up front with an honest
 * reason instead of letting taps bounce off server errors. Pure — no React.
 */

export type JobStepperStatus = 'waiting' | 'working' | 'ready_to_bill' | 'billed' | 'paid'

export const JOB_STEPPER_ORDER: readonly JobStepperStatus[] = ['waiting', 'working', 'ready_to_bill', 'billed', 'paid']

export const JOB_STEPPER_LABELS: Record<JobStepperStatus, string> = {
  waiting: 'Waiting',
  working: 'Working',
  ready_to_bill: 'Ready to bill',
  billed: 'Billed',
  paid: 'Paid',
}

/**
 * Null = the move is offered (one tap). A string = disabled, with the reason
 * shown as the pill's tooltip. Notes:
 * - billed → ready_to_bill is legal for the RPC but deliberately board-only
 *   here: the board's Send back first voids the billed (Stripe) invoices;
 *   a raw status flip would leave live Stripe invoices on an unbilled job.
 * - billed → paid is offered, but the component routes it through the
 *   Record payment window (mark_job_paid rules), never a raw flip.
 */
export function jobStepperMoveDisabledReason(from: JobStepperStatus, to: JobStepperStatus): string | null {
  if (from === to) return 'This is the current stage'
  switch (to) {
    case 'waiting':
      return from === 'working' ? null : 'Only a Working job can be sent back to Waiting'
    case 'working':
      return from === 'waiting' || from === 'ready_to_bill' ? null : from === 'billed' || from === 'paid' ? 'Send the job back from the Pipeline board first — billed invoices have to be handled' : null
    case 'ready_to_bill':
      if (from === 'working') return null
      if (from === 'billed') return "Use the Pipeline board's Send back — it first voids the billed (Stripe) invoices"
      return 'Move the job to Working first'
    case 'billed':
      if (from === 'ready_to_bill' || from === 'paid') return null
      return 'Mark the job Ready to bill first'
    case 'paid':
      return from === 'billed' ? null : 'Bill the job first — Paid comes from Billed'
  }
}

/**
 * True when flipping to Billed would mint a "no bill line" shell worth
 * pausing on: open money with no billed invoice line means the balance can't
 * age, be chased, or be forecast (v2.1931's cohort — this guard stops new
 * ones at the source).
 */
export function billedMoveNeedsShellGuard(input: {
  to: JobStepperStatus
  openAmount: number
  hasBilledLine: boolean
}): boolean {
  return input.to === 'billed' && !input.hasBilledLine && input.openAmount > 0
}
