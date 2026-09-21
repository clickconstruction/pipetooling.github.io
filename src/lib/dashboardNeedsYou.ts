import type { UserRole } from '../hooks/useAuth'
import type { SubmittalNudge } from './submittals/submittalNeedsYou'
import { describeBacklogAge } from './bids/robotBacklog'
import { formatLostBidNudgeValue, type LostBidNudge } from './dashboardLostBidNudge'
import { withScopeLabel } from './bids/bidSentCounts'
import { jobFollowupBreakdownPhrase, type JobFollowupStage } from './jobs/jobFollowupQueue'
import type { RoadmapNudge } from './dashboardRoadmapNudge'
import { gcReviewGcsToDo, type GcReviewNudgeState } from './jobs/gcReviewCertification'
import type { GcReviewWeekStatus } from './gcReviewCertifications'
import type { BulkDeleteAlert } from '../hooks/useBulkDeleteAlerts'
import { formatDispatchNoteDaysAgoShortPhrase } from '../utils/dispatchNoteDisplay'
import type { RobotLockedShadow } from './bids/robotLockedShadows'
import { describeNoticeMonths } from './jobs/lienNoticeDraft'

/**
 * Needs You card (v2.2339, CX-audit Phase 3): the pure item builder behind the
 * dashboard's unified attention list. v1 consolidated the four hook-driven
 * banners (AR deposits, own stale tally, team stale tally, lost-bid reasons);
 * the self-gating banners fold in item-by-item — job follow-ups joined in
 * v2.2487, team reviews in v2.2488, roadmap needs-name in v2.2489, GC weekly
 * in v2.2490 (its green "done" state stays a notice below the card),
 * bulk-delete in v2.2491 (red severity + secondary snooze/dismiss actions),
 * claim-dev in v2.2492 — the migration is complete: every attention banner
 * now lives in this one list (GC weekly's green "done" notice excepted).
 *
 * Gating mirrors the banners it replaces exactly: an item appears only when its
 * banner would have rendered. Order is worst-first (v2.2493): items sort by
 * NEEDS_YOU_RANK tier, then biggest figure first within a tier (ties keep
 * build order) — see the rank table for what "worst" means here.
 */

/** red (v2.2491) = a destructive event to investigate, not a work queue — loudest rail in the card. */
import type { LienDeskNeedsYou } from './jobs/lienDesk'
import type { CapacityUnderStreak } from './jobs/jobSummaryCapacity'
import { daysBetweenYmd } from './jobs/billedExpectedPay'
import { todayYmdInAppTz } from '../utils/dateUtils'

/** Whole days from today (the company calendar) to a 'YYYY-MM-DD' — the Lien desk cards' urgency. */
function daysUntilYmd(ymd: string): number | null {
  return daysBetweenYmd(todayYmdInAppTz(), ymd)
}

/** "Aug 24" for a 'YYYY-MM-DD' — the capacity card's week names (pure; no calendar-zone shift on a plain date). */
function monthDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export type NeedsYouSeverity = 'blue' | 'amber' | 'gray' | 'red'

/**
 * Which product an item belongs to (journey-map Tier-2 #41). `company` is the
 * default — the office's worst-first stack. `roadmap` is the owner's planning
 * work (the "N roadmap tasks need a person" card): it never shows to a non-dev
 * viewer, and for the dev it groups AFTER the company stack instead of ranking
 * inside it at tier 50 — personal-farm planning was sitting between lien
 * deadlines and team reviews.
 */
export type NeedsYouKind = 'company' | 'roadmap'

export type NeedsYouItem = {
  /** Stable key — also the telemetry target (`#<key>`) and the action-dispatch handle. */
  key:
    | 'ar-deposits'
    | 'tally-self'
    | 'tally-team'
    | 'lost-bids'
    | 'team-reviews'
    | 'statement-round'
    | 'roadmap-needs-person'
    | 'job-followups'
    | 'gc-review-weekly'
    | 'bulk-delete'
    | 'claim-dev'
    | 'robot-audits'
    | 'robot-locked'
    | 'lien-unconditional'
    | 'demand-deadline'
    | 'lien-serve-copy'
    | 'lien-window-missed'
    | 'lien-notice-draft'
    | 'lien-notice-approve'
    | 'lien-notice-batch'
    | 'lien-file-window'
    | 'd22-uncoded'
    | 'hours-approvals'
    | 'label-approvals'
    | 'contract-missing'
    | 'contract-stale'
    | 'work-orders-unpriced'
    | 'jobs-stale-open'
    | 'capacity-under'
    | 'dispatch-requests-aged'
    | 'hr-reports-pending'
    | 'job-account-missing'
    | 'customer-waiting'
    | 'price-matrix-ready'
    | 'price-requests-late'
    | 'robot-backlog'
    | 'test-reports-ready'
    | 'legal-review'
    | 'legal-firm-activity'
    | 'submittal-not-started'
    | 'submittal-unopened'
    | 'submittal-sent-back'
    | 'submittal-lead-time'
  severity: NeedsYouSeverity
  /** Product the item belongs to — omitted means `company`. See `NeedsYouKind`. */
  kind?: NeedsYouKind
  /** Walk-mode eyebrow. */
  kicker: string
  title: string
  detail: string
  /** Right-aligned figure in cards mode (count or $), shown big in walk mode. */
  figure: string
  actionLabel: string
  /** Small link-style follow-ups (v2.2491) — e.g. snooze/dismiss on alert items. Parent dispatches by key. */
  secondary?: Array<{ key: string; label: string }>
  /**
   * The number the destination will show when this card opens it (v2.2896,
   * journey-map Tier-2 #16), when the destination counts a wider pile than the
   * card — e.g. the tally card's "100 over 2 days" opens a page saying "105
   * unlinked". Recorded on the click (`needsYouClickTarget`) so the two can be
   * audited against each other; omitted when card and destination say the same
   * number by construction.
   */
  destinationFigure?: string
}

/**
 * Worst-first tiers (v2.2493). Lower = worse = higher in the card and first in
 * Walk the list. The tiers, in words: destructive/security events, then money
 * already received but not applied, then the hard weekly deadline, then
 * billing accuracy, then revenue chasing, then people/planning, then hygiene.
 * Items sharing a tier sort by figure (biggest pile first), ties keep build
 * order. New items MUST pick a tier here — the type makes forgetting a
 * compile error.
 */
export const NEEDS_YOU_RANK: Record<NeedsYouItem['key'], number> = {
  'bulk-delete': 0,
  'claim-dev': 0,
  'customer-waiting': 0,
  'ar-deposits': 10,
  'lien-unconditional': 20,
  'gc-review-weekly': 20,
  'tally-self': 30,
  'tally-team': 30,
  'job-followups': 40,
  'demand-deadline': 40,
  'lien-serve-copy': 10,
  'lien-window-missed': 10,
  'lien-notice-draft': 40,
  'lien-notice-approve': 40,
  'lien-notice-batch': 40,
  'lien-file-window': 40,
  'team-reviews': 50,
  'statement-round': 30,
  'roadmap-needs-person': 50,
  'robot-audits': 50,
  'robot-locked': 50,
  'hours-approvals': 50,
  'label-approvals': 40,
  'contract-missing': 40,
  'contract-stale': 50,
  'work-orders-unpriced': 40,
  'jobs-stale-open': 40,
  // People/planning tier: a crew running light for three weeks is a scheduling question, not a bill.
  'capacity-under': 50,
  'dispatch-requests-aged': 40,
  'hr-reports-pending': 50,
  'lost-bids': 60,
  'd22-uncoded': 60,
  'job-account-missing': 60,
  'price-matrix-ready': 40,
  // Revenue chasing tier: a request past its date is a bid that cannot be priced on time.
  'price-requests-late': 40,
  'robot-backlog': 60,
  'legal-review': 40,
  'legal-firm-activity': 20,
  // Revenue chasing tier: a test report is what the GC pays against.
  'test-reports-ready': 40,
  'submittal-lead-time': 30,
  'submittal-sent-back': 40,
  'submittal-unopened': 40,
  'submittal-not-started': 50,
}

/** "99+" reads as 100 so a capped figure still outranks anything two-digit. */
function figureValue(figure: string): number {
  const n = Number.parseInt(figure.replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(n)) return 0
  return figure.endsWith('+') ? n + 1 : n
}

/** An item's product; `company` unless it says otherwise. */
export function needsYouKind(item: Pick<NeedsYouItem, 'kind'>): NeedsYouKind {
  return item.kind ?? 'company'
}

const KIND_ORDER: Record<NeedsYouKind, number> = { company: 0, roadmap: 1 }

/**
 * Stable worst-first sort — exported so surfaces that build items elsewhere can
 * reuse it. Company items first (by tier, then biggest figure); roadmap items
 * follow as their own group, ranked the same way among themselves (Tier-2 #41).
 */
export function rankNeedsYouItems(items: NeedsYouItem[]): NeedsYouItem[] {
  // Array.prototype.sort is stable, so equal (kind, rank, figure) triples keep build order.
  return [...items].sort((a, b) => {
    const kind = KIND_ORDER[needsYouKind(a)] - KIND_ORDER[needsYouKind(b)]
    if (kind !== 0) return kind
    const rank = NEEDS_YOU_RANK[a.key] - NEEDS_YOU_RANK[b.key]
    if (rank !== 0) return rank
    return figureValue(b.figure) - figureValue(a.figure)
  })
}

/**
 * The items a viewer may see (Tier-2 #41): roadmap-kind items are the owner's
 * (dev) — everyone else's stack is company work only. Applied inside
 * `buildNeedsYouItems`, so a hook that forgets its own gate still cannot put a
 * roadmap card on an office dashboard.
 */
export function visibleNeedsYouItems(items: NeedsYouItem[], role: UserRole | null | undefined): NeedsYouItem[] {
  if (role === 'dev') return items
  return items.filter((i) => needsYouKind(i) !== 'roadmap')
}

export type NeedsYouInputs = {
  role: UserRole | null
  /** null while loading — a loading source contributes no item (same as the banners). */
  arBankUnallocatedCount: number | null
  arBankEnabled: boolean
  tallyStaleUnlinkedCount: number | null
  /** Every unlinked row (no age filter) — what `/tally` will say on open (v2.2896). Null while loading. */
  tallyUnlinkedCount?: number | null
  tallyStaffStalePeopleCount: number | null
  tallyStaffStaleTxCount: number | null
  tallyStaffEligible: boolean
  tallyMinAgeDays: number
  lostBidNudge: LostBidNudge | null
  lostBidNudgeLoading: boolean
  /**
   * Team reviews overdue for the signed-in reviewer (v2.2488). The hook
   * self-gates (empty without Team access), so no enabled flag here.
   */
  teamReviewsOverdue: Array<{ id: string; name: string }>
  teamReviewCadenceDays: number
  /**
   * Roadmap "needs a person" nudges (v2.2489). The hook self-gates (empty
   * unless `canSeeRoadmapNeedsYou` — dev, not Farm Mode — or under the
   * min-count threshold); the builder drops the item for non-dev roles anyway
   * (`kind: 'roadmap'`, Tier-2 #41).
   */
  roadmapNudges: RoadmapNudge[]
  /**
   * Job Follow-Up Mode queue (v2.2487). Quickfill passes enabled=false — its
   * dedicated Job follow-ups station already carries this count.
   */
  jobFollowupsEnabled: boolean
  /**
   * Open jobs idle 21+ days (v2.2825) — the Job Summary Cycle view's stale-open
   * list. `mine` = jobs whose lead tech is the signed-in user, so the card
   * names a person. Null while loading; the hook reports zero on error.
   */
  staleOpenEnabled?: boolean
  staleOpen?: { count: number; total: number; mine: number; minIdleDays: number } | null
  /**
   * Field capacity under 60% three complete weeks running (Job Summary
   * follow-up 3) — `capacityUnderStreak` over the Capacity view's kernel for
   * the three weeks before this one. Null while loading, when three weeks
   * cannot be rated, or when any week cleared the line. Office set.
   */
  capacityUnderEnabled?: boolean
  capacityUnder?: CapacityUnderStreak | null
  /** Contract Desk (PR 4): jobs with no agreement on file + sent contracts gone quiet. */
  contractNudgeEnabled?: boolean
  contractNudge?: { missing: { count: number; revenueTotal: number }; stale: { count: number; oldestDays: number | null } } | null
  /**
   * Sub work-order drafts saved without a price (Work Orders tab PR 3,
   * v2.2829) — an assistant drafted them while taking the job in; the master
   * prices and sends. Null = nothing waiting / loading. Action opens Jobs →
   * Work Orders on the Drafts filter.
   */
  unpricedWorkOrdersEnabled?: boolean
  unpricedWorkOrders?: { count: number; subNames: string[]; oldestDays: number | null } | null
  jobFollowupCount: number | null
  jobFollowupStageCounts: Record<JobFollowupStage, number> | null
  /**
   * Wednesday GC certification (v2.2490). Only the 'due' state becomes an
   * item; 'done' renders as a green notice outside the card. Quickfill passes
   * enabled=false — its dedicated GC weekly station already carries this.
   */
  gcReviewEnabled: boolean
  /**
   * The signed-in sender's personal statement round (v2.2771): certified GCs
   * assigned to them and not yet marked sent. Null = nothing waiting (or the
   * hook is disabled / still loading). The action opens GC Review straight
   * into the round overlay (`?round=1`).
   */
  statementRoundEnabled?: boolean
  statementRound?: { count: number; total: number; gcNames: string[] } | null
  gcReviewStatus: GcReviewWeekStatus | null
  /** Parent computes both from the clock (gcReviewNudgeState/gcReviewWeekdayIndex) — the builder stays pure. */
  gcReviewNudge: GcReviewNudgeState | null
  gcReviewIsWednesday: boolean
  /**
   * Bulk-deletion bursts (v2.2491) — null when hidden (non-dev, snoozed,
   * dismissed; the hook owns that). Red severity: a destructive event, not a
   * work queue, and it never drains on its own — hence the secondary
   * snooze/dismiss actions.
   */
  bulkDeleteAlerts: BulkDeleteAlert[] | null
  /**
   * Refused break-glass dev-code attempts (v2.2492) — null when hidden
   * (the hook owns loading/snooze/dismiss). Red like bulk-delete: an attack
   * indicator, not a work queue.
   */
  claimDevRefusedCount: number | null
  claimDevLookbackDays: number
  /**
   * Robot bids awaiting a human audit (v2.2573) — the twin program's
   * bottleneck. The count comes from useBidAuditsPendingCount, which already
   * holds back sealed shadows (their reference bid hasn't gone out, so the
   * audit isn't workable yet). Enabled for the auditing roles only —
   * `canWorkRobotAudits(role)`, the bid_audits write set (v2.2920).
   */
  robotAuditsEnabled: boolean
  /** Division 22 (v2.2627): dev + estimator only — the ledger-teaching roles. */
  d22UncodedEnabled: boolean
  d22UncodedCount: number
  robotAuditsPending: number
  /**
   * Sealed robot numbers on live bids (v2.3126): shadows locked blind in the
   * last 14 days whose reference has not gone out. Not a work queue — the
   * scorecard lands by DB trigger the moment we send — just the head start,
   * shown to the same audience as robot audits. Null while loading (no item);
   * the hook reports [] on error. Absent = not wired (Quickfill passes null).
   */
  robotLockedShadows?: RobotLockedShadow[] | null
  /**
   * Cleared payments behind conditional lien releases (v2.2582) — the GC is
   * owed the unconditional follow-up. Null while loading; the hook reports
   * zero on error so the card stays quiet.
   */
  lienUnconditionalEnabled: boolean
  lienUnconditionalOwed: { count: number; total: number } | null
  /**
   * Demand letters past their named deadline with money still open (v2.2640).
   * Null while loading; the hook reports zero on error so the card stays quiet.
   */
  demandDeadlineEnabled: boolean
  demandDeadlineOverdue: { count: number; total: number } | null
  /**
   * Chapter 53 deadline watches (v2.2645) — serve-by (red, tier with received
   * money: rights actively at risk), notice windows, filing windows. Null
   * while loading; the hook reports empties on error.
   */
  /**
   * The Lien desk (v2.3405): § 53.056 notices due per unpaid work month on
   * sub jobs — the office's drafting pile and the leader's approvals. Null
   * while loading; the hook reports empties on error.
   */
  lienDeskEnabled?: boolean
  lienDesk?: LienDeskNeedsYou | null
  /** The viewer approves (master / dev) — shows the approvals card. */
  lienDeskLeader?: boolean
  lienWatchEnabled: boolean
  lienWatch: {
    noticeDue: { deadline: string; openBalance: number }[]
    filingDue: { deadline: string; openBalance: number }[]
    serveDue: { serveDue: string }[]
  } | null
  /**
   * Closed clock sessions awaiting approval (v2.2671) — null while loading or
   * when the RPC's internal gate returned the zero row. The item only shows
   * once the OLDEST pending day is hoursApprovalsMinAgeDays old, so a normal
   * same-week queue never nags; what it catches is the stall (Aug 2026: three
   * weeks of zero approvals starved payroll and the Overhead pool).
   */
  hoursApprovalsEnabled: boolean
  hoursApprovals: { sessions: number; totalHours: number; people: number; oldestAgeDays: number } | null
  hoursApprovalsMinAgeDays: number
  /**
   * Pending bank-label suggestions (journey-map Tier-2 #27) — null while
   * loading or when the RPC's internal gate returned the zero row. With the org
   * switch on, rule matches approve themselves server-side, so what stays
   * pending is the exception list; the item counts only the rows at least
   * labelApprovalsMinAgeDays old (the `stale` figure), so a same-week trickle
   * never nags and a stall (Sep 2026: 349 rows / ~$139K "Unlabeled", oldest
   * 16 days, waiting for a browser checkbox nobody had open) does.
   */
  labelApprovalsEnabled: boolean
  labelApprovals: { pending: number; stale: number; staleAmount: number; oldestAgeDays: number } | null
  labelApprovalsMinAgeDays: number
  /**
   * Open dispatch requests older than `dispatchMinAgeDays` (journey-map #40 /
   * C60) — the same min-age shape as hours approvals: the summary is null
   * until the OLDEST open request has waited that long, so a same-day inbox
   * never nags. Enabled for dispatch-group members + devs (the people who can
   * answer); Quickfill's twin passes the same summary from its own inbox rows.
   * Severity climbs to red once the oldest passes `DISPATCH_REQUEST_AGE.redDays`.
   */
  dispatchAgedEnabled?: boolean
  dispatchAged?: { count: number; total: number; oldestAgeDays: number } | null
  dispatchMinAgeDays?: number
  dispatchRedDays?: number
  /**
   * HR field reports pending longer than `hrReportsMinAgeDays` (journey-map
   * #40, J32-F7). Dev-only — People → HR (where they are filed) is dev-only.
   */
  hrReportsEnabled?: boolean
  hrReportsAged?: { count: number; total: number; oldestAgeDays: number } | null
  hrReportsMinAgeDays?: number
  hrReportsRedDays?: number
  /**
   * Supply-house job-account gaps (follow-up to v2.2669) from
   * count_job_account_flag_gaps(): jobs whose packet went out but still carry
   * unpaid UNflagged invoices, and flagged invoices on jobs never shared from
   * the app. Both hygiene-tier and self-clearing — the hook returns null when
   * both are zero. Office set; Quickfill passes nothing (absent = not wired).
   */
  jobAccountGapsEnabled?: boolean
  /** v2.3430 — the evidence rule: jobs that bought at a house expecting a job account with none on record. */
  jobAccountGaps?: { jobs: number; pairs: number; allocatedTotal: number; houseNames: string } | null
  /**
   * Customer Waiting (v2.3248): open high-priority portal requests in the
   * inboxes this viewer belongs to, from `CustomerWaitingContext` — null when
   * none. Tier 0 (a person is standing at the counter), red while anyone is
   * uncalled, amber once every one has been called but is still open.
   */
  customerWaitingEnabled?: boolean
  customerWaiting?: { count: number; uncalled: number; oldestMinutes: number; leadName: string } | null
  /**
   * Robot price matrices ready to review (Price Matrix PR 5): requests the
   * pricing twin finished that nobody has opened yet, from
   * `bid_price_matrix_requests` (status ready, reviewed_at null). Revenue
   * tier — a priced buyout waits on the estimator. Office set + estimator;
   * the hook returns null when none.
   */
  /**
   * Submittals (stage 4b, v2.3488): the four cards from `useSubmittalsNudge`
   * over `summarizeSubmittalNudge` — a won bid with no submittal started, a
   * shared room nobody opened, rows sent back with no resubmit, a lead time
   * past the job's stage window. Null = nothing waiting / loading.
   */
  submittalsEnabled?: boolean
  submittalNudge?: SubmittalNudge | null
  priceMatrixEnabled?: boolean
  priceMatrixReady?: {
    count: number
    /** The newest one, for the title and the deep link. */
    first: { bidId: string; bidLabel: string; project: string | null; picks: number; toSettle: number; expiredHouses: number }
  } | null
  /**
   * Price requests past their needed-by with nothing in, on live bids (Price requests PR 4,
   * v2.3573) — `usePriceRequestsLateNudge`. The first is the longest overdue.
   */
  priceRequestsLateEnabled?: boolean
  priceRequestsLate?: {
    count: number
    first: { bidId: string; bidLabel: string; project: string | null; house: string; daysLate: number }
  } | null
  /**
   * The robots' backlog (v2.3287, dev only): bids that want a shadow and
   * price matrices waiting on the pricer, from `buildRobotBacklog` — the same
   * queue kernel the Console counts with. Hygiene tier; blue unless something
   * is stuck (a matrix working with no heartbeat, a request over a week old).
   * The hook returns null when nothing waits, snoozed, or dismissed.
   */
  robotBacklogEnabled?: boolean
  robotBacklog?: import('./bids/robotBacklog').RobotBacklog | null
  /** Legal portal PR 2 (v2.3313): Collections accounts a dev has not yet marked attorney-ready — devs only. */
  legalReviewEnabled?: boolean
  legalReview?: import('./legal/legalMatters').LegalReviewSummary | null
  /** Legal portal PR 4: the firm's unacknowledged portal acts — office roles. */
  legalFirmActivityEnabled?: boolean
  legalFirmActivity?: import('./legal/legalMatters').LegalFirmActivity | null
  /** Test reports drafted on jobs and not yet sent (v2.3301) — office roles; null while loading. */
  testReportsEnabled?: boolean
  testReportsReady?: import('../hooks/useTestReportsReadyNudge').TestReportsReady | null
}

export function buildNeedsYouItems(inputs: NeedsYouInputs): NeedsYouItem[] {
  const items: NeedsYouItem[] = []

  if (inputs.lienWatchEnabled && (inputs.lienWatch?.serveDue.length ?? 0) > 0) {
    const rows = inputs.lienWatch?.serveDue ?? []
    const n = rows.length
    const worst = rows.map((r) => r.serveDue).sort()[0] ?? ''
    items.push({
      key: 'lien-serve-copy',
      severity: 'red',
      kicker: 'Lien filings',
      title: n === 1 ? 'A filed lien has not been served' : `${n} filed liens have not been served`,
      detail: `A copy of the filed affidavit must reach the owner and contractor by the 5th day after filing (§ 53.055) — the ${n === 1 ? 'deadline is' : 'earliest deadline is'} ${worst}. Record the service on the job's lien instruments.`,
      figure: String(n),
      actionLabel: 'Record service',
    })
  }

  // A window that closed with nothing recorded (v2.3679): the loss is named the day it happens and stays until someone notes it on the desk.
  if (inputs.lienDeskEnabled && inputs.lienDesk && inputs.lienDesk.missed.jobs > 0) {
    const m = inputs.lienDesk.missed
    const money = m.dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const one = m.jobs === 1 ? m.lines[0] : undefined
    const jobsWord = m.jobs === 1 ? 'a sub job' : `${m.jobs} sub jobs`
    items.push({
      key: 'lien-window-missed',
      severity: 'red',
      kicker: 'Lien deadlines · missed',
      title: one ? `The lien window for ${describeNoticeMonths(one.months)} closed on ${one.label || 'a sub job'} with no notice` : `${m.months} lien windows closed with no notice on ${jobsWord}`,
      detail: `${money} open${one?.label ? ` on ${one.label}` : ''}. The § 53.056 notice for ${m.months === 1 ? 'that month' : 'those months'} was never sent and no skip was recorded, so the lien right on that work is gone — the balance itself is still owed.${
        one ? '' : ` ${m.lines.map((l) => `${l.label || l.jobId.slice(0, 8)} (${describeNoticeMonths(l.months)})`).join(' · ')}.`
      } Note it on the Lien desk so the record says who saw it.`,
      figure: money,
      actionLabel: 'See it on the desk',
    })
  }

  if (inputs.lienDeskEnabled && inputs.lienDesk && inputs.lienDesk.office.jobs > 0) {
    const o = inputs.lienDesk.office
    const money = o.dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const soon = o.earliestDeadline ? daysUntilYmd(o.earliestDeadline) : null
    items.push({
      key: 'lien-notice-draft',
      severity: soon != null && soon <= 7 ? 'red' : 'amber',
      kicker: 'Lien deadlines',
      title: o.jobs === 1 ? 'A lien notice to draft' : `${o.jobs} lien notices to draft`,
      detail: `${money} open on ${o.jobs === 1 ? 'a sub job' : `${o.jobs} sub jobs`} with ${o.months} unpaid work ${o.months === 1 ? 'month' : 'months'} whose § 53.056 notice ${o.earliestDeadline ? `closes ${o.earliestDeadline}${soon === 0 ? ' — today' : soon === 1 ? ' — tomorrow' : soon != null && soon > 1 ? ` — in ${soon} days` : ''}` : 'is coming due'}.${o.needsOwner > 0 ? ` ${o.needsOwner} ${o.needsOwner === 1 ? 'needs' : 'need'} the owner of record first.` : ''}${o.ready > 0 ? ` ${o.ready} approved and waiting to go out.` : ''}`,
      figure: money,
      actionLabel: 'Open the Lien desk',
    })
  }

  // Put a GC on notice (v2.3479): a run the office prepared is one card per GC, not N notices.
  const batches = inputs.lienDeskEnabled && inputs.lienDeskLeader ? inputs.lienDesk?.leader.batches ?? [] : []
  const batchJobs = batches.reduce((s, b) => s + b.jobs, 0)
  if (batches.length > 0) {
    const first = batches[0]!
    const money = batches.reduce((s, b) => s + b.dollars, 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const earliest = batches.map((b) => b.earliestDeadline).filter((d): d is string => Boolean(d)).sort()[0] ?? null
    const soon = earliest ? daysUntilYmd(earliest) : null
    const names = batches.map((b) => b.gcName || 'a GC')
    items.push({
      key: 'lien-notice-batch',
      severity: soon != null && soon <= 7 ? 'red' : 'blue',
      kicker: 'Lien deadlines · your call',
      title: batches.length === 1 ? `Approve the run for ${first.gcName || 'a GC'}` : `Approve ${batches.length} runs the office prepared`,
      detail: `${money} claimed on ${batchJobs} notice${batchJobs === 1 ? '' : 's'}${batches.length > 1 ? ` (${names.join(', ')})` : ''}. ${first.reason}.${earliest ? ` The earliest window closes ${earliest}.` : ''} One approval sends every owner the notice and hands the run to the office.`,
      figure: String(batchJobs),
      actionLabel: 'Decide',
    })
  }

  if (inputs.lienDeskEnabled && inputs.lienDeskLeader && inputs.lienDesk && inputs.lienDesk.leader.jobs - batchJobs > 0) {
    const l = inputs.lienDesk.leader
    const jobs = l.jobs - batchJobs
    const money = l.dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const soon = l.earliestDeadline ? daysUntilYmd(l.earliestDeadline) : null
    items.push({
      key: 'lien-notice-approve',
      severity: soon != null && soon <= 7 ? 'red' : 'blue',
      kicker: 'Lien deadlines · your call',
      title: jobs === 1 ? 'Approve a lien notice the office drafted' : `Approve ${jobs} lien notices the office drafted`,
      detail: `${money} open. ${l.earliestDeadline ? `The earliest window closes ${l.earliestDeadline}.` : ''} Approve, hold, or set a standing rule so the office stops asking for that GC.`,
      figure: String(jobs),
      actionLabel: 'Decide',
    })
  }

  if (inputs.lienWatchEnabled && (inputs.lienWatch?.filingDue.length ?? 0) > 0) {
    const rows = inputs.lienWatch?.filingDue ?? []
    const n = rows.length
    const total = rows.reduce((s, r) => s + r.openBalance, 0)
    const money = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const worst = rows.map((r) => r.deadline).sort()[0] ?? ''
    items.push({
      key: 'lien-file-window',
      severity: 'amber',
      kicker: 'Lien deadlines',
      title: n === 1 ? `A lien filing window closes ${worst}` : `${n} lien filing windows close soon (first: ${worst})`,
      detail: `${money} is still open and the § 53.052 affidavit window is closing — after it, the lien right on this work is gone. The Lien desk's Affidavits pile drafts, approves and files it.`,
      figure: String(n),
      actionLabel: 'Open the Lien desk',
    })
  }

  if (inputs.contractNudgeEnabled && (inputs.contractNudge?.missing.count ?? 0) > 0) {
    const { count: n, revenueTotal } = inputs.contractNudge!.missing
    const money = revenueTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    items.push({
      key: 'contract-missing',
      severity: 'amber',
      kicker: 'Contracts',
      title: n === 1 ? 'A live job has no contract on file' : `${n} live jobs have no contract on file`,
      detail:
        `${money} of work is running on no signed agreement. ` +
        'Open the sweep: every job is a row with the customer’s email and a Send button — or upload the paper copy where one exists.',
      figure: String(n),
      actionLabel: 'Start the sweep',
    })
  }

  if (inputs.contractNudgeEnabled && (inputs.contractNudge?.stale.count ?? 0) > 0) {
    const { count: n, oldestDays } = inputs.contractNudge!.stale
    items.push({
      key: 'contract-stale',
      severity: 'amber',
      kicker: 'Contracts',
      title: n === 1 ? 'A contract has been out for signature a week' : `${n} contracts have been out for signature a week`,
      detail: `Sent 7+ days ago and still unsigned${oldestDays != null ? ` — the oldest ${oldestDays} days` : ''}. Resend, text the link, or call and sign it in person.`,
      figure: String(n),
      actionLabel: 'See them',
    })
  }

  if (inputs.unpricedWorkOrdersEnabled && (inputs.unpricedWorkOrders?.count ?? 0) > 0) {
    const { count: n, subNames, oldestDays } = inputs.unpricedWorkOrders!
    const who = subNames.length === 0 ? '' : subNames.length <= 3 ? ` for ${subNames.join(', ')}` : ` for ${subNames.slice(0, 2).join(', ')} and ${subNames.length - 2} more`
    items.push({
      key: 'work-orders-unpriced',
      severity: 'amber',
      kicker: 'Work orders',
      title: n === 1 ? 'A sub work order is waiting for a price' : `${n} sub work orders are waiting for a price`,
      detail: `Drafted${who} without a subcontract amount${oldestDays != null && oldestDays > 0 ? ` — the oldest ${oldestDays} day${oldestDays === 1 ? '' : 's'} ago` : ''}. Next: price it and send.`,
      figure: String(n),
      actionLabel: n === 1 ? 'Price it' : 'Price them',
    })
  }

  if (inputs.staleOpenEnabled && (inputs.staleOpen?.count ?? 0) > 0) {
    const { count: n, total, mine, minIdleDays } = inputs.staleOpen!
    const money = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    items.push({
      key: 'jobs-stale-open',
      severity: 'amber',
      kicker: 'Jobs',
      title: n === 1 ? `An open job has sat idle ${minIdleDays}+ days` : `${n} open jobs have sat idle ${minIdleDays}+ days`,
      detail:
        `${money} of contract with no field work in ${minIdleDays} days${mine > 0 ? ` — ${mine} ${mine === 1 ? 'is' : 'are'} yours` : ''}. ` +
        'Each one needs a bill, an inspection, or to be closed. The Cycle view lists them longest-idle first.',
      figure: String(n),
      actionLabel: 'See them',
    })
  }

  if (inputs.capacityUnderEnabled && inputs.capacityUnder && inputs.capacityUnder.weeks.length > 0) {
    const c = inputs.capacityUnder
    const pcts = c.weeks.map((w) => `${Math.round(w.utilizationPct)}%`)
    const names = c.weeks.map((w) => monthDayLabel(w.weekStartYmd))
    const weekList = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '')
    const hours = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 0 })
    const basis = c.source === 'roster' ? `a field roster of ${c.crewNow}` : 'who clocked in, since the roster could not be read'
    const latest = c.weeks[c.weeks.length - 1]
    items.push({
      key: 'capacity-under',
      severity: 'amber',
      kicker: 'Capacity',
      title: `Field capacity has run under ${c.thresholdPct}% ${c.weeks.length === 3 ? 'three' : String(c.weeks.length)} weeks running`,
      detail:
        `${pcts.join(' · ')} for the weeks of ${weekList} — ${hours(c.fieldHours)} of ${hours(c.availableHours)} available field hours, against ${basis}. ` +
        'Either the board is short of work for the crew or hours are not being clocked; the Capacity view shows every week.',
      figure: latest ? `${Math.round(latest.utilizationPct)}%` : `${c.weeks.length}`,
      actionLabel: 'Open Capacity',
    })
  }

  if (inputs.demandDeadlineEnabled && (inputs.demandDeadlineOverdue?.count ?? 0) > 0) {
    const { count: n, total } = inputs.demandDeadlineOverdue as { count: number; total: number }
    const money = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    items.push({
      key: 'demand-deadline',
      severity: 'red',
      kicker: 'Demand letters',
      title:
        n === 1 ? 'A demand-letter deadline passed unpaid' : `${n} demand-letter deadlines passed unpaid`,
      detail:
        `${money} is still open past the payment deadline${n === 1 ? '' : 's'} you set in writing. ` +
        "Follow through on the letter's next step — open the lien instruments on each job's Pipeline row.",
      figure: String(n),
      actionLabel: 'Open the jobs',
    })
  }

  if (inputs.lienUnconditionalEnabled && (inputs.lienUnconditionalOwed?.count ?? 0) > 0) {
    const { count: n, total } = inputs.lienUnconditionalOwed as { count: number; total: number }
    const money = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    items.push({
      key: 'lien-unconditional',
      severity: 'blue',
      kicker: 'Lien releases',
      title:
        n === 1
          ? 'A payment cleared behind a conditional release'
          : `${n} payments cleared behind conditional releases`,
      detail:
        (n === 1 ? `A check (${money}) has cleared since its` : `${money} in checks have cleared since their`) +
        " conditional lien release was issued — the customer is owed the unconditional version. Open the list: each row issues its unconditional release, prefilled from the original.",
      figure: String(n),
      actionLabel: n === 1 ? 'Issue release' : 'Issue releases',
    })
  }

  if (inputs.arBankEnabled && (inputs.arBankUnallocatedCount ?? 0) > 0) {
    const n = inputs.arBankUnallocatedCount as number
    items.push({
      key: 'ar-deposits',
      severity: 'blue',
      kicker: 'Money received',
      title: n === 1 ? 'Allocate a bank deposit' : `Allocate ${n} bank deposits`,
      detail:
        (n === 1 ? 'One Mercury transaction still has' : `${n} Mercury transactions still have`) +
        ' balance to apply — match to billed lines in Accounts Receivable, right here.',
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Match deposits',
    })
  }

  if (inputs.role != null && (inputs.tallyStaleUnlinkedCount ?? 0) > 0) {
    const n = inputs.tallyStaleUnlinkedCount as number
    const total = inputs.tallyUnlinkedCount ?? null
    // The page this opens counts every unlinked row; the card counts the ones
    // over the age floor. Say both here in the page's words (v2.2896) — the
    // page says both in the card's words (`tallyStaleGloss`).
    const totalGloss = total != null && total > n ? ` (${total} unlinked in all)` : ''
    items.push({
      key: 'tally-self',
      severity: 'amber',
      kicker: 'Your card purchases',
      title: n === 1 ? 'One purchase needs a job' : `${n} purchases need a job`,
      detail:
        (n === 1 ? `One purchase over ${inputs.tallyMinAgeDays} days old isn't` : `Purchases over ${inputs.tallyMinAgeDays} days old aren't`) +
        ` on a job yet${totalGloss} — sort in Job Parts Tally.`,
      figure: String(n),
      actionLabel: 'Open tally',
      ...(total != null && total !== n ? { destinationFigure: String(total) } : {}),
    })
  }

  if (
    inputs.tallyStaffEligible &&
    (inputs.tallyStaffStalePeopleCount ?? 0) > 0 &&
    (inputs.tallyStaffStaleTxCount ?? 0) > 0
  ) {
    const people = inputs.tallyStaffStalePeopleCount as number
    const tx = inputs.tallyStaffStaleTxCount as number
    items.push({
      key: 'tally-team',
      severity: 'amber',
      kicker: "Your team's purchases",
      title: `Team purchases waiting to be sorted`,
      detail: `${people} ${people === 1 ? 'person has' : 'people have'} ${tx} purchase${tx === 1 ? '' : 's'} over ${inputs.tallyMinAgeDays} days old with no job — sort them on their behalf.`,
      figure: String(tx),
      actionLabel: 'Sort for the team',
    })
  }

  if (!inputs.lostBidNudgeLoading && inputs.lostBidNudge != null) {
    const { count, value } = inputs.lostBidNudge
    items.push({
      key: 'lost-bids',
      severity: 'gray',
      kicker: 'Win/loss hygiene',
      // Tier-2 #20: the scope sits on the number itself ("· all trades"); the lens it opens
      // wears its trade pill's name the same way, so the two figures explain each other.
      title: withScopeLabel(count === 1 ? 'One lost bid has no reason recorded' : `${count} lost bids have no reason recorded`, { kind: 'all' }),
      // Scope gloss (v2.2896): this counts every trade; the lens it opens is
      // scoped to the trade pill and says so in its own header.
      detail:
        (value > 0 ? `${formatLostBidNudgeValue(value)} unexplained across every trade — ` : 'Across every trade — ') +
        'work them one GC call at a time on the Why we lost lens (it opens on one trade).',
      figure: count > 99 ? '99+' : String(count),
      actionLabel: 'Start call mode',
    })
  }

  if (inputs.teamReviewsOverdue.length > 0) {
    const n = inputs.teamReviewsOverdue.length
    // One line, on purpose (v2.2757): the figure carries the count, the button
    // carries the destination, and the Rate deck lists who — so the detail
    // only says why they're here.
    items.push({
      key: 'team-reviews',
      severity: 'blue',
      kicker: 'Team reviews',
      title: 'Team reviews due',
      detail: `No review from you in ${inputs.teamReviewCadenceDays}+ days.`,
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Open Hiring → Review',
    })
  }

  if (inputs.roadmapNudges.length > 0) {
    const shown = inputs.roadmapNudges.slice(0, 3)
    const total = inputs.roadmapNudges.reduce((a, n) => a + n.needsName, 0)
    const single = shown.length === 1 ? shown[0] : undefined
    items.push({
      key: 'roadmap-needs-person',
      severity: 'amber',
      kind: 'roadmap',
      kicker: 'Roadmap',
      title: single
        ? `${single.title} · ${single.needsName} roadmap task${single.needsName === 1 ? '' : 's'} need${single.needsName === 1 ? 's' : ''} a person`
        : `${total} roadmap tasks need a person`,
      detail:
        (single
          ? single.next
            ? `next: ${single.next.label}`
            : 'assign names on the Plan view'
          : shown.map((n) => `${n.title} · ${n.needsName}`).join(' · ')) + ' — open the Plan to hand them out.',
      figure: total > 99 ? '99+' : String(total),
      actionLabel: 'Open Plan',
    })
  }

  if (inputs.jobFollowupsEnabled && (inputs.jobFollowupCount ?? 0) > 0) {
    const n = inputs.jobFollowupCount as number
    const breakdown = jobFollowupBreakdownPhrase(inputs.jobFollowupStageCounts)
    items.push({
      key: 'job-followups',
      severity: 'amber',
      kicker: 'Quiet jobs',
      title: n === 1 ? 'One job is waiting on a follow-up' : `${n} jobs are waiting on a follow-up`,
      detail: `${breakdown ? `${breakdown} — ` : ''}review them one card at a time.`,
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Start review',
    })
  }

  if (inputs.statementRoundEnabled && inputs.statementRound && inputs.statementRound.count > 0) {
    const r = inputs.statementRound
    const preview = r.gcNames.slice(0, 3).join(', ')
    const more = r.gcNames.length > 3 ? ` +${r.gcNames.length - 3} more` : ''
    items.push({
      key: 'statement-round',
      severity: 'blue',
      kicker: 'Statement round',
      title: r.count === 1 ? 'One GC is waiting on your statement' : `${r.count} GCs are waiting on your statement`,
      detail: `${preview}${more} · $${Math.round(r.total).toLocaleString('en-US')} certified and ready — a personal email from you.`,
      figure: r.count > 99 ? '99+' : String(r.count),
      actionLabel: 'Start round',
    })
  }

  if (inputs.gcReviewEnabled && inputs.gcReviewStatus != null && inputs.gcReviewNudge === 'due') {
    const s = inputs.gcReviewStatus
    const remaining = gcReviewGcsToDo(s)
    const allCertified = s.gcs_certified >= s.gcs_outstanding
    items.push({
      key: 'gc-review-weekly',
      severity: 'amber',
      kicker: 'Wednesday ritual',
      title: inputs.gcReviewIsWednesday ? 'GC review is due today' : 'GC review is still due this week',
      detail: `${s.gcs_certified} of ${s.gcs_outstanding} GCs certified · ${s.gcs_sent} statement${s.gcs_sent === 1 ? '' : 's'} sent — ${
        allCertified ? 'every group is certified; send each statement off so every GC knows what they owe.' : 'certify each group and send it off so every GC knows what they owe.'
      }`,
      figure: remaining > 99 ? '99+' : String(remaining),
      actionLabel: 'Open GC Review',
    })
  }

  if (inputs.bulkDeleteAlerts != null && inputs.bulkDeleteAlerts.length > 0) {
    const alerts = inputs.bulkDeleteAlerts
    const count = alerts.length
    const totalBundles = alerts.reduce((sum, a) => sum + Number(a.bundles ?? 0), 0)
    const actors = new Set(alerts.map((a) => a.actor_name)).size
    const newest = alerts[0] as BulkDeleteAlert
    items.push({
      key: 'bulk-delete',
      severity: 'red',
      kicker: 'Data safety',
      title: count === 1 ? 'Bulk deletion detected' : 'Bulk deletions detected',
      detail:
        count === 1
          ? `${newest.actor_name} deleted ${newest.bundles} record${Number(newest.bundles) === 1 ? '' : 's'} at once ${formatDispatchNoteDaysAgoShortPhrase(newest.window_start)} — review them in Recently deleted.`
          : `${totalBundles} records across ${count} bursts by ${actors} ${actors === 1 ? 'person' : 'people'} — newest: ${newest.actor_name} ${formatDispatchNoteDaysAgoShortPhrase(newest.window_start)}. Review them in Recently deleted.`,
      figure: count > 99 ? '99+' : String(count),
      actionLabel: 'Review deletions',
      secondary: [
        { key: 'snooze', label: 'Snooze 24h' },
        { key: 'dismiss', label: 'Dismiss until count increases' },
      ],
    })
  }

  if (inputs.robotAuditsEnabled && inputs.robotAuditsPending > 0) {
    const n = inputs.robotAuditsPending
    items.push({
      key: 'robot-audits',
      severity: 'amber',
      kicker: 'Robot training',
      title: n === 1 ? 'One robot bid is waiting on your audit' : `${n} robot bids are waiting on your audit`,
      detail: 'The card shows where the robot and our bid differ — judge each difference with one tap, and it learns from every verdict.',
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Open Audits',
    })
  }

  if (inputs.robotAuditsEnabled && inputs.robotLockedShadows != null && inputs.robotLockedShadows.length > 0) {
    const sealed = inputs.robotLockedShadows
    const n = sealed.length
    const one = sealed[0] as RobotLockedShadow
    const where = one.project ? ` (${one.project})` : ''
    items.push({
      key: 'robot-locked',
      severity: 'blue',
      kicker: 'Robot bid',
      title: n === 1 ? `The robot has a sealed number on b${one.referenceBid}${where}` : `The robot has sealed numbers on ${n} live bids`,
      detail: 'Locked before ours went out — the score lands the moment we send, and the envelope opens for you right then. Nothing to do; this is the head start.',
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Open Robot Board',
    })
  }

  if (inputs.d22UncodedEnabled && inputs.d22UncodedCount > 0) {
    const n = inputs.d22UncodedCount
    items.push({
      key: 'd22-uncoded',
      severity: 'amber',
      kicker: 'Division 22',
      title: n === 1 ? 'One fixture name has no Division 22 code' : `${n} fixture names have no Division 22 code`,
      detail:
        'Supply house lists file them under "No code yet" — pin a name once and every bid is fixed, past and future.',
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Pin codes',
    })
  }

  if (
    inputs.hoursApprovalsEnabled &&
    inputs.hoursApprovals != null &&
    inputs.hoursApprovals.sessions > 0 &&
    inputs.hoursApprovals.oldestAgeDays >= inputs.hoursApprovalsMinAgeDays
  ) {
    const a = inputs.hoursApprovals
    const hours = a.totalHours.toLocaleString('en-US', { maximumFractionDigits: 0 })
    items.push({
      key: 'hours-approvals',
      severity: 'amber',
      kicker: 'Time approvals',
      title:
        a.sessions === 1
          ? 'A clock session is waiting on approval'
          : `${a.sessions} clock sessions are waiting on approval`,
      detail:
        `${a.people === 1 ? 'One person has' : `${a.people} people have`} ${hours}h unapproved — the oldest from ${a.oldestAgeDays} days ago. ` +
        'Unapproved time is missing from payroll, the Hours grid, and the Overhead numbers — work the queue on People → Hours.',
      figure: a.sessions > 99 ? '99+' : String(a.sessions),
      actionLabel: 'Open approvals',
    })
  }

  if (
    inputs.labelApprovalsEnabled &&
    inputs.labelApprovals != null &&
    inputs.labelApprovals.stale > 0 &&
    inputs.labelApprovals.oldestAgeDays >= inputs.labelApprovalsMinAgeDays
  ) {
    const a = inputs.labelApprovals
    const money = a.staleAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const fresher = a.pending - a.stale
    items.push({
      key: 'label-approvals',
      severity: 'amber',
      kicker: 'Bank labels',
      title:
        a.stale === 1
          ? `A bank-label suggestion has waited ${inputs.labelApprovalsMinAgeDays}+ days for an OK`
          : `${a.stale} bank-label suggestions have waited ${inputs.labelApprovalsMinAgeDays}+ days for an OK`,
      detail:
        `${money} of card charges and transfers sit as "Unlabeled" in the P&L, Card Review, and Visuals — the oldest from ${a.oldestAgeDays} days ago` +
        (fresher > 0 ? `, plus ${fresher} newer still inside the ${inputs.labelApprovalsMinAgeDays}-day window` : '') +
        '. Approve all on Banking → Accounting clears the backlog; with the org switch on, only Internal Transfers on split transactions come back here.',
      figure: a.stale > 99 ? '99+' : String(a.stale),
      actionLabel: 'Open approvals',
    })
  }

  if (inputs.customerWaitingEnabled && inputs.customerWaiting != null && inputs.customerWaiting.count > 0) {
    const { count, uncalled, oldestMinutes, leadName } = inputs.customerWaiting
    const waitShort = oldestMinutes < 60 ? `${oldestMinutes} min` : oldestMinutes < 48 * 60 ? `${Math.floor(oldestMinutes / 60)} h ${oldestMinutes % 60 ? `${oldestMinutes % 60} min` : ''}`.trim() : `${Math.floor(oldestMinutes / 1440)} days`
    items.push({
      key: 'customer-waiting',
      severity: uncalled > 0 ? 'red' : 'amber',
      kicker: 'Customer portal',
      title:
        uncalled > 0
          ? count === 1
            ? `${leadName} is waiting · ${waitShort}`
            : `${count} customers waiting · oldest ${waitShort}`
          : count === 1
            ? `${leadName} was called — request still open`
            : `${count} customer requests called, still open`,
      detail:
        uncalled > 0
          ? `${uncalled === 1 ? 'A request' : `${uncalled} requests`} sent from a customer portal ${uncalled === 1 ? 'has' : 'have'} nobody on ${uncalled === 1 ? 'it' : 'them'} yet. Open the inbox: the number is on the row, Call stamps it for the whole team.`
          : 'Someone has called back; lower the priority once it is scheduled, or close it with a note when the visit is done.',
      figure: count > 99 ? '99+' : String(count),
      actionLabel: 'Open the inbox',
    })
  }

  if (inputs.dispatchAgedEnabled && inputs.dispatchAged != null && inputs.dispatchAged.count > 0) {
    const { count: n, total, oldestAgeDays } = inputs.dispatchAged
    const minAge = inputs.dispatchMinAgeDays ?? 0
    const red = inputs.dispatchRedDays != null && oldestAgeDays >= inputs.dispatchRedDays
    items.push({
      key: 'dispatch-requests-aged',
      severity: red ? 'red' : 'amber',
      kicker: 'Dispatch inbox',
      title:
        n === 1
          ? `A dispatch request has waited ${minAge}+ days`
          : `${n} dispatch requests have waited ${minAge}+ days`,
      detail:
        `${n === 1 ? 'A tech is' : 'Techs are'} still waiting on an answer — the oldest asked ${oldestAgeDays} day${oldestAgeDays === 1 ? '' : 's'} ago` +
        `${total > n ? ` (${total} open in all)` : ''}. The inbox lists them oldest first; answer or close each with a note and the sender hears back.`,
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Open Dispatch inbox',
    })
  }

  if (inputs.hrReportsEnabled && inputs.hrReportsAged != null && inputs.hrReportsAged.count > 0) {
    const { count: n, total, oldestAgeDays } = inputs.hrReportsAged
    const minAge = inputs.hrReportsMinAgeDays ?? 0
    const red = inputs.hrReportsRedDays != null && oldestAgeDays >= inputs.hrReportsRedDays
    items.push({
      key: 'hr-reports-pending',
      severity: red ? 'red' : 'amber',
      kicker: 'HR reports',
      title:
        n === 1
          ? `A field report has waited ${minAge}+ days to be filed`
          : `${n} field reports have waited ${minAge}+ days to be filed`,
      detail:
        `Written from the field and still not on anyone's record — the oldest ${oldestAgeDays} day${oldestAgeDays === 1 ? '' : 's'} ago` +
        `${total > n ? ` (${total} pending in all)` : ''}. File each onto the person's HR record or dismiss it with a reason; the author sees the status flip.`,
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Open pending reports',
    })
  }

  if (inputs.claimDevRefusedCount != null && inputs.claimDevRefusedCount > 0) {
    const n = inputs.claimDevRefusedCount
    items.push({
      key: 'claim-dev',
      severity: 'red',
      kicker: 'Data safety',
      title: 'Someone tried to become a dev',
      detail: `${n} refused attempt${n === 1 ? '' : 's'} to use the admin code in the last ${inputs.claimDevLookbackDays} days. They were blocked — the code only works when no dev is available. If this wasn't someone you asked to do it, rotate the code.`,
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Review accounts',
      secondary: [
        { key: 'snooze', label: 'Snooze 24h' },
        { key: 'dismiss', label: 'Dismiss until it happens again' },
      ],
    })
  }

  if (inputs.jobAccountGapsEnabled && (inputs.jobAccountGaps?.jobs ?? 0) > 0) {
    const { jobs: n, pairs, allocatedTotal, houseNames } = inputs.jobAccountGaps!
    const money = allocatedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const where = houseNames.trim() ? ` at ${houseNames.trim()}` : ''
    items.push({
      key: 'job-account-missing',
      severity: 'gray',
      kicker: 'Job accounts',
      title:
        n === 1
          ? 'A job bought parts at a house with no job account'
          : `${n} jobs bought parts at a house with no job account`,
      detail:
        `${money} of supplier invoices landed on ${n === 1 ? 'a job' : `${n} jobs`}${where} with nothing on record` +
        `${pairs > n ? ` (${pairs} job-and-house pairs)` : ''}. ` +
        'The house bills the property owner either way; the account is what puts the job on its own statement. Mark each one opened, or not needed.',
      figure: String(n),
      actionLabel: 'Review them',
    })
  }

  if (inputs.submittalsEnabled && inputs.submittalNudge) {
    const n = inputs.submittalNudge
    const monthDay = (ymd: string) => {
      const d = new Date(`${ymd}T00:00:00Z`)
      return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    }
    if (n.leadTime.count > 0 && n.leadTime.first) {
      const f = n.leadTime.first
      items.push({
        key: 'submittal-lead-time',
        severity: 'red',
        kicker: 'Submittals',
        title: n.leadTime.count === 1 ? `A lead time runs past its stage window — ${f.bidLabel} ${f.tag}` : `${n.leadTime.count} lead times run past their stage windows — worst ${f.bidLabel} ${f.tag}`,
        detail: `${f.tag} is ${f.leadDays} days out: ordered today it lands ${monthDay(f.landsYmd)}, and the job's earliest stage window ends ${monthDay(f.windowEndYmd)} — ${f.overrunDays} day${f.overrunDays === 1 ? '' : 's'} late. Order now, pick a product in stock, or move the window.`,
        figure: String(n.leadTime.count),
        actionLabel: 'Open Submittals',
      })
    }
    if (n.sentBack.count > 0 && n.sentBack.first) {
      const f = n.sentBack.first
      items.push({
        key: 'submittal-sent-back',
        severity: 'red',
        kicker: 'Submittals',
        title: n.sentBack.count === 1 ? `${f.rows} row${f.rows === 1 ? '' : 's'} sent back on ${f.bidLabel} Rev ${f.revNumber}, no resubmit yet` : `${n.sentBack.count} submittals have rows sent back with no resubmit — ${f.bidLabel} first`,
        detail: `The reviewer marked ${f.rows === 1 ? 'a row' : `${f.rows} rows`} Revise or Reject${n.sentBack.count === 1 ? '' : ` on ${f.bidLabel}`}. Rev ${f.revNumber + 1} from the rows sent back is one tap on the Submittals tab; the same room link shows it.`,
        figure: String(n.sentBack.count),
        actionLabel: 'Open Submittals',
      })
    }
    if (n.unopened.count > 0 && n.unopened.first) {
      const f = n.unopened.first
      const who = f.names.length > 0 ? `${f.names.join(', ')} ${f.names.length === 1 ? 'has' : 'have'} not opened ${f.names.length === 1 ? 'their' : 'their'} link` : 'nobody has opened the room'
      items.push({
        key: 'submittal-unopened',
        severity: 'blue',
        kicker: 'Submittals',
        title: n.unopened.count === 1 ? `Shared ${f.days} days, nobody has opened it — ${f.bidLabel}` : `${n.unopened.count} shared submittals sit unopened — ${f.bidLabel} longest, ${f.days} days`,
        detail: `${who}. No email leaves the app for this — ask the GC to nudge them, or send the link again from the tab.`,
        figure: String(n.unopened.count),
        actionLabel: 'Open Submittals',
      })
    }
    if (n.notStarted.count > 0 && n.notStarted.first) {
      const f = n.notStarted.first
      items.push({
        key: 'submittal-not-started',
        severity: 'amber',
        kicker: 'Submittals',
        title: n.notStarted.count === 1 ? `Won ${f.days} days ago, no submittal started — ${f.bidLabel}` : `${n.notStarted.count} won bids have no submittal started — ${f.bidLabel} longest, ${f.days} days`,
        detail: 'The GC usually asks in the first week. Build Rev 1 from the picks on the Submittals tab; the rows, reasons and lead times are already there from the compare.',
        figure: String(n.notStarted.count),
        actionLabel: 'Open Submittals',
      })
    }
  }

  if (inputs.priceMatrixEnabled && inputs.priceMatrixReady && inputs.priceMatrixReady.count > 0) {
    const { count, first } = inputs.priceMatrixReady
    const where = `${first.bidLabel}${first.project ? ` ${first.project}` : ''}`
    const picks = `${first.picks} pick${first.picks === 1 ? '' : 's'}`
    const settle = first.toSettle > 0 ? `, ${first.toSettle} to settle` : ''
    items.push({
      key: 'price-matrix-ready',
      severity: first.toSettle > 0 ? 'amber' : 'blue',
      kicker: 'Robot pricing',
      title: count === 1 ? `The robot priced ${where} — ${picks} ready${settle}` : `${count} robot price matrices are ready — newest ${where}`,
      detail:
        (count === 1 ? 'The supply-house quotes are read and compared. ' : `${where}: ${picks}${settle}. `) +
        (first.toSettle > 0 ? 'A carrier or a size waits on your call before those rows price. ' : '') +
        (first.expiredHouses > 0 ? `${first.expiredHouses === 1 ? 'One quote was' : `${first.expiredHouses} quotes were`} already expired when read — ask for a re-issue before ordering.` : 'Review the picks, then Apply picks to costs.'),
      figure: String(count),
      actionLabel: 'Review matrix',
    })
  }

  if (inputs.priceRequestsLateEnabled && inputs.priceRequestsLate && inputs.priceRequestsLate.count > 0) {
    const { count, first } = inputs.priceRequestsLate
    const where = `${first.bidLabel}${first.project ? ` ${first.project}` : ''}`
    const days = `${first.daysLate} day${first.daysLate === 1 ? '' : 's'}`
    items.push({
      key: 'price-requests-late',
      severity: 'amber',
      kicker: 'Price requests',
      title:
        count === 1
          ? `${first.house} is ${days} past the date you asked for on ${where}, with nothing in`
          : `${count} price requests are past their date with nothing in — longest ${first.house} on ${where}, ${days}`,
      detail: 'The bid cannot be priced on time without them. Nudge an app-sent request, call a hand-sent one, or paste the quote link on the row when it lands.',
      figure: String(count),
      actionLabel: 'Open Price requests',
    })
  }

  if (inputs.legalFirmActivityEnabled && inputs.legalFirmActivity && inputs.legalFirmActivity.count > 0) {
    const f = inputs.legalFirmActivity
    const parts: string[] = []
    if (f.payments) parts.push(`${f.payments} payment${f.payments === 1 ? '' : 's'} received by counsel ($${Math.round(f.paymentTotal).toLocaleString('en-US')}) to apply to the job`)
    if (f.questions) parts.push(`${f.questions} question${f.questions === 1 ? '' : 's'} to answer`)
    if (f.fees) parts.push(`${f.fees} fee${f.fees === 1 ? '' : 's'} or cost${f.fees === 1 ? '' : 's'} added ($${Math.round(f.feeTotal).toLocaleString('en-US')})`)
    if (f.steps) parts.push(`${f.steps} step${f.steps === 1 ? '' : 's'} recorded`)
    items.push({
      key: 'legal-firm-activity',
      severity: f.payments || f.questions ? 'amber' : 'blue',
      kicker: 'Legal',
      title: `The law firm has ${f.count} thing${f.count === 1 ? '' : 's'} for you`,
      detail: `${parts.join(' · ')}${f.firstName ? ` — starts with ${f.firstName}` : ''}. Each clears from the desk's Fees & steps tab when you answer, apply or acknowledge it.`,
      figure: String(f.count),
      actionLabel: 'Open the desk',
    })
  }

  if (inputs.legalReviewEnabled && inputs.legalReview && inputs.legalReview.underReview > 0) {
    const r = inputs.legalReview
    const n = r.underReview
    const asked = r.requested.length
      ? `${r.requested.length} asked for your eyes: ${r.requested.slice(0, 2).map((q) => `${q.name} — ${q.by ?? 'the office'}${q.note ? ` “${q.note}”` : ''}`).join(' · ')}${r.requested.length > 2 ? ' · …' : ''}. `
      : ''
    const oldest = r.oldestDays != null && r.oldestDays > 0 ? `Oldest has sat ${r.oldestDays} day${r.oldestDays === 1 ? '' : 's'}. ` : ''
    items.push({
      key: 'legal-review',
      severity: asked || (r.oldestDays ?? 0) > 30 ? 'amber' : 'blue',
      kicker: 'Legal',
      title: `${n} Collections account${n === 1 ? '' : 's'} await${n === 1 ? 's' : ''} your review before an attorney sees ${n === 1 ? 'it' : 'them'}`,
      detail: `${asked}${oldest}Open each on the Legal desk, work the gaps, and mark it attorney-ready — that is the moment it reaches the firm — or write it down.${r.withFirm ? ` ${r.withFirm} already with the firm.` : ''}`,
      figure: String(n),
      actionLabel: 'Review',
    })
  }

  if (inputs.robotBacklogEnabled && inputs.robotBacklog && inputs.robotBacklog.bidsWaiting + inputs.robotBacklog.matricesOpen > 0) {
    const b = inputs.robotBacklog
    const parts: string[] = []
    if (b.bidsWaiting > 0) {
      const age = b.oldestRequestMs != null ? ` (oldest asked ${describeBacklogAge(b.oldestRequestMs)} ago)` : ' (nobody asked yet)'
      parts.push(`${b.bidsWaiting} bid${b.bidsWaiting === 1 ? '' : 's'} want${b.bidsWaiting === 1 ? 's' : ''} a shadow${age}`)
    }
    if (b.matricesOpen > 0) {
      const age = b.oldestMatrixMs != null ? ` (oldest ${describeBacklogAge(b.oldestMatrixMs)})` : ''
      parts.push(`${b.matricesOpen} price matri${b.matricesOpen === 1 ? 'x' : 'ces'} queued${age}`)
    }
    const names = [b.firstBid, b.firstMatrix ? `${b.firstMatrix} matrix` : null].filter(Boolean).join(' · ')
    const stuck = b.matricesStuck > 0 ? `${b.matricesStuck === 1 ? 'A matrix has' : `${b.matricesStuck} matrices have`} been working with no heartbeat for over an hour, or sit blocked. ` : b.requestOverdue ? 'A bid request has waited over a week. ' : ''
    items.push({
      key: 'robot-backlog',
      severity: stuck ? 'amber' : 'blue',
      kicker: 'Robots',
      title: 'Robots have work waiting',
      detail: `${stuck}${parts.join(' · ')}${names ? ` — ${names}.` : '.'}`,
      figure: String(b.bidsWaiting + b.matricesOpen),
      actionLabel: 'Open the Console',
      secondary: [
        { key: 'snooze', label: 'Snooze 24h' },
        { key: 'dismiss', label: 'Dismiss until count increases' },
      ],
    })
  }

  if (inputs.testReportsEnabled && inputs.testReportsReady && inputs.testReportsReady.ready + inputs.testReportsReady.incomplete > 0) {
    const t = inputs.testReportsReady
    const total = t.ready + t.incomplete
    const names = t.jobLabels.join(' · ')
    const detail =
      t.ready > 0
        ? `${t.ready === 1 ? 'One is' : `${t.ready} are`} filled in — open, glance at the paper, Send to the GC with the pay link.${t.incomplete > 0 ? ` ${t.incomplete} more still need${t.incomplete === 1 ? 's' : ''} a verdict or findings.` : ''}${names ? ` — ${names}.` : ''}`
        : `${total === 1 ? 'It needs' : 'They need'} a verdict or findings before ${total === 1 ? 'it' : 'they'} can go out.${names ? ` — ${names}.` : ''}`
    items.push({
      key: 'test-reports-ready',
      severity: t.ready > 0 ? 'blue' : 'gray',
      kicker: 'Test reports',
      title: t.ready > 0 ? `${t.ready} test report${t.ready === 1 ? ' is' : 's are'} ready to send` : `${total} test report${total === 1 ? '' : 's'} waiting on a verdict`,
      detail,
      figure: String(total),
      actionLabel: t.first ? `Open ${t.first.jobLabel}` : 'Open',
    })
  }

  return rankNeedsYouItems(visibleNeedsYouItems(items, inputs.role))
}

/**
 * `ui_nav_clicks` target for a Needs You action (v2.2896): `#<key>`, plus
 * `&dest=<n>` when the destination will show a different number than the card
 * (`destinationFigure`). One row per click; the count on it is the one the
 * user is about to see, so card-vs-page drift is measurable after the fact.
 */
export function needsYouClickTarget(item: Pick<NeedsYouItem, 'key' | 'figure' | 'destinationFigure'>): string {
  const dest = item.destinationFigure
  return dest != null && dest !== item.figure ? `#${item.key}&dest=${dest}` : `#${item.key}`
}

/** localStorage key for the per-user Cards/Walk preference. */
export function needsYouModeStorageKey(userId: string): string {
  return `pipetooling_needs_you_mode_${userId}`
}

export type NeedsYouMode = 'cards' | 'walk'

export function readNeedsYouMode(userId: string | null | undefined): NeedsYouMode {
  if (!userId || typeof window === 'undefined') return 'cards'
  try {
    return localStorage.getItem(needsYouModeStorageKey(userId)) === 'walk' ? 'walk' : 'cards'
  } catch {
    return 'cards'
  }
}

export function writeNeedsYouMode(userId: string | null | undefined, mode: NeedsYouMode): void {
  if (!userId || typeof window === 'undefined') return
  try {
    localStorage.setItem(needsYouModeStorageKey(userId), mode)
  } catch {
    /* per-device nicety only */
  }
}
