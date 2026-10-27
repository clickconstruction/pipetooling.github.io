/**
 * The two lien-signature inbox lanes (v2.2621, PR 4 of the signing loop):
 * "Awaiting your signature" (releases where I'm the signer) and
 * "Signed — ready to send" (releases I requested, signed, not yet sent).
 * Pure shaping over rows the hook fetches; the section renders both.
 */
import { isJobScopedLienRelease, type JobLienReleaseRow, type JobScopedLienReleaseRow } from './lienReleaseTracking'
import { lienReleaseStatus } from './lienReleaseLifecycle'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type LienInboxJob = {
  id: string
  job_name: string | null
  hcp_number: string | null
  click_number: string | null
  customer_email: string | null
}

/** A row as the hook reads it, its job joined — null on a waiver kept on a bid, which has none. */
export type LienInboxFetchedRow = JobLienReleaseRow & { job: LienInboxJob | null }

/** A lane row: a waiver kept on a job (v2.6002). */
export type LienInboxRow = JobScopedLienReleaseRow & { job: LienInboxJob | null }

export type LienSignatureLanes = {
  /** status awaiting_signature, signer = me, live. Oldest request first. */
  toSign: LienInboxRow[]
  /** status signed, requested by me, unsent, live. Oldest signed first. */
  toSend: LienInboxRow[]
}

export function splitLienSignatureLanes(rows: readonly LienInboxFetchedRow[], userId: string | null): LienSignatureLanes {
  // The lanes are a job's signing loop: asked for, signed, sent to the job's payor. A waiver kept on a bid
  // (v2.5958) is signed at the estimator's screen with the leader's code and goes out from the bid's own
  // Lien Release tab, so it takes no lane here whoever its signer is.
  const live = rows.filter((r): r is LienInboxRow => !r.voided_at && isJobScopedLienRelease(r))
  const toSign = live
    .filter((r) => lienReleaseStatus(r) === 'awaiting_signature' && r.signer_user_id != null && r.signer_user_id === userId)
    .sort((a, b) => String(a.signature_requested_at ?? '').localeCompare(String(b.signature_requested_at ?? '')))
  const toSend = live
    .filter(
      (r) =>
        lienReleaseStatus(r) === 'signed' &&
        !r.sent_to_customer_at &&
        r.signature_requested_by != null &&
        r.signature_requested_by === userId,
    )
    .sort((a, b) => String(a.signed_at ?? '').localeCompare(String(b.signed_at ?? '')))
  return { toSign, toSend }
}

/** "Kent · 1003" style row label. */
export function lienInboxJobLabel(row: LienInboxRow): string {
  const name = (row.job?.job_name ?? '').trim() || 'Job'
  const num = row.job ? effectiveJobLedgerNumber(row.job.hcp_number ?? '', row.job.click_number ?? '') : ''
  return num ? `${name} · ${num}` : name
}
