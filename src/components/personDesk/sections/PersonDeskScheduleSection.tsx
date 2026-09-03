import { useState } from 'react'
import { UserDayScheduleSection } from '../../userReview/UserDayScheduleSection'
import { denverCalendarDayKey } from '../../../utils/dateUtils'
import { DeskEmpty, DeskSection } from '../personDeskShared'

/**
 * Schedule (PR 3): the User Review modal's day view rendered inline, so the
 * Desk holds the schedule half of a person too. Week / month stay behind the
 * header's Day · week · month button until the modal retires fully.
 */
export function PersonDeskScheduleSection({ userId, displayName }: { userId: string | null; displayName: string }) {
  const [workDateYmd, setWorkDateYmd] = useState(() => denverCalendarDayKey(Date.now()))
  const [open, setOpen] = useState(false)
  if (!userId) {
    return (
      <DeskSection title="Schedule">
        <DeskEmpty>Schedule blocks need a login account.</DeskEmpty>
      </DeskSection>
    )
  }
  return (
    <DeskSection title="Schedule">
      {open ? (
        <div style={{ padding: '0.4rem 0.5rem' }}>
          <UserDayScheduleSection userId={userId} displayName={displayName} workDateYmd={workDateYmd} onWorkDateYmdChange={setWorkDateYmd} onClose={() => setOpen(false)} titleId={`person-desk-schedule-${userId}`} />
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ margin: '0.5rem 0.7rem', alignSelf: 'flex-start', padding: '0.2rem 0.55rem', fontSize: '0.78125rem', fontWeight: 600, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontFamily: 'inherit' }}>
          Show today's schedule
        </button>
      )}
    </DeskSection>
  )
}
