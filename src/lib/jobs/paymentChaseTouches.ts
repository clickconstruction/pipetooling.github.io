/**
 * The Payment Chase touches as a kernel reads them (v2.5881): the two day rules, the touch and the defensive parse of
 * `list_payment_chase_touches`. In a file that imports nothing, so the Bridge's Collect kernels and the weekly sheet's
 * reads take them on the edge without `paymentChase.ts`'s queue; that file re-exports them for its readers.
 */
/** A promise this many days past its date, still unpaid, re-enters the queue. */
export const BROKEN_PROMISE_GRACE_DAYS = 7

/** Any touch keeps the customer out of the queue this long — no re-nagging tomorrow. */
export const TOUCH_QUIET_DAYS = 3

export type ChaseTouchOutcome = 'promised' | 'cant_reach' | 'resend' | 'dispute' | 'note'

export type ChaseTouch = {
  id: string
  customerId: string
  jobId: string | null
  outcome: ChaseTouchOutcome
  note: string | null
  promisedYmd: string | null
  snoozeDays: number | null
  resolvedAt: string | null
  createdAt: string
  createdByName: string
}

const OUTCOMES: ReadonlySet<string> = new Set(['promised', 'cant_reach', 'resend', 'dispute', 'note'])

/** Defensive parse of list_payment_chase_touches (null on gate-refused / malformed). */
export function parseChaseTouchesRpc(raw: unknown): ChaseTouch[] | null {
  if (!Array.isArray(raw)) return null
  const out: ChaseTouch[] = []
  for (const v of raw) {
    if (v == null || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    if (typeof r.id !== 'string' || typeof r.customerId !== 'string') continue
    if (typeof r.outcome !== 'string' || !OUTCOMES.has(r.outcome)) continue
    if (typeof r.createdAt !== 'string') continue
    out.push({
      id: r.id,
      customerId: r.customerId,
      jobId: typeof r.jobId === 'string' ? r.jobId : null,
      outcome: r.outcome as ChaseTouchOutcome,
      note: typeof r.note === 'string' && r.note.trim() ? r.note : null,
      promisedYmd: typeof r.promisedYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.promisedYmd) ? r.promisedYmd : null,
      snoozeDays: typeof r.snoozeDays === 'number' && Number.isFinite(r.snoozeDays) ? Math.round(r.snoozeDays) : null,
      resolvedAt: typeof r.resolvedAt === 'string' ? r.resolvedAt : null,
      createdAt: r.createdAt,
      createdByName: typeof r.createdByName === 'string' && r.createdByName.trim() ? r.createdByName : 'office',
    })
  }
  return out
}
