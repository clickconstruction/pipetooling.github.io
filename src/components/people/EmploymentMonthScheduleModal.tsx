import { useEffect, useState } from 'react'
import { UserMonthScheduleSection } from '../userReview/UserMonthScheduleSection'
import { PERSON_MONTH_SCHEDULE_WINDOW_DAYS } from '../../hooks/usePersonMonthScheduleData'
import { denverCalendarDayKey, ymdAddDays } from '../../utils/dateUtils'

const MODAL_Z = 1200
const TITLE_ID = 'employment-month-schedule-title'

export type EmploymentMonthScheduleModalProps = {
  userId: string
  displayName: string
  onClose: () => void
}

/**
 * Near-fullscreen host for `UserMonthScheduleSection`, opened from the Employment tab's
 * detail header. Defaults to the COMING month (window starts today) — the User Review
 * modal's month mode looks back instead — and pages ±30 days via the section's chevrons.
 */
export function EmploymentMonthScheduleModal({ userId, displayName, onClose }: EmploymentMonthScheduleModalProps) {
  // Window is [anchor − 29, anchor], so anchoring 29 days out makes it start today.
  const [anchorYmd, setAnchorYmd] = useState(() =>
    ymdAddDays(denverCalendarDayKey(Date.now()), PERSON_MONTH_SCHEDULE_WINDOW_DAYS - 1),
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: MODAL_Z,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          width: 'min(96vw, 1400px)',
          height: 'min(94vh, 1100px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <UserMonthScheduleSection
          userId={userId}
          displayName={displayName}
          anchorYmd={anchorYmd}
          onAnchorYmdChange={setAnchorYmd}
          onClose={onClose}
          titleId={TITLE_ID}
        />
      </div>
    </div>
  )
}
