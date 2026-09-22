/** Settings → Your account: salary-workday + time-off sections (render outside the SettingsGroup,
 * conditional-mount). Presentational; all state/handlers live in the parent and arrive as props.
 * The shared activeSettingsTab/authUser gate stays in the parent; the dev/self-salaried sub-gate
 * is preserved inside. */
import type { Dispatch, SetStateAction } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import { Link } from 'react-router-dom'
import { SalaryWorkScheduleSettings } from '../SalaryWorkScheduleSettings'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type SettingsAccountSchedulingTabProps = {
  authUser: { id: string }
  myProfileName: string
  myRole: UserRole | null
  salaryWorkdaySectionOpen: boolean
  selfIsSalariedInPayConfig: boolean
  selfPaySalaryLoaded: boolean
  setSalaryWorkdaySectionOpen: Dispatch<SetStateAction<boolean>>
}

export default function SettingsAccountSchedulingTab({
  authUser,
  myProfileName,
  myRole,
  salaryWorkdaySectionOpen,
  selfIsSalariedInPayConfig,
  selfPaySalaryLoaded,
  setSalaryWorkdaySectionOpen,
}: SettingsAccountSchedulingTabProps) {
  return (
    <>
      {(myRole === 'dev' || (selfPaySalaryLoaded && selfIsSalariedInPayConfig)) && (
        <section
          id="settings-salary-workday"
          aria-labelledby="settings-salary-workday-heading"
          style={{ marginBottom: '2rem', scrollMarginTop: '0.75rem' }}
        >
          {selfPaySalaryLoaded && selfIsSalariedInPayConfig && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
              <button
                type="button"
                id="settings-salary-workday-heading"
                aria-expanded={salaryWorkdaySectionOpen}
                aria-controls="settings-salary-workday-panel"
                onClick={() => setSalaryWorkdaySectionOpen((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  margin: 0,
                  padding: '1rem',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: 'var(--text-strong)',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '0.75rem' }} aria-hidden>
                  {salaryWorkdaySectionOpen ? '▼' : '▶'}
                </span>
                Salaried workday
              </button>
              {salaryWorkdaySectionOpen && (
                <div
                  id="settings-salary-workday-panel"
                  style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}
                >
                  <SalaryWorkScheduleSettings
                    userId={authUser.id}
                    userPayName={myProfileName.trim()}
                    canEditPastDayOverrides={
                      myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
                    }
                  />
                </div>
              )}
            </div>
          )}

          {myRole === 'dev' && (
            <div style={{ marginTop: selfPaySalaryLoaded && selfIsSalariedInPayConfig ? '1rem' : 0, border: '1px solid var(--border)', borderRadius: 8, padding: '0.85rem 1rem', display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Everyone&rsquo;s salaried workday</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                lives on{' '}
                <Link to="/people?tab=users&lens=pay" style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                  People → Users → Pay
                </Link>
                : the <em>Workday…</em> button on each salaried row (v2.3705).
              </span>
            </div>
          )}
        </section>
      )}
    </>
  )
}
