import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { TALLY_STALE_MIN_AGE_DAYS } from '../../lib/tallyStaleMinAgeDays'
import { useTallyUnlinkedCounts } from '../../hooks/useTallyUnlinkedCounts'
import {
  canRoleSeeArBankUnallocatedDashboardBanner,
  useArBankUnallocatedCount,
} from '../../hooks/useArBankUnallocatedCount'
import { useStaleTallyStaffFollowUp } from '../../hooks/useStaleTallyStaffFollowUp'
import { useLostBidNudge } from '../../hooks/useLostBidNudge'
import { useTeamReviewsDue } from '../../hooks/useTeamReviewsDue'
import { useRoadmapNeedsNameNudges } from '../../hooks/useRoadmapNeedsNameNudges'
import { useBulkDeleteNudge } from '../../hooks/useBulkDeleteNudge'
import { CLAIM_DEV_LOOKBACK_DAYS, useClaimDevAttemptsNudge } from '../../hooks/useClaimDevAttemptsNudge'
import { useLienReleasesOwedNudge } from '../../hooks/useLienReleasesOwedNudge'
import { useDemandDeadlinesNudge } from '../../hooks/useDemandDeadlinesNudge'
import { useLienWatchNudge } from '../../hooks/useLienWatchNudge'
import { LABEL_APPROVALS_MIN_AGE_DAYS, usePendingLabelApprovalsNudge } from '../../hooks/usePendingLabelApprovalsNudge'
import { usePendingHrReportsNudge } from '../../hooks/usePendingHrReportsNudge'
import {
  DISPATCH_REQUEST_AGE,
  DISPATCH_REQUESTS_MIN_AGE_DAYS,
  HR_PENDING_REPORT_AGE,
  HR_REPORTS_MIN_AGE_DAYS,
} from '../../lib/ageState'
import type { DispatchAgingSummary } from '../../lib/dispatchInboxAging'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { buildNeedsYouItems } from '../../lib/dashboardNeedsYou'
import { roadmapPath } from '../../lib/roadmapVisibility'
import { DashboardNeedsYouCard } from '../dashboard/DashboardNeedsYouCard'
import { DashboardStaleTallyStaffFollowUpModal } from '../DashboardStaleTallyStaffFollowUpModal'
import { DashboardLienReleaseQueueModal } from '../dashboard/DashboardLienReleaseQueueModal'
import { DashboardArDepositsModal } from '../dashboard/DashboardArDepositsModal'

/**
 * Quickfill's "Needs you" station (v2.2350): the SAME card the Dashboard
 * renders (Cards / Walk-the-list, per-user toggle, `needs-you` telemetry —
 * from_path distinguishes the surface), fed by the same hooks and the same
 * pure item builder. As items migrate into the Needs You model, both surfaces
 * stay complete automatically. The card renders nothing when the list is
 * empty; the section's Mark button still stamps the ritual on a clean day.
 */
export function QuickfillNeedsYouSection({
  onCount,
  dispatchAged = null,
  onOpenDispatchInbox,
}: {
  onCount?: (n: number | null) => void
  /** Open dispatch requests past the min age (journey-map #40), summarised by the page from its inbox rows. */
  dispatchAged?: DispatchAgingSummary | null
  /** Expands + scrolls to this page's Dispatch inbox station. */
  onOpenDispatchInbox?: () => void
}) {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  /** "Match deposits" opens Accounts Receivable in place (Tier-2 #17) — the office keeps its Quickfill spot. */
  const [arDepositsModalOpen, setArDepositsModalOpen] = useState(false)
  // Same hook as the Dashboard card and the /tally header (v2.2896).
  const { unlinked: tallyUnlinkedCount, staleUnlinked: tallyStaleUnlinkedCount } = useTallyUnlinkedCounts(
    Boolean(authUser?.id) && role != null,
  )

  const arBankEnabled = Boolean(authUser?.id) && canRoleSeeArBankUnallocatedDashboardBanner(role)
  const { count: arBankUnallocatedCount, refetch: refetchArBankUnallocatedCount } = useArBankUnallocatedCount({
    enabled: arBankEnabled,
    authUserId: authUser?.id,
    authRole: role,
  })
  const {
    peopleCount: tallyStaffStalePeopleCount,
    transactionCount: tallyStaffStaleTxCount,
    refetch: refetchStaleTallyStaff,
  } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)
  const tallyStaffEligible = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const lostBids = useLostBidNudge(tallyStaffEligible)
  const { overdue: teamReviewsOverdue, cadenceDays: teamReviewCadenceDays } = useTeamReviewsDue(authUser?.id)
  const { nudges: roadmapNudges } = useRoadmapNeedsNameNudges(authUser?.id, role)
  const bulkDelete = useBulkDeleteNudge(authUser?.id)
  const claimDev = useClaimDevAttemptsNudge(authUser?.id)
  const lienUnconditionalEnabled = Boolean(authUser?.id) && tallyStaffEligible
  const { owed: lienUnconditionalOwed, queue: lienReleaseQueue, refetch: refetchLienReleasesOwed } = useLienReleasesOwedNudge(lienUnconditionalEnabled)
  const [lienReleaseQueueOpen, setLienReleaseQueueOpen] = useState(false)
  const { overdue: demandDeadlineOverdue } = useDemandDeadlinesNudge(lienUnconditionalEnabled)
  const { watch: lienWatch } = useLienWatchNudge(lienUnconditionalEnabled)
  // Bank-label approvals ARE close-ritual work (journey-map Tier-2 #27): the
  // same card the Dashboard shows, so the Quickfill twin never lags it.
  const labelApprovalsEnabled = Boolean(authUser?.id) && tallyStaffEligible
  const { approvals: labelApprovals } = usePendingLabelApprovalsNudge(labelApprovalsEnabled)
  const hrReportsEnabled = Boolean(authUser?.id) && role === 'dev'
  const { aged: hrReportsAged } = usePendingHrReportsNudge(hrReportsEnabled)

  const items = buildNeedsYouItems({
    role,
    // Division 22 is an estimator/dev dashboard item — Quickfill is the billing station.
    d22UncodedEnabled: false,
    d22UncodedCount: 0,
    arBankUnallocatedCount,
    arBankEnabled,
    tallyStaleUnlinkedCount,
    tallyUnlinkedCount,
    tallyStaffStalePeopleCount,
    tallyStaffStaleTxCount,
    tallyStaffEligible,
    tallyMinAgeDays: TALLY_STALE_MIN_AGE_DAYS,
    lostBidNudge: lostBids.nudge,
    lostBidNudgeLoading: lostBids.loading,
    teamReviewsOverdue,
    teamReviewCadenceDays,
    roadmapNudges,
    // Quickfill's dedicated Job follow-ups station (v2.2347) already carries
    // this queue — disabled here so the card doesn't list it twice on one page.
    jobFollowupsEnabled: false,
    jobFollowupCount: null,
    jobFollowupStageCounts: null,
    // Same for the GC weekly station (v2.2347) — the card stays out of its way.
    gcReviewEnabled: false,
    gcReviewStatus: null,
    gcReviewNudge: null,
    gcReviewIsWednesday: false,
    bulkDeleteAlerts: bulkDelete.visibleAlerts,
    claimDevRefusedCount: claimDev.visibleCount,
    claimDevLookbackDays: CLAIM_DEV_LOOKBACK_DAYS,
    // Robot audits stay a Dashboard concern — Quickfill is the billing desk.
    robotAuditsEnabled: false,
    robotAuditsPending: 0,
    // Unconditional follow-ups ARE billing-desk work (v2.2582).
    lienUnconditionalEnabled,
    lienUnconditionalOwed,
    demandDeadlineEnabled: lienUnconditionalEnabled,
    demandDeadlineOverdue,
    lienWatchEnabled: lienUnconditionalEnabled,
    lienWatch,
    // Hours approvals are people-desk work — a Dashboard concern, not billing.
    hoursApprovalsEnabled: false,
    hoursApprovals: null,
    hoursApprovalsMinAgeDays: 0,
    labelApprovalsEnabled,
    labelApprovals,
    labelApprovalsMinAgeDays: LABEL_APPROVALS_MIN_AGE_DAYS,
    // Aging queues (journey-map #40): the dispatch station is on this page; HR files from People.
    dispatchAgedEnabled: Boolean(authUser?.id) && onOpenDispatchInbox != null,
    dispatchAged,
    dispatchMinAgeDays: DISPATCH_REQUESTS_MIN_AGE_DAYS,
    dispatchRedDays: DISPATCH_REQUEST_AGE.redDays,
    hrReportsEnabled,
    hrReportsAged,
    hrReportsMinAgeDays: HR_REPORTS_MIN_AGE_DAYS,
    hrReportsRedDays: HR_PENDING_REPORT_AGE.redDays,
  })

  useEffect(() => {
    onCount?.(items.length)
  }, [items.length, onCount])

  return (
    <>
      <DashboardNeedsYouCard
        userId={authUser?.id}
        role={role}
        items={items}
        onAction={(item) => {
          if (item.key === 'ar-deposits') {
            setArDepositsModalOpen(true)
          } else if (item.key === 'tally-self') {
            navigate('/tally?tab=transactions')
          } else if (item.key === 'tally-team') {
            setStaffModalOpen(true)
          } else if (item.key === 'lost-bids') {
            navigate('/bids?tab=why-we-lost')
          } else if (item.key === 'team-reviews') {
            // Deep link (v2.1564): land the Rate deck ON the first due person.
            const first = teamReviewsOverdue[0]
            navigate(`/prospects?tab=team&stage=review${first ? `&rate=${first.id}` : ''}`)
          } else if (item.key === 'roadmap-needs-person') {
            const first = roadmapNudges[0]
            navigate(roadmapPath(first?.roadmapId, first ? 'plan' : null))
          } else if (item.key === 'bulk-delete') {
            navigate('/settings?tab=settings-data#settings-recently-deleted')
          } else if (item.key === 'claim-dev') {
            // The code form is on Settings → Advanced, not People (J27-F5).
            navigate('/settings?tab=settings-advanced-tools#settings-claim-code')
          } else if (item.key === 'lien-unconditional') {
            setLienReleaseQueueOpen(true)
          } else if (item.key === 'demand-deadline') {
            navigate('/jobs?tab=stages')
          } else if (item.key === 'lien-serve-copy' || item.key === 'lien-notice-window' || item.key === 'lien-file-window') {
            navigate('/jobs?tab=stages')
          } else if (item.key === 'label-approvals') {
            navigate('/banking?tab=accounting')
          } else if (item.key === 'dispatch-requests-aged') {
            onOpenDispatchInbox?.()
          } else if (item.key === 'hr-reports-pending') {
            navigate('/people?tab=hr')
          }
        }}
        onSecondary={(item, key) => {
          if (item.key === 'bulk-delete') {
            if (key === 'snooze') bulkDelete.snooze24h()
            else if (key === 'dismiss') bulkDelete.dismissUntilCountIncreases()
          } else if (item.key === 'claim-dev') {
            if (key === 'snooze') claimDev.snooze24h()
            else if (key === 'dismiss') claimDev.dismissUntilItHappensAgain()
          }
        }}
      />
      <DashboardLienReleaseQueueModal
        open={lienReleaseQueueOpen}
        onClose={() => setLienReleaseQueueOpen(false)}
        rows={lienReleaseQueue}
        onChanged={refetchLienReleasesOwed}
      />
      <DashboardArDepositsModal
        open={arDepositsModalOpen}
        onClose={() => {
          setArDepositsModalOpen(false)
          void refetchArBankUnallocatedCount()
        }}
      />
      <DashboardStaleTallyStaffFollowUpModal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
        onDataChanged={() => void refetchStaleTallyStaff()}
      />
    </>
  )
}
