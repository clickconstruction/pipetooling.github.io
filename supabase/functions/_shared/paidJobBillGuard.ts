/**
 * "Never bill a paid job twice" guard — the one predicate every Bill Customer
 * channel consults before it turns a Ready to Bill draft into a real bill.
 *
 * Journey-map J3-1 / N2 (2026-09-05): the Dashboard listed never-sent drafts
 * on Paid-in-Full jobs with live Bill Customer buttons, and nothing at any
 * layer — modal, `create-stripe-invoice`, `send-physical-invoice-email`, the
 * HouseCall Pro record path — read the JOB's status. Every check keyed on the
 * INVOICE status alone, which a stale draft satisfies. One click could send a
 * real Stripe invoice to a customer who had already paid in full.
 *
 * The rule (Will's decision 6): an open bill is defined by invoice status — a
 * billed, unpaid invoice is owed regardless of job stage — but a bill on a
 * **paid** job is the exception. It is refused unless the caller says
 * `allow_rebill: true` (the legitimate "bill this job again" case, ticked
 * explicitly in the modal).
 *
 * No imports: this file is shared verbatim between the Deno edge functions and
 * the Vite app (`src/` imports it directly, like the other `_shared` kernels),
 * and its tests run under vitest.
 */

export const PAID_JOB_BILL_BLOCKED_MESSAGE = 'This job is already paid in full — nothing to bill.'

/** `job_activity_events.event_type` written when a channel refuses. */
export const PAID_JOB_BILL_BLOCKED_EVENT_TYPE = 'rtb_paid_job_blocked'

export type PaidJobBillGuardInput = {
  /** `jobs_ledger.status` of the invoice's parent job (null/undefined = unknown → not blocked). */
  jobStatus: string | null | undefined
  /** Explicit re-bill request from the caller (`allow_rebill: true`). */
  allowRebill?: boolean | null | undefined
}

/** True when the job is Paid in Full (the only status this guard cares about). */
export function isPaidJobStatus(jobStatus: string | null | undefined): boolean {
  return jobStatus === 'paid'
}

/**
 * True when billing must be refused: the job is `paid` and the caller did not
 * ask to re-bill. Unknown job status never blocks — the existing invoice-status
 * checks still run and this guard only adds a stop, never removes one.
 */
export function shouldBlockBillOnPaidJob(input: PaidJobBillGuardInput): boolean {
  if (!isPaidJobStatus(input.jobStatus)) return false
  return input.allowRebill !== true
}

/** Reads the request-body flag strictly: only the boolean `true` counts. */
export function allowRebillFromBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false
  return (body as { allow_rebill?: unknown }).allow_rebill === true
}

export type PaidJobBillBlockedChannel = 'stripe' | 'physical' | 'housecallpro'

/** Minimal structural client so this file needs no supabase-js import. */
export type PaidJobBillBlockedEventClient = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>
  }
}

/** The `job_activity_events` row a refusal writes (pure — so it can be tested). */
export function buildPaidJobBillBlockedEventRow(args: {
  jobId: string
  invoiceId: string | null
  actorUserId: string | null
  channel: PaidJobBillBlockedChannel
  occurredAt?: string
}): Record<string, unknown> {
  const occurredAt = args.occurredAt ?? new Date().toISOString()
  const channelLabel =
    args.channel === 'stripe' ? 'Stripe bill' : args.channel === 'physical' ? 'Physical invoice email' : 'HouseCall Pro record'
  return {
    job_id: args.jobId,
    event_type: PAID_JOB_BILL_BLOCKED_EVENT_TYPE,
    occurred_at: occurredAt,
    actor_user_id: args.actorUserId,
    summary: `${channelLabel} refused — job is already paid in full`,
    detail: {
      source_id: `${args.invoiceId ?? args.jobId}:${occurredAt}`,
      invoice_id: args.invoiceId,
      channel: args.channel,
      job_status: 'paid',
    },
    financial: true,
  }
}

/**
 * Best-effort audit row. Never throws and never fails the request — the refusal
 * response is already the user-facing outcome; this is the trail behind it.
 * `job_activity_events` has no client write policy, so callers pass a
 * service-role client.
 */
export async function logPaidJobBillBlockedBestEffort(
  admin: PaidJobBillBlockedEventClient | null | undefined,
  args: { jobId: string; invoiceId: string | null; actorUserId: string | null; channel: PaidJobBillBlockedChannel },
): Promise<void> {
  if (!admin) return
  try {
    const { error } = await admin.from('job_activity_events').insert(buildPaidJobBillBlockedEventRow(args))
    if (error) console.warn('paidJobBillGuard: rtb_paid_job_blocked event insert failed', error)
  } catch (e) {
    console.warn('paidJobBillGuard: rtb_paid_job_blocked event insert threw', e)
  }
}
