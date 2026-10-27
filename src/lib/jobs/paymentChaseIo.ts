/**
 * Payment-chase write path (v2.2572) — the ONE place chase state is mutated.
 * Both chase surfaces (Pipeline's PaymentChaseModal and the Dashboard AR
 * Customers view's call card) go through these helpers so touch semantics
 * (quiet windows, snoozes, promises) can never drift between them.
 */
import { supabase } from '../supabase'
import type { ChaseTouchOutcome } from './paymentChase'
import type { PromiseChannel } from './paymentPromises'
import { formatErrorMessage } from '../../utils/errorHandling'

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

/** Clears the promised pay date on one job; every promise made stays on record. Throws on error. */
export async function clearJobPromisedPayDate(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('set_job_promised_pay_date' as never, { p_job_id: jobId, p_date: null } as never)
  if (error) throw error
}

/** "They never said that": takes one promise off the record (void_job_payment_promise). It is hidden, not deleted. Throws on error. */
export async function voidJobPaymentPromise(promiseId: string): Promise<void> {
  const { error } = await supabase.rpc('void_job_payment_promise' as never, { p_id: promiseId } as never)
  if (error) throw error
}

/** PostgREST's "no such function" — the Their Word migration isn't pushed yet; fall back to the legacy writer. */
function isMissingRpc(e: unknown): boolean {
  const msg = formatErrorMessage(e, '')
  return /could not find the function|PGRST202/i.test(msg)
}

/**
 * Records a promise as an event with who said it and how (add_job_payment_promise,
 * v2.3280) and sets it as the job's current promised date. Falls back to
 * set_job_promised_pay_date (which the v2.3280 trigger still logs, without the
 * source) while the migration is unpushed. Throws on error.
 */
export async function addJobPaymentPromise(args: {
  jobId: string
  ymd: string
  saidBy?: string | null
  channel?: PromiseChannel | null
  note?: string | null
}): Promise<void> {
  try {
    const { error } = await supabase.rpc('add_job_payment_promise' as never, {
      p_job_id: args.jobId,
      p_date: args.ymd,
      p_said_by: args.saidBy?.trim() || null,
      p_channel: args.channel ?? null,
      p_note: args.note?.trim() || null,
    } as never)
    if (error) throw error
  } catch (e) {
    if (!isMissingRpc(e)) throw e
    await setJobPromisedPayDate(args.jobId, args.ymd)
  }
}

const PROMISE_WRITES_AT_ONCE = 4

/**
 * One date on many jobs — GC Review's word, where a GC names a day for
 * everything it owes. The same record "They said…" writes on the Stages
 * board, and like it no chase touch. Never throws: a job that fails is
 * returned so the caller can say which bills the date did not reach.
 */
export async function addJobPaymentPromisesSettled(args: {
  jobIds: readonly string[]
  ymd: string
  saidBy?: string | null
  channel?: PromiseChannel | null
  note?: string | null
}): Promise<{ saved: string[]; failed: string[] }> {
  const saved: string[] = []
  const failed: string[] = []
  for (let i = 0; i < args.jobIds.length; i += PROMISE_WRITES_AT_ONCE) {
    const batch = args.jobIds.slice(i, i + PROMISE_WRITES_AT_ONCE)
    const results = await Promise.allSettled(batch.map((jobId) => addJobPaymentPromise({ jobId, ymd: args.ymd, saidBy: args.saidBy, channel: args.channel, note: args.note })))
    results.forEach((r, n) => (r.status === 'fulfilled' ? saved : failed).push(batch[n]!))
  }
  return { saved, failed }
}

/** A job the promise gesture did not fully reach, and why. */
export type PromiseJobFailure = { jobId: string; why: string }

export type RecordPromiseArgs = {
  customerId: string
  jobYmds: ReadonlyArray<readonly [jobId: string, ymd: string]>
  note?: string | null
  /** Who at the customer named the date ("Dana, their AP"). */
  saidBy?: string | null
  /** How the promise arrived; call mode defaults to a phone call. */
  channel?: PromiseChannel | null
}

/**
 * The promise gesture both surfaces share: record the promise on every covered
 * job — who said it, and how (a call unless told otherwise) — AND record a
 * promised touch per job (the touch is what the queue's broken-promise
 * escalation counts).
 *
 * Settled (punch list #184): every job is written, past one that fails. `failed` holds the jobs
 * whose promise did not save; `untouched` the ones whose date saved but whose chase touch did
 * not, so the caller marks those bills promised and still says the call log is missing. Never throws.
 */
export async function recordPromiseForJobsSettled(args: RecordPromiseArgs): Promise<{ saved: string[]; failed: PromiseJobFailure[]; untouched: PromiseJobFailure[] }> {
  const saved: string[] = []
  const failed: PromiseJobFailure[] = []
  const untouched: PromiseJobFailure[] = []
  for (const [jobId, ymd] of args.jobYmds) {
    try {
      await addJobPaymentPromise({ jobId, ymd, saidBy: args.saidBy, channel: args.channel ?? 'phone', note: args.note })
    } catch (e) {
      failed.push({ jobId, why: formatErrorMessage(e, 'The promise did not save') })
      continue
    }
    saved.push(jobId)
    try {
      await addPaymentChaseTouch({
        customerId: args.customerId,
        jobId,
        outcome: 'promised',
        note: args.note,
        promisedYmd: ymd,
      })
    } catch (e) {
      untouched.push({ jobId, why: formatErrorMessage(e, 'The call log did not save') })
    }
  }
  return { saved, failed, untouched }
}

/**
 * The same gesture for a caller that reads a throw (the Collect desk's outcome writer): every job
 * is still written, then the first job that missed throws, its reason in the message.
 */
export async function recordPromiseForJobs(args: RecordPromiseArgs): Promise<void> {
  const { failed, untouched } = await recordPromiseForJobsSettled(args)
  const missed = [...failed, ...untouched]
  if (missed.length === 0) return
  const total = args.jobYmds.length
  const first = missed[0]!
  throw new Error(total > 1 ? `The promise did not take on ${missed.length} of ${total} jobs. ${first.why}` : first.why)
}
