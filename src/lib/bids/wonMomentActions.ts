/**
 * "Open the job" on every Won moment (journey map Tier-1 #8, J1-F1 / J15-F2/F3/F6).
 *
 * Every place a win gets recorded — the Edit Bid Win/Loss row, the per-GC panel, the board's GC
 * pill, the Waiting-to-hear one-tap — offers the same follow-through, and this kernel is the single
 * place that decides which buttons render for whom. It never reads `bid_versions.outcome`: per-GC
 * Won has zero adoption in prod (J15-N1), so the win is bid-level and the surfaces pass what they
 * already know (has a job / role).
 *
 * The bid ↔ job link is `jobs_ledger.bid_id` (the FK the v2.2741 J#### chip reads); the label
 * helpers below build on that kernel so both surfaces spell the job the same way.
 */
import { bidBoardJobLinkLabel, canSeeBidBoardJobLinks, type BidBoardJobLink } from './bidBoardJobLinks'

/** Window event fired by the job form after a job is inserted with a `bid_id` — bid surfaces refetch on it. */
export const JOB_CREATED_FROM_BID_EVENT = 'job-created-from-bid'
export type JobCreatedFromBidDetail = { bidId: string; jobId: string }

/** Roles that may open the New Job form from a bid. The form's provider is app-level, so the
 * estimator (no /jobs route) still gets it — that is the whole point of the win-moment door. */
const CREATE_JOB_ROLES: ReadonlySet<string> = new Set(['dev', 'master_technician', 'assistant', 'controller', 'estimator'])

export function canCreateJobFromBid(role: string | null | undefined): boolean {
  return role != null && CREATE_JOB_ROLES.has(role)
}

/**
 * Won → Dispatch opens the job (v2.3143). Roles that may mark a bid Won (the
 * `bids` update policy) but have no New Job door: the hand-off to Dispatch is
 * their primary button, and the Edit Bid autosave files it on its own the
 * moment Won lands. Today that is `primary`; superintendents cannot mark Won.
 */
const WON_WITHOUT_JOB_DOOR_ROLES: ReadonlySet<string> = new Set(['primary'])

export type WonHandoffMode = 'button' | 'auto' | 'none'

/** Whether a role hands the win to Dispatch by a quiet button, automatically, or not at all. */
export function wonHandoffMode(role: string | null | undefined): WonHandoffMode {
  if (canCreateJobFromBid(role)) return 'button'
  if (role != null && WON_WITHOUT_JOB_DOOR_ROLES.has(role)) return 'auto'
  return 'none'
}

export type WonMomentActionKey = 'open_existing' | 'create' | 'create_another' | 'ask_dispatch'
export type WonMomentAction = { key: WonMomentActionKey; label: string; primary: boolean }

/**
 * Which buttons a Won moment renders.
 * - a job exists and the role can open Jobs → "Open the job" (primary) + "Create another job" (quiet)
 * - no job yet and the role can create → "Open the job" (primary) + "Ask Dispatch to open it" (quiet, v2.3143)
 * - no job yet and the role can mark Won but not create (primary) → "Ask Dispatch to open the job" (primary)
 * - an open Dispatch to-do already exists (`dispatchAsked`) → no ask button; the caller shows the chip
 * - superintendent (read-only board) / sub / helper → nothing
 */
export function wonMomentActions(args: { hasJob: boolean; role: string | null | undefined; canCreateJobs?: boolean; dispatchAsked?: boolean }): WonMomentAction[] {
  const canCreate = args.canCreateJobs ?? canCreateJobFromBid(args.role)
  const out: WonMomentAction[] = []
  if (args.hasJob && canSeeBidBoardJobLinks(args.role)) out.push({ key: 'open_existing', label: 'Open the job', primary: true })
  if (canCreate) {
    out.push(args.hasJob ? { key: 'create_another', label: 'Create another job', primary: false } : { key: 'create', label: 'Open the job', primary: true })
  }
  if (!args.hasJob && !args.dispatchAsked) {
    // An explicit `canCreateJobs` override wins: true → the quiet hand-off rides along; false → no
    // hand-off either, unless the role is one that hands off automatically anyway.
    const roleMode = wonHandoffMode(args.role)
    const mode: WonHandoffMode = args.canCreateJobs === undefined ? roleMode : args.canCreateJobs ? 'button' : roleMode === 'auto' ? 'auto' : 'none'
    if (mode === 'button') out.push({ key: 'ask_dispatch', label: 'Ask Dispatch to open it', primary: false })
    else if (mode === 'auto') out.push({ key: 'ask_dispatch', label: 'Ask Dispatch to open the job', primary: true })
  }
  return out
}

/** "J1007 opened from this bid" — the chip text on the bid; "No job yet from this bid" when none. */
export function bidJobLinkLabel(job: Pick<BidBoardJobLink, 'hcpNumber'> | null | undefined): string {
  if (!job) return 'No job yet from this bid'
  return `${bidBoardJobLinkLabel(job.hcpNumber)} opened from this bid`
}

/** Body of the second-conversion warning ("A job already exists from this bid"). */
export function secondConversionMessage(existing: ReadonlyArray<Pick<BidBoardJobLink, 'hcpNumber'>>, bidLabel: string): string {
  const labels = existing.map((j) => bidBoardJobLinkLabel(j.hcpNumber))
  const who = labels.length === 1 ? `${labels[0]} was` : `${labels.join(', ')} were`
  return `${who} already opened from ${bidLabel}. Open it from the bid's Job block, or create another job here.`
}

/**
 * `ui_nav_clicks.target` for the `job_created` telemetry row (the job's birth is unloggable in
 * `job_activity_events` without a migration — see the v2 docs fragment). Source first so the
 * "how many jobs come from bids" ratio the journey map measures is one GROUP BY.
 */
export function jobCreatedTelemetryTarget(args: { bidId: string | null | undefined; projectId: string | null | undefined }): string {
  const bid = (args.bidId ?? '').trim()
  if (bid) return `source:bid:${bid}`
  if ((args.projectId ?? '').trim()) return 'source:project'
  return 'source:blank'
}
