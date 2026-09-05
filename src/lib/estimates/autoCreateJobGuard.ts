/**
 * Auto-create-job guard (journey-map Tier-1 #9, C76 / J15-F2 / J16-F5) — the pure decision
 * behind "create the job when the estimate is signed" (v2.2743). Dependency-free so the edge
 * function (`_shared/signedAgreementNotify.ts`) and the app tests import it directly; the app
 * twin `src/lib/estimates/autoCreateJobGuard.ts` must stay byte-identical (parity test).
 *
 * Why it exists. v2.2743 deduped only through `jobs_ledger.bid_id`, which no job had ever
 * carried (0 of 815 in prod), while the office re-types most wins by hand: same customer, same
 * name, same dollars. With the switch on, every one of those would have minted a twin job. And
 * a signed change order is applied to a job — never a job of its own.
 *
 * Decision table (first match wins):
 *   switch off                                  → skip  `switch_off`
 *   estimates.job_ledger_id set                 → skip  `already_linked` (via estimate_link)
 *   doc_kind = 'change_order'                   → skip  `change_order` (office applies it)
 *   a job carries this estimate's bid_id        → skip  `already_linked` (via bid_link)
 *   same customer + folded name + value ±1%/±$1,
 *     created within the last 90 days           → skip  `duplicate_by_name_value`
 *   otherwise                                   → create
 *
 * `supabase/migrations/20260905110000_auto_create_job_guard.sql` mirrors the change-order and
 * name+value rules inside `auto_create_job_from_signed_estimate` as the safety net.
 */

export const AUTO_CREATE_TWIN_WINDOW_DAYS = 90
/** A job's revenue "matches" the signed total when within ±1% of it or within ±$1, whichever is wider. */
export const AUTO_CREATE_TWIN_VALUE_PCT = 0.01
export const AUTO_CREATE_TWIN_VALUE_CENTS = 100

export type AutoCreateJobGuardEstimate = {
  id: string
  /** 'estimate' | 'change_order' | 'bid_proposal' */
  docKind: string | null
  jobLedgerId: string | null
  bidId: string | null
  customerId: string | null
  title: string | null
  totalCents: number | null
}

export type AutoCreateJobGuardCandidateJob = {
  id: string
  bidId: string | null
  customerId: string | null
  gcCustomerId: string | null
  jobName: string | null
  /** Dollars (jobs_ledger.revenue). */
  revenue: number | null
  /** ISO timestamp (jobs_ledger.created_at). */
  createdAt: string | null
}

export type AutoCreateJobSkipReason = 'switch_off' | 'already_linked' | 'change_order' | 'duplicate_by_name_value'

export type AutoCreateJobDecision =
  | { create: true; reason: 'no_existing_job'; matchedJobId: null; via: null }
  | { create: false; reason: AutoCreateJobSkipReason; matchedJobId: string | null; via: 'estimate_link' | 'bid_link' | 'name_value' | null }

export type AutoCreateJobGuardInput = {
  estimate: AutoCreateJobGuardEstimate
  candidateJobs: readonly AutoCreateJobGuardCandidateJob[]
  now: Date
  switchOn: boolean
}

/** Case- and whitespace-folded job/estimate name; '' when there is no name to compare. */
export function foldJobName(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** True when a job's revenue (dollars) sits within ±1% or ±$1 of the signed total (cents). */
export function revenueMatchesTotal(revenueDollars: number | null | undefined, totalCents: number | null | undefined): boolean {
  const rev = Number(revenueDollars)
  const total = Number(totalCents)
  if (!Number.isFinite(rev) || !Number.isFinite(total)) return false
  const revCents = Math.round(rev * 100)
  const tolerance = Math.max(AUTO_CREATE_TWIN_VALUE_CENTS, Math.abs(total) * AUTO_CREATE_TWIN_VALUE_PCT)
  return Math.abs(revCents - total) <= tolerance
}

function createdWithinWindow(createdAt: string | null, now: Date): boolean {
  if (!createdAt) return false
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return false
  const windowMs = AUTO_CREATE_TWIN_WINDOW_DAYS * 24 * 60 * 60 * 1000
  return t >= now.getTime() - windowMs && t <= now.getTime() + 60_000
}

function newestFirst(a: AutoCreateJobGuardCandidateJob, b: AutoCreateJobGuardCandidateJob): number {
  return (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0)
}

/** Find a hand-typed twin: same customer, same folded name, matching value, created inside the window. Newest wins. */
export function findNameValueTwin(
  estimate: AutoCreateJobGuardEstimate,
  candidateJobs: readonly AutoCreateJobGuardCandidateJob[],
  now: Date,
): AutoCreateJobGuardCandidateJob | null {
  const name = foldJobName(estimate.title)
  if (!name || !estimate.customerId) return null
  const twins = candidateJobs.filter(
    (j) =>
      (j.customerId === estimate.customerId || j.gcCustomerId === estimate.customerId) &&
      foldJobName(j.jobName) === name &&
      revenueMatchesTotal(j.revenue, estimate.totalCents) &&
      createdWithinWindow(j.createdAt, now),
  )
  return twins.sort(newestFirst)[0] ?? null
}

/** The one decision: should a signed estimate open a job right now, and if not, why not. */
export function decideAutoCreateJob(input: AutoCreateJobGuardInput): AutoCreateJobDecision {
  const { estimate, candidateJobs, now, switchOn } = input
  if (!switchOn) return { create: false, reason: 'switch_off', matchedJobId: estimate.jobLedgerId ?? null, via: estimate.jobLedgerId ? 'estimate_link' : null }
  if (estimate.jobLedgerId) return { create: false, reason: 'already_linked', matchedJobId: estimate.jobLedgerId, via: 'estimate_link' }
  if (estimate.docKind === 'change_order') return { create: false, reason: 'change_order', matchedJobId: null, via: null }
  if (estimate.bidId) {
    const byBid = candidateJobs.filter((j) => j.bidId === estimate.bidId).sort(newestFirst)[0]
    if (byBid) return { create: false, reason: 'already_linked', matchedJobId: byBid.id, via: 'bid_link' }
  }
  const twin = findNameValueTwin(estimate, candidateJobs, now)
  if (twin) return { create: false, reason: 'duplicate_by_name_value', matchedJobId: twin.id, via: 'name_value' }
  return { create: true, reason: 'no_existing_job', matchedJobId: null, via: null }
}
