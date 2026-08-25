import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useDashboardBoot } from '../../hooks/useDashboardBoot'
import { useDispatchInbox } from '../../hooks/useDispatchInbox'
import { useEstimatorInbox } from '../../hooks/useEstimatorInbox'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { getCurrentUserName as getCurrentUserNameById } from '../../lib/getCurrentUserName'
import { DashboardMyInboxCard } from '../dashboard/DashboardMyInboxCard'
import { DashboardPinnedQuickRow } from '../dashboard/DashboardPinnedQuickRow'
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

  const jobDetailModal = useJobDetailModal()
  const dispatchInbox = useDispatchInbox()
  const estimatorInbox = useEstimatorInbox()
  const { dispatchInboxEligible, fetchDismissedDispatchInboxRows } = dispatchInbox
  const { estimatorInboxEligible } = estimatorInbox

  const [dismissedModalOpen, setDismissedModalOpen] = useState(false)
  const [tripChargeTarget, setTripChargeTarget] = useState<CreateTripChargeTarget | null>(null)

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Title rides the header row's dead space (v2.2279), matching Customers (v2.2277). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <a
          href="https://mail.google.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.85rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            color: 'inherit',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor" aria-hidden="true">
            <path d="M112 128C85.5 128 64 149.5 64 176L64 183.6C64 199.1 71.5 213.6 84.1 222.7L294.9 375.1C309.9 385.9 330.2 385.9 345.2 375.1L556 222.7C568.5 213.6 576 199.1 576 183.6L576 176C576 149.5 554.5 128 528 128L112 128zM64 260.3L64 464C64 490.5 85.5 512 112 512L528 512C554.5 512 576 490.5 576 464L576 260.3L373.2 406.9C341.4 429.9 298.5 429.9 266.7 406.9L64 260.3z" />
          </svg>
          Open Gmail
        </a>
        <h1 style={{ margin: '0 0 0 auto', fontSize: '1.1rem', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>
          Inbox
        </h1>
      </div>
      {/* The Dashboard's notification banners (stale tally, AR unallocated, lost-bid
          reasons, bulk-delete/dev alerts …) — bannersOnly skips pins/quick actions. */}
      <DashboardPinnedQuickRow
        authUserId={authUser?.id}
        role={role}
        visiblePins={[]}
        quickActionDefs={[]}
        quickButtonsPlacement="top"
        showDashboardQuickButtons={false}
        costMatrixTotal={null}
        billedCount={null}
        billedTotal={null}
        supplyHousesAPTotal={null}
        subLaborDueTotal={null}
        renderModals
        bannersOnly
      />
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
          onOpenSupplyHouseShare={
            jobDetailModal
              ? (jobId) => jobDetailModal.openJobDetail({ jobId, openSupplyHouseShare: true })
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
