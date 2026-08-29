import type { UserRole } from '../hooks/useAuth'
import { formatLostBidNudgeValue, type LostBidNudge } from './dashboardLostBidNudge'
import { jobFollowupBreakdownPhrase, type JobFollowupStage } from './jobs/jobFollowupQueue'

/**
 * Needs You card (v2.2339, CX-audit Phase 3): the pure item builder behind the
 * dashboard's unified attention list. v1 consolidated the four hook-driven
 * banners (AR deposits, own stale tally, team stale tally, lost-bid reasons);
 * the self-gating banners fold in item-by-item — job follow-ups joined in
 * v2.2487. Still banners below the card: team reviews, roadmap needs-name,
 * GC weekly, bulk-delete, claim-dev.
 *
 * Gating mirrors the banners it replaces exactly: an item appears only when its
 * banner would have rendered. Order is the old banner stack order (deposits,
 * own tally, team tally, lost bids, then the migrated banners in their old
 * below-the-card order) — "worst first" ranking can come once the money-figure
 * items (90+ tail etc.) join the list.
 */

export type NeedsYouSeverity = 'blue' | 'amber' | 'gray'

export type NeedsYouItem = {
  /** Stable key — also the telemetry target (`#<key>`) and the action-dispatch handle. */
  key: 'ar-deposits' | 'tally-self' | 'tally-team' | 'lost-bids' | 'job-followups'
  severity: NeedsYouSeverity
  /** Walk-mode eyebrow. */
  kicker: string
  title: string
  detail: string
  /** Right-aligned figure in cards mode (count or $), shown big in walk mode. */
  figure: string
  actionLabel: string
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
   * Job Follow-Up Mode queue (v2.2487). Quickfill passes enabled=false — its
   * dedicated Job follow-ups station already carries this count.
   */
  jobFollowupsEnabled: boolean
  jobFollowupCount: number | null
  jobFollowupStageCounts: Record<JobFollowupStage, number> | null
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
