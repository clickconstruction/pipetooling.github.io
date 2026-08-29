import type { UserRole } from '../hooks/useAuth'
import { formatLostBidNudgeValue, type LostBidNudge } from './dashboardLostBidNudge'
import { jobFollowupBreakdownPhrase, type JobFollowupStage } from './jobs/jobFollowupQueue'
import type { RoadmapNudge } from './dashboardRoadmapNudge'
import type { GcReviewNudgeState } from './jobs/gcReviewCertification'
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
 * bulk-delete in v2.2491 (red severity + secondary snooze/dismiss actions).
 * Still a banner below the card: claim-dev.
 *
 * Gating mirrors the banners it replaces exactly: an item appears only when its
 * banner would have rendered. Order is the old banner stack order (deposits,
 * own tally, team tally, lost bids, then the migrated banners in their old
 * below-the-card order) — "worst first" ranking can come once the money-figure
 * items (90+ tail etc.) join the list.
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
    | 'roadmap-needs-person'
    | 'job-followups'
    | 'gc-review-weekly'
    | 'bulk-delete'
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
  jobFollowupCount: number | null
  jobFollowupStageCounts: Record<JobFollowupStage, number> | null
  /**
   * Wednesday GC certification (v2.2490). Only the 'due' state becomes an
   * item; 'done' renders as a green notice outside the card. Quickfill passes
   * enabled=false — its dedicated GC weekly station already carries this.
   */
  gcReviewEnabled: boolean
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
}

export function buildNeedsYouItems(inputs: NeedsYouInputs): NeedsYouItem[] {
  const items: NeedsYouItem[] = []

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
    const preview = inputs.teamReviewsOverdue.slice(0, 3).map((u) => u.name).join(', ')
    const more = n > 3 ? ` +${n - 3} more` : ''
    items.push({
      key: 'team-reviews',
      severity: 'blue',
      kicker: 'Team reviews',
      title: 'Team reviews due',
      detail: `${n === 1 ? `${preview} hasn't` : `${preview}${more} haven't`} had your review in ${inputs.teamReviewCadenceDays}+ days — rate them on Team → Review.`,
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

  if (inputs.gcReviewEnabled && inputs.gcReviewStatus != null && inputs.gcReviewNudge === 'due') {
    const s = inputs.gcReviewStatus
    const remaining = Math.max(0, s.gcs_outstanding - s.gcs_certified)
    items.push({
      key: 'gc-review-weekly',
      severity: 'amber',
      kicker: 'Wednesday ritual',
      title: inputs.gcReviewIsWednesday ? 'GC review is due today' : 'GC review is still due this week',
      detail: `${s.gcs_certified} of ${s.gcs_outstanding} GCs certified · ${s.gcs_sent} statement${s.gcs_sent === 1 ? '' : 's'} sent — certify each group and send it off so every GC knows what they owe.`,
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

  return items
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
