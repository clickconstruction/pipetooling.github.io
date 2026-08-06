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
 * already exist.
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
 * Open `link_job_pictures` requests whose job already has a pictures link —
 * i.e. requests that can never auto-close and are safe to retire.
 *
 * `linksByJobId` must only contain jobs whose link was actually READ. A job id
 * absent from the map is treated as unknown and never swept, so a partial or
 * RLS-filtered fetch can't close a request whose link we couldn't see.
 */
export function pickOrphanedPicturesRequestIds(
  rows: readonly PicturesRequestSweepRow[],
  linksByJobId: ReadonlyMap<string, string | null>,
): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (r.status !== 'open') continue
    if (r.pending_action !== 'link_job_pictures') continue
    const jobId = (r.job_ledger_id ?? '').trim()
    if (!jobId) continue
    if (!linksByJobId.has(jobId)) continue
    if ((linksByJobId.get(jobId) ?? '').trim() === '') continue
    out.push(r.id)
  }
  return out
}

/** Job ids worth fetching links for before a sweep (open pictures requests only). */
export function jobIdsForPicturesRequestSweep(
  rows: readonly PicturesRequestSweepRow[],
): string[] {
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.status !== 'open') continue
    if (r.pending_action !== 'link_job_pictures') continue
    const jobId = (r.job_ledger_id ?? '').trim()
    if (jobId) ids.add(jobId)
  }
  return [...ids]
}

/** Audit-trail note stamped on a self-healed request. */
export const PICTURES_REQUEST_SELF_HEAL_NOTE =
  'Customer Pictures URL already set — closed automatically'
