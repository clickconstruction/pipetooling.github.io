import type { UserRole } from '../hooks/useAuth'
import { formatLostBidNudgeValue, type LostBidNudge } from './dashboardLostBidNudge'
import { jobFollowupBreakdownPhrase, type JobFollowupStage } from './jobs/jobFollowupQueue'
import type { RoadmapNudge } from './dashboardRoadmapNudge'
import { gcReviewGcsToDo, type GcReviewNudgeState } from './jobs/gcReviewCertification'
import type { GcReviewWeekStatus } from './gcReviewCertifications'
import type { BulkDeleteAlert } from '../hooks/useBulkDeleteAlerts'
import { formatDispatchNoteDaysAgoShortPhrase } from '../utils/dispatchNoteDisplay'

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
export type NeedsYouSeverity = 'blue' | 'amber' | 'gray' | 'red'

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
    | 'lien-unconditional'
    | 'demand-deadline'
    | 'lien-serve-copy'
    | 'lien-notice-window'
    | 'lien-file-window'
    | 'd22-uncoded'
    | 'hours-approvals'
    | 'contract-missing'
    | 'contract-stale'
    | 'work-orders-unpriced'
  severity: NeedsYouSeverity
  /** Walk-mode eyebrow. */
  kicker: string
  title: string
  detail: string
  /** Right-aligned figure in cards mode (count or $), shown big in walk mode. */
  figure: string
  actionLabel: string
  /** Small link-style follow-ups (v2.2491) — e.g. snooze/dismiss on alert items. Parent dispatches by key. */
  secondary?: Array<{ key: string; label: string }>
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
  'ar-deposits': 10,
  'lien-unconditional': 20,
  'gc-review-weekly': 20,
  'tally-self': 30,
  'tally-team': 30,
  'job-followups': 40,
  'demand-deadline': 40,
  'lien-serve-copy': 10,
  'lien-notice-window': 40,
  'lien-file-window': 40,
  'team-reviews': 50,
  'statement-round': 30,
  'roadmap-needs-person': 50,
  'robot-audits': 50,
  'hours-approvals': 50,
  'contract-missing': 40,
  'contract-stale': 50,
  'work-orders-unpriced': 40,
  'lost-bids': 60,
  'd22-uncoded': 60,
}

/** "99+" reads as 100 so a capped figure still outranks anything two-digit. */
function figureValue(figure: string): number {
  const n = Number.parseInt(figure.replace(/[^0-9]/g, ''), 10)
  if (!Number.isFinite(n)) return 0
  return figure.endsWith('+') ? n + 1 : n
}

/** Stable worst-first sort — exported so surfaces that build items elsewhere can reuse it. */
export function rankNeedsYouItems(items: NeedsYouItem[]): NeedsYouItem[] {
  // Array.prototype.sort is stable, so equal (rank, figure) pairs keep build order.
  return [...items].sort((a, b) => {
    const rank = NEEDS_YOU_RANK[a.key] - NEEDS_YOU_RANK[b.key]
    if (rank !== 0) return rank
    return figureValue(b.figure) - figureValue(a.figure)
  })
}

export type NeedsYouInputs = {
  role: UserRole | null
  /** null while loading — a loading source contributes no item (same as the banners). */
  arBankUnallocatedCount: number | null
  arBankEnabled: boolean
  tallyStaleUnlinkedCount: number | null
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
   * without Roadmap-tab access or under the min-count threshold).
   */
  roadmapNudges: RoadmapNudge[]
  /**
   * Job Follow-Up Mode queue (v2.2487). Quickfill passes enabled=false — its
   * dedicated Job follow-ups station already carries this count.
   */
  jobFollowupsEnabled: boolean
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
   * audit isn't workable yet). Enabled for the auditing roles only.
   */
  robotAuditsEnabled: boolean
  /** Division 22 (v2.2627): dev + estimator only — the ledger-teaching roles. */
  d22UncodedEnabled: boolean
  d22UncodedCount: number
  robotAuditsPending: number
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

  if (inputs.lienWatchEnabled && (inputs.lienWatch?.noticeDue.length ?? 0) > 0) {
    const rows = inputs.lienWatch?.noticeDue ?? []
    const n = rows.length
    const total = rows.reduce((s, r) => s + r.openBalance, 0)
    const money = total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    const worst = rows.map((r) => r.deadline).sort()[0] ?? ''
    items.push({
      key: 'lien-notice-window',
      severity: 'amber',
      kicker: 'Lien deadlines',
      title: n === 1 ? `A lien notice window closes ${worst}` : `${n} lien notice windows close soon (first: ${worst})`,
      detail: `${money} open on unpaid sub job${n === 1 ? '' : 's'} with no § 53.056 notice recorded for the work month — after the 15th, lien rights on that month weaken. Send the notice from the job's lien instruments.`,
      figure: String(n),
      actionLabel: n === 1 ? 'Open the job' : 'Review them',
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
      detail: `${money} is still open and the § 53.052 affidavit window is closing — after it, the lien right on this work is gone. The affidavit is ready behind its gate on the job's lien instruments.`,
      figure: String(n),
      actionLabel: n === 1 ? 'Open the job' : 'Review them',
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
      detail: `Drafted${who} without a subcontract amount${oldestDays != null && oldestDays > 0 ? ` — the oldest ${oldestDays} day${oldestDays === 1 ? '' : 's'} ago` : ''}. Open the draft, type the price, send it for signature.`,
      figure: String(n),
      actionLabel: n === 1 ? 'Price it' : 'Price them',
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
        ' balance to apply — match to billed lines in Accounts Receivable.',
      figure: n > 99 ? '99+' : String(n),
      actionLabel: 'Match deposits',
    })
  }

  if (inputs.role != null && (inputs.tallyStaleUnlinkedCount ?? 0) > 0) {
    const n = inputs.tallyStaleUnlinkedCount as number
    items.push({
      key: 'tally-self',
      severity: 'amber',
      kicker: 'Your card purchases',
      title: n === 1 ? 'One purchase needs a job' : `${n} purchases need a job`,
      detail:
        (n === 1 ? `One purchase over ${inputs.tallyMinAgeDays} days old isn't` : `Purchases over ${inputs.tallyMinAgeDays} days old aren't`) +
        ' on a job yet — sort in Job Parts Tally.',
      figure: String(n),
      actionLabel: 'Open tally',
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
      title: count === 1 ? 'One lost bid has no reason recorded' : `${count} lost bids have no reason recorded`,
      detail:
        (value > 0 ? `${formatLostBidNudgeValue(value)} unexplained — ` : '') +
        'work them one GC call at a time on the Why we lost lens.',
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
      actionLabel: 'Open Team Review',
    })
  }

  if (inputs.roadmapNudges.length > 0) {
    const shown = inputs.roadmapNudges.slice(0, 3)
    const total = inputs.roadmapNudges.reduce((a, n) => a + n.needsName, 0)
    const single = shown.length === 1 ? shown[0] : undefined
    items.push({
      key: 'roadmap-needs-person',
      severity: 'amber',
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

  return rankNeedsYouItems(items)
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
