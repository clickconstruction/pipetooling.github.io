/**
 * Payment-chase write path (v2.2572) — the ONE place chase state is mutated.
 * Both chase surfaces (Pipeline's PaymentChaseModal and the Dashboard AR
 * Customers view's call card) go through these helpers so touch semantics
 * (quiet windows, snoozes, promises) can never drift between them.
 */
import { supabase } from '../supabase'
import type { ChaseTouchOutcome } from './paymentChase'

/** Records one chase touch (add_payment_chase_touch). Throws on error. */
export async function addPaymentChaseTouch(args: {
  customerId: string
  jobId: string | null
  outcome: ChaseTouchOutcome
  note?: string | null
  promisedYmd?: string | null
  snoozeDays?: number | null
}): Promise<void> {
  const { error } = await supabase.rpc('add_payment_chase_touch' as never, {
    p_customer_id: args.customerId,
    p_job_id: args.jobId,
    p_outcome: args.outcome,
    p_note: args.note?.trim() || null,
    p_promised_date: args.promisedYmd ?? null,
    p_snooze_days: args.snoozeDays ?? null,
  } as never)
  if (error) throw error
}

/** Sets the customer-promised pay date on one job (set_job_promised_pay_date). Throws on error. */
export async function setJobPromisedPayDate(jobId: string, ymd: string): Promise<void> {
  const { error } = await supabase.rpc('set_job_promised_pay_date' as never, {
    p_job_id: jobId,
    p_date: ymd,
  } as never)
  if (error) throw error
}

/**
 * The promise gesture both surfaces share: stamp the date on every covered
 * job AND record a promised touch per job (the touch is what the queue's
 * broken-promise escalation counts).
 */
export async function recordPromiseForJobs(args: {
  customerId: string
  jobYmds: ReadonlyArray<readonly [jobId: string, ymd: string]>
  note?: string | null
}): Promise<void> {
  for (const [jobId, ymd] of args.jobYmds) {
    await setJobPromisedPayDate(jobId, ymd)
    await addPaymentChaseTouch({
      customerId: args.customerId,
      jobId,
      outcome: 'promised',
      note: args.note,
      promisedYmd: ymd,
    })
  }
}
