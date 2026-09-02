import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { TALLY_STALE_MIN_AGE_DAYS } from '../../lib/tallyStaleMinAgeDays'
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
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { buildNeedsYouItems } from '../../lib/dashboardNeedsYou'
import { DashboardNeedsYouCard } from '../dashboard/DashboardNeedsYouCard'
import { DashboardStaleTallyStaffFollowUpModal } from '../DashboardStaleTallyStaffFollowUpModal'

/**
 * Quickfill's "Needs you" station (v2.2350): the SAME card the Dashboard
 * renders (Cards / Walk-the-list, per-user toggle, `needs-you` telemetry —
 * from_path distinguishes the surface), fed by the same hooks and the same
 * pure item builder. As items migrate into the Needs You model, both surfaces
 * stay complete automatically. The card renders nothing when the list is
 * empty; the section's Mark button still stamps the ritual on a clean day.
 */
export function QuickfillNeedsYouSection({ onCount }: { onCount?: (n: number | null) => void }) {
  const navigate = useNavigate()
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [tallyStaleUnlinkedCount, setTallyStaleUnlinkedCount] = useState<number | null>(null)

  const arBankEnabled = Boolean(authUser?.id) && canRoleSeeArBankUnallocatedDashboardBanner(role)
  const { count: arBankUnallocatedCount } = useArBankUnallocatedCount({
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
  const { owed: lienUnconditionalOwed } = useLienReleasesOwedNudge(lienUnconditionalEnabled)
  const { overdue: demandDeadlineOverdue } = useDemandDeadlinesNudge(lienUnconditionalEnabled)
  const { watch: lienWatch } = useLienWatchNudge(lienUnconditionalEnabled)

  const loadTallyStale = useCallback(async () => {
    if (!authUser?.id || role == null) return
    try {
      const n = await withSupabaseRetry(
        async () =>
          await supabase.rpc('count_unlinked_mercury_transactions_for_tally_stale', {
            min_age_days: TALLY_STALE_MIN_AGE_DAYS,
          }),
        'quickfill needs-you stale tally count',
      )
      setTallyStaleUnlinkedCount(typeof n === 'number' && Number.isFinite(n) ? n : 0)
    } catch {
      setTallyStaleUnlinkedCount(null)
    }
  }, [authUser?.id, role])

  useEffect(() => {
    void loadTallyStale()
  }, [loadTallyStale])

  const items = buildNeedsYouItems({
    role,
    // Division 22 is an estimator/dev dashboard item — Quickfill is the billing station.
    d22UncodedEnabled: false,
    d22UncodedCount: 0,
    arBankUnallocatedCount,
    arBankEnabled,
    tallyStaleUnlinkedCount,
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
            showToast('Opening Accounts Receivable…', 'info', 2800)
            navigate('/accounts-receivable')
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
            navigate(
              first
                ? `/checklist?tab=roadmap&roadmap=${encodeURIComponent(first.roadmapId)}&view=plan`
                : '/checklist?tab=roadmap',
            )
          } else if (item.key === 'bulk-delete') {
            navigate('/settings?tab=settings-data#settings-recently-deleted')
          } else if (item.key === 'claim-dev') {
            navigate('/settings?tab=settings-people')
          } else if (item.key === 'lien-unconditional') {
            navigate('/jobs?tab=stages')
          } else if (item.key === 'demand-deadline') {
            navigate('/jobs?tab=stages')
          } else if (item.key === 'lien-serve-copy' || item.key === 'lien-notice-window' || item.key === 'lien-file-window') {
            navigate('/jobs?tab=stages')
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
      <DashboardStaleTallyStaffFollowUpModal
        open={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
        onDataChanged={() => void refetchStaleTallyStaff()}
      />
    </>
  )
}
