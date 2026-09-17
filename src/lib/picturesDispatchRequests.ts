/**
 * Pure kernels for the "add a Customer Pictures folder" dispatch request
 * (`dispatch_requests.pending_action = 'link_job_pictures'`).
 *
 * Why the guard exists: the request's only auto-close lives in
 * `JobFormModal.persistIdentitySlice` and fires on a blank→set TRANSITION of
 * `jobs_ledger.job_pictures_link`. A request filed against a job that already
 * has a link can therefore never auto-close — the link never goes blank, so
 * the transition never happens, and the row sits open until someone closes it
 * by hand. (That is exactly what happened to the Office / HCP 000 job: a
 * second request on 2026-08-04 against a link set 2026-07-22.)
 *
 * So: never create one for an already-linked job, and retire the ones that
 * already exist. The `add_job_phone` request (the red phone on Dashboard job cards) has the
 * same shape against `customer_phone`, so the sweep below covers both (v2.3567).
 */

export type PicturesDispatchRequestAction = 'create' | 'already-open' | 'already-linked'

export type PicturesDispatchRequestDecision = {
  action: PicturesDispatchRequestAction
  /** User-facing toast copy. */
  message: string
  /**
   * An open request that is now provably redundant (the job has a link) and
   * should be closed as part of handling this decision. Null otherwise.
   */
  orphanedRequestIdToClose: string | null
}

const ALREADY_OPEN_MESSAGE =
  'Note already sent to dispatch to add a photos link, if you need it sooner call dispatch!'
const CREATED_MESSAGE =
  'Note sent to dispatch to add a photos link, if you need it sooner call dispatch!'
const ALREADY_LINKED_MESSAGE =
  'This job already has a Customer Pictures link — no need to ask Dispatch. Pull to refresh if you still see the red icon.'

export const PICTURES_DISPATCH_REQUEST_MESSAGES = {
  alreadyOpen: ALREADY_OPEN_MESSAGE,
  created: CREATED_MESSAGE,
  alreadyLinked: ALREADY_LINKED_MESSAGE,
} as const

/**
 * Decide what to do when someone taps the red "ask Dispatch for photos" button.
 *
 * `already-linked` wins over `already-open`: when both are true the row is the
 * unclosable orphan, and reporting the link (plus closing the stale request) is
 * both more truthful and self-healing. Blank/whitespace links count as absent.
 */
export function decidePicturesDispatchRequest(input: {
  jobPicturesLink: string | null | undefined
  existingOpenRequestId: string | null | undefined
}): PicturesDispatchRequestDecision {
  const linked = (input.jobPicturesLink ?? '').trim() !== ''
  const openId = (input.existingOpenRequestId ?? '').trim() || null

  if (linked) {
    return {
      action: 'already-linked',
      message: ALREADY_LINKED_MESSAGE,
      orphanedRequestIdToClose: openId,
    }
  }
  if (openId) {
    return {
      action: 'already-open',
      message: ALREADY_OPEN_MESSAGE,
      orphanedRequestIdToClose: null,
    }
  }
  return { action: 'create', message: CREATED_MESSAGE, orphanedRequestIdToClose: null }
}

/** Minimal shape the sweep needs from a loaded dispatch-inbox row. */
export type PicturesRequestSweepRow = {
  id: string
  status: string | null
  pending_action: string | null
  job_ledger_id: string | null
}

/**
 * The two self-healing request kinds (v2.3567 adds the phone). Each is the same shape: the
 * request asks Dispatch to fill one `jobs_ledger` column, its only auto-close fires on a
 * blank→set transition of that column in `JobFormModal`, so a request filed against a job
 * whose column is already set can never close on its own.
 */
export type SelfHealingRequestAction = 'link_job_pictures' | 'add_job_phone'

export const SELF_HEALING_REQUESTS: ReadonlyArray<{
  action: SelfHealingRequestAction
  /** The `jobs_ledger` column the request asks Dispatch to fill. */
  column: 'job_pictures_link' | 'customer_phone'
  /** Audit-trail note stamped on a self-healed request. */
  note: string
}> = [
  { action: 'link_job_pictures', column: 'job_pictures_link', note: 'Customer Pictures URL already set — closed automatically' },
  { action: 'add_job_phone', column: 'customer_phone', note: 'Customer phone already set — closed automatically' },
]

/**
 * Open requests of one kind whose job already has the column set — i.e. requests that can
 * never auto-close and are safe to retire.
 *
 * `valuesByJobId` must only contain jobs whose column was actually READ. A job id absent
 * from the map is treated as unknown and never swept, so a partial or RLS-filtered fetch
 * can't close a request whose value we couldn't see.
 */
export function pickOrphanedRequestIds(
  rows: readonly PicturesRequestSweepRow[],
  valuesByJobId: ReadonlyMap<string, string | null>,
  action: SelfHealingRequestAction,
): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (r.status !== 'open') continue
    if (r.pending_action !== action) continue
    const jobId = (r.job_ledger_id ?? '').trim()
    if (!jobId) continue
    if (!valuesByJobId.has(jobId)) continue
    if ((valuesByJobId.get(jobId) ?? '').trim() === '') continue
    out.push(r.id)
  }
  return out
}

/** Job ids worth fetching before a sweep (open requests of the given kind only). */
export function jobIdsForRequestSweep(
  rows: readonly PicturesRequestSweepRow[],
  action: SelfHealingRequestAction,
): string[] {
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.status !== 'open') continue
    if (r.pending_action !== action) continue
    const jobId = (r.job_ledger_id ?? '').trim()
    if (jobId) ids.add(jobId)
  }
  return [...ids]
}

/** The pictures-only readers, kept for their call sites and tests. */
export function pickOrphanedPicturesRequestIds(
  rows: readonly PicturesRequestSweepRow[],
  linksByJobId: ReadonlyMap<string, string | null>,
): string[] {
  return pickOrphanedRequestIds(rows, linksByJobId, 'link_job_pictures')
}

export function jobIdsForPicturesRequestSweep(rows: readonly PicturesRequestSweepRow[]): string[] {
  return jobIdsForRequestSweep(rows, 'link_job_pictures')
}

/** Audit-trail note stamped on a self-healed pictures request. */
export const PICTURES_REQUEST_SELF_HEAL_NOTE = SELF_HEALING_REQUESTS[0]!.note
