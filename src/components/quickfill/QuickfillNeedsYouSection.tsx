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
    arBankUnallocatedCount,
    arBankEnabled,
    tallyStaleUnlinkedCount,
    tallyStaffStalePeopleCount,
    tallyStaffStaleTxCount,
    tallyStaffEligible,
    tallyMinAgeDays: TALLY_STALE_MIN_AGE_DAYS,
    lostBidNudge: lostBids.nudge,
    lostBidNudgeLoading: lostBids.loading,
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
