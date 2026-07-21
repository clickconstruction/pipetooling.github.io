import { useCallback, useState } from 'react'
import { DashboardMyInboxCard } from '../dashboard/DashboardMyInboxCard'
import { useAuth } from '../../hooks/useAuth'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useToastContext } from '../../contexts/ToastContext'
import { getCurrentUserName } from '../../lib/getCurrentUserName'
import type { ChecklistInstance } from '../../lib/dashboardBootTypes'

/**
 * Quickfill "My Inbox": thin adapter around the Dashboard's DashboardMyInboxCard —
 * the full checklist engine (toggles, forward, mute, completion notifications,
 * repeat scheduling) is reused, not rebuilt. Unlike Dashboard there is no boot
 * seam, so the card self-loads via `loadOnMount`. The card stays mounted even when
 * it self-hides (empty inbox) — unmounting it would stop it ever reporting visible
 * again — and this adapter shows a friendly empty line in its place.
 */
export function QuickfillMyInboxSection() {
  const { user: authUser, role } = useAuth()
  const narrow = useNarrowViewport640()
  const { showToast } = useToastContext()
  const [todayChecklist, setTodayChecklistRaw] = useState<ChecklistInstance[]>([])
  const [checklistLoading, setChecklistLoading] = useState(true)
  const [cardVisible, setCardVisible] = useState(true)

  // First data delivery from the card's own loadTodayChecklist ends the loading state.
  const setTodayChecklist = useCallback<React.Dispatch<React.SetStateAction<ChecklistInstance[]>>>(
    (action) => {
      setChecklistLoading(false)
      setTodayChecklistRaw(action)
    },
    [],
  )

  const setUserError = useCallback(
    (err: string | null) => {
      if (err) showToast(err, 'error')
    },
    [showToast],
  )

  const fetchCurrentUserName = useCallback(() => getCurrentUserName(authUser?.id), [authUser?.id])

  return (
    <>
      {!cardVisible && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', margin: '0.25rem 0 0' }}>
          Nothing in your inbox right now.
        </p>
      )}
      <DashboardMyInboxCard
        authUserId={authUser?.id}
        role={role}
        isMobile={narrow}
        todayChecklist={todayChecklist}
        setTodayChecklist={setTodayChecklist}
        checklistLoading={checklistLoading}
        userLoading={false}
        setUserError={setUserError}
        getCurrentUserName={fetchCurrentUserName}
        onVisibleChange={setCardVisible}
        loadOnMount
      />
    </>
  )
}
