/** Settings → Your account: salary-workday + time-off sections (render outside the SettingsGroup,
 * conditional-mount). Presentational; all state/handlers live in the parent and arrive as props.
 * The shared activeSettingsTab/authUser gate stays in the parent; the dev/self-salaried sub-gate
 * is preserved inside. */
import type { Dispatch, SetStateAction } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import type { PayConfigRow } from '../../types/peoplePayConfig'
import type { SalariedWorkdayPickerRow } from '../../lib/buildSalariedWorkdayPickerRows'
import { SalaryWorkScheduleSettings } from '../SalaryWorkScheduleSettings'
import { TimeOffSettings } from '../TimeOffSettings'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type SettingsAccountSchedulingTabProps = {
  allSalariedDevNarrowViewport: boolean
  allSalariedDevSectionOpen: boolean
  authUser: { id: string }
  devPayConfigForSalaried: Record<string, PayConfigRow> | null
  devPayConfigLoading: boolean
  devSalariedPickerRows: SalariedWorkdayPickerRow[]
  devSalariedSelectedPayName: string
  devSalariedSelectedUserId: string | null
  myProfileName: string
  myRole: UserRole | null
  salaryWorkdaySectionOpen: boolean
  selfIsSalariedInPayConfig: boolean
  selfPaySalaryLoaded: boolean
  setAllSalariedDevSectionOpen: Dispatch<SetStateAction<boolean>>
  setDevSalariedSelectedUserId: Dispatch<SetStateAction<string | null>>
  setSalaryWorkdaySectionOpen: Dispatch<SetStateAction<boolean>>
  setTimeOffSectionOpen: Dispatch<SetStateAction<boolean>>
  timeOffSectionOpen: boolean
}

export default function SettingsAccountSchedulingTab({
  allSalariedDevNarrowViewport,
  allSalariedDevSectionOpen,
  authUser,
  devPayConfigForSalaried,
  devPayConfigLoading,
  devSalariedPickerRows,
  devSalariedSelectedPayName,
  devSalariedSelectedUserId,
  myProfileName,
  myRole,
  salaryWorkdaySectionOpen,
  selfIsSalariedInPayConfig,
  selfPaySalaryLoaded,
  setAllSalariedDevSectionOpen,
  setDevSalariedSelectedUserId,
  setSalaryWorkdaySectionOpen,
  setTimeOffSectionOpen,
  timeOffSectionOpen,
}: SettingsAccountSchedulingTabProps) {
  return (
    <>
      {(myRole === 'dev' || (selfPaySalaryLoaded && selfIsSalariedInPayConfig)) && (
        <section
          id="settings-salary-workday"
          aria-labelledby={
            selfPaySalaryLoaded && selfIsSalariedInPayConfig
              ? 'settings-salary-workday-heading'
              : 'settings-all-salaried-dev-heading'
          }
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
            <div
              style={{
                marginTop: selfPaySalaryLoaded && selfIsSalariedInPayConfig ? '1rem' : 0,
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-subtle)',
                maxHeight: 'min(70vh, 720px)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              <button
                type="button"
                id="settings-all-salaried-dev-heading"
                aria-expanded={allSalariedDevSectionOpen}
                aria-controls="settings-all-salaried-dev-panel"
                onClick={() => setAllSalariedDevSectionOpen((prev) => !prev)}
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
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '0.75rem' }} aria-hidden>
                  {allSalariedDevSectionOpen ? '▼' : '▶'}
                </span>
                All salaried users (dev)
              </button>
              {allSalariedDevSectionOpen && (
                <div
                  id="settings-all-salaried-dev-panel"
                  style={{
                    padding: '0 1rem 1rem 1rem',
                    borderTop: '1px solid var(--border)',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                  }}
                >
                  <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-600)' }}>
                    Edits apply to the <strong>selected</strong> user&apos;s workday template and day overrides, including salary
                    session sync — same as the salaried workday block above for your own account.
                  </p>
                  {devPayConfigLoading || devPayConfigForSalaried == null ? (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: allSalariedDevNarrowViewport ? 'column' : 'row',
                        gap: '0.75rem',
                        alignItems: 'stretch',
                        minHeight: 0,
                      }}
                    >
                      <div
                        style={{
                          flex: allSalariedDevNarrowViewport ? '0 0 auto' : '0 0 220px',
                          maxHeight: allSalariedDevNarrowViewport ? 'min(40vh, 280px)' : 'none',
                          overflow: 'auto',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: 'var(--bg-page)',
                        }}
                      >
                        {devSalariedPickerRows.length === 0 ? (
                          <p style={{ margin: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            No salaried people in pay config yet. Use the <strong>Pay</strong> tab to mark someone as Salary.
                          </p>
                        ) : (
                          <ul style={{ listStyle: 'none', margin: 0, padding: '0.35rem 0' }}>
                            {devSalariedPickerRows.map((r) => {
                              const uid = r.userId
                              const selectable = uid != null
                              const active = selectable && uid === devSalariedSelectedUserId
                              return (
                                <li key={r.personName}>
                                  <button
                                    type="button"
                                    disabled={!selectable}
                                    onClick={() => uid != null && setDevSalariedSelectedUserId(uid)}
                                    title={
                                      selectable
                                        ? undefined
                                        : 'No matching login user — pay name must match the user display name in Users.'
                                    }
                                    aria-current={active ? 'true' : undefined}
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      textAlign: 'left',
                                      padding: '0.45rem 0.65rem',
                                      border: 'none',
                                      borderBottom: '1px solid #f3f4f6',
                                      background: active ? 'var(--bg-blue-tint)' : 'transparent',
                                      color: selectable ? (active ? 'var(--text-blue-700)' : 'var(--text-strong)') : '#9ca3af',
                                      cursor: selectable ? 'pointer' : 'not-allowed',
                                      fontSize: '0.875rem',
                                      fontWeight: active ? 600 : 400,
                                    }}
                                  >
                                    {r.personName}
                                    {!selectable ? (
                                      <span
                                        style={{
                                          display: 'block',
                                          fontSize: '0.72rem',
                                          fontWeight: 400,
                                          color: 'var(--text-faint)',
                                          marginTop: 2,
                                        }}
                                      >
                                        No matching user
                                      </span>
                                    ) : null}
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          minHeight: 200,
                          overflow: 'auto',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '0.75rem 1rem',
                          background: 'var(--surface)',
                        }}
                      >
                        {devSalariedPickerRows.length === 0 ? null : devSalariedSelectedUserId &&
                          devSalariedSelectedPayName ? (
                          <SalaryWorkScheduleSettings
                            key={devSalariedSelectedUserId}
                            userId={devSalariedSelectedUserId}
                            userPayName={devSalariedSelectedPayName}
                            canEditPastDayOverrides
                          />
                        ) : (
                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                            Select someone with a matching login user to edit their salaried workday.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}
        <section
          id="settings-time-off"
          aria-labelledby="settings-time-off-heading"
          style={{ marginBottom: '2rem', scrollMarginTop: '0.75rem' }}
        >
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
            <button
              type="button"
              id="settings-time-off-heading"
              aria-expanded={timeOffSectionOpen}
              aria-controls="settings-time-off-panel"
              onClick={() => setTimeOffSectionOpen((prev) => !prev)}
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
                {timeOffSectionOpen ? '▼' : '▶'}
              </span>
              Unpaid time off
            </button>
            {timeOffSectionOpen && (
              <div id="settings-time-off-panel" style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
                <TimeOffSettings userId={authUser.id} />
              </div>
            )}
          </div>
        </section>
    </>
  )
}
