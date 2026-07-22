import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useDashboardBoot } from '../../hooks/useDashboardBoot'
import { useDispatchInbox } from '../../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { getCurrentUserName as getCurrentUserNameById } from '../../lib/getCurrentUserName'
import { DashboardMyInboxCard } from '../dashboard/DashboardMyInboxCard'
import { DashboardTeamsInboxCard } from '../dashboard/DashboardTeamsInboxCard'
import { DispatchDismissedItemsModal } from '../DispatchDismissedItemsModal'
import CreateTripChargeModal, { type CreateTripChargeTarget } from '../CreateTripChargeModal'

/**
 * Dispatch Mode → Inbox tab: My Inbox + the Teams Inbox (Dispatch + Estimator
 * sections) stacked in one scrollable page. All three reuse the Dashboard's
 * cards/hooks verbatim, so behavior (notes, dismiss, archive) is identical.
 */
export default function DispatchModeInbox() {
  const { user: authUser, role } = useAuth()
  const isMobile = useIsMobile()
  const jobFormModal = useJobFormModal()

  const {
    todayChecklist,
    setTodayChecklist,
    setUserError,
    userLoading,
    checklistLoading,
  } = useDashboardBoot({ authUserId: authUser?.id })

  const dispatchInbox = useDispatchInbox()
  const estimatorInbox = useEstimatorInbox()
  const { dispatchInboxEligible, fetchDismissedDispatchInboxRows } = dispatchInbox
  const { estimatorInboxEligible } = estimatorInbox

  const [dismissedModalOpen, setDismissedModalOpen] = useState(false)
  const [tripChargeTarget, setTripChargeTarget] = useState<CreateTripChargeTarget | null>(null)

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-strong)', textAlign: 'center' }}>
        Inbox
      </h1>
      <DashboardMyInboxCard
        authUserId={authUser?.id}
        role={role}
        isMobile={isMobile}
        todayChecklist={todayChecklist}
        setTodayChecklist={setTodayChecklist}
        checklistLoading={checklistLoading}
        userLoading={userLoading}
        setUserError={setUserError}
        getCurrentUserName={() => getCurrentUserNameById(authUser?.id)}
        onVisibleChange={() => {}}
        loadOnMount
      />
      {dispatchInboxEligible || estimatorInboxEligible ? (
        <DashboardTeamsInboxCard
          dispatchInbox={dispatchInbox}
          estimatorInbox={estimatorInbox}
          showHelpFeedback={false}
          onOpenDismissedArchive={() => setDismissedModalOpen(true)}
          onLinkJobPictures={
            jobFormModal
              ? (jobId) => jobFormModal.openEditJob(jobId, { jobPicturesLinkHighlight: true })
              : undefined
          }
          onCreateTripCharge={(args) => setTripChargeTarget(args)}
        />
      ) : (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          No team inboxes for your role.
        </p>
      )}
      {dismissedModalOpen ? (
        <DispatchDismissedItemsModal
          open={dismissedModalOpen}
          onClose={() => setDismissedModalOpen(false)}
          loadRows={fetchDismissedDispatchInboxRows}
        />
      ) : null}
      {tripChargeTarget ? (
        <CreateTripChargeModal
          target={tripChargeTarget}
          onClose={() => setTripChargeTarget(null)}
          onCreated={() => setTripChargeTarget(null)}
        />
      ) : null}
    </div>
  )
}
