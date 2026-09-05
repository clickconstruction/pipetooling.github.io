import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useDashboardBoot } from '../../hooks/useDashboardBoot'
import { getCurrentUserName as getCurrentUserNameById } from '../../lib/getCurrentUserName'
import { DashboardMyInboxCard } from '../dashboard/DashboardMyInboxCard'
import { DashboardPinnedQuickRow } from '../dashboard/DashboardPinnedQuickRow'
import JobModeMyRequests from './JobModeMyRequests'

/**
 * Job Mode → Inbox tab: the tech's own inbox only — the Dashboard's My Inbox
 * card plus **My requests** (what they sent to Dispatch and what the office
 * answered; v2.2880). It used to mount the Settings push-log component
 * verbatim, which on day one said "No push notifications have been logged"
 * (J2-F4) and never showed a request's outcome.
 */
export default function JobModeInbox() {
  const { user: authUser, role } = useAuth()
  const isMobile = useIsMobile()
  const {
    todayChecklist,
    setTodayChecklist,
    setUserError,
    userLoading,
    checklistLoading,
  } = useDashboardBoot({ authUserId: authUser?.id })

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-strong)', textAlign: 'center' }}>
        Inbox
      </h1>
      {/* The Dashboard's notification banners (stale tally, AR unallocated, lost-bid
          reasons …) — hidden on the Job Mode Dashboard (hideBanners), shown here instead. */}
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
      {authUser?.id ? <JobModeMyRequests userId={authUser.id} /> : null}
    </div>
  )
}
