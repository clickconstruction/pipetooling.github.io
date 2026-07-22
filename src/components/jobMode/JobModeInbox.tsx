import { useAuth } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useDashboardBoot } from '../../hooks/useDashboardBoot'
import { getCurrentUserName as getCurrentUserNameById } from '../../lib/getCurrentUserName'
import { DashboardMyInboxCard } from '../dashboard/DashboardMyInboxCard'
import SettingsRecentPushNotifications from '../settings/SettingsRecentPushNotifications'

/**
 * Job Mode → Inbox tab: the tech's own inbox only — their recent push
 * notifications plus the Dashboard's My Inbox card (no team inboxes).
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
      {authUser?.id ? (
        <section aria-label="My notifications">
          <SettingsRecentPushNotifications userId={authUser.id} />
        </section>
      ) : null}
    </div>
  )
}
