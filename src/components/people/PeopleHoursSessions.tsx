import {
  AssignSessionJobPopover,
  ClockSessionsTable,
  ClockSessionsSection,
  formatClockSessionJobOrBidLabel,
  RejectedClockSessionsSection,
} from '../clock-sessions'
import { approveClockSessions } from '../../lib/approveClockSessions'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import type { ClockSessionRow } from '../../types/clockSessions'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import {
  HOURS_TAB_SECTION_CHEVRON,
  HOURS_TAB_SECTION_SHELL,
  HOURS_TAB_SECTION_TOGGLE_BTN,
  hoursTabSectionHeaderGap,
} from './peopleHoursTabShared'

export interface PeopleHoursSessionsProps {
  open: boolean
  onToggle: () => void
  canAccessPay: boolean
  authUserId: string | undefined
  activeClockSessions: ClockSessionRow[]
  activeClockSessionsFiltered: ClockSessionRow[]
  pendingApprovalClockSessions: ClockSessionRow[]
  pendingApprovalClockSessionsFiltered: ClockSessionRow[]
  approvedClockSessions: ClockSessionRow[]
  approvedClockSessionsFiltered: ClockSessionRow[]
  rejectedClockSessions: ClockSessionRow[]
  rejectedClockSessionsFiltered: ClockSessionRow[]
  hoursClockSessionsSearch: string
  setHoursClockSessionsSearch: (value: string) => void
  hoursClockSessionsSearching: boolean
  noClockSessionsMatchSearch: boolean
  showSalariedWorkdaysHoursButton: boolean
  onOpenSalariedWorkdays: () => void
  prefixMap: LedgerPrefixMap
  openHoursMyTimeFromSession: (session: ClockSessionRow) => void
  setEditClockSession: (session: ClockSessionRow | null) => void
  setError: (message: string | null) => void
  reloadSessions: () => void
  reloadHours: () => void
  rejectedSectionOpen: boolean
  onToggleRejected: () => void
}

export function PeopleHoursSessions({
  open,
  onToggle,
  canAccessPay,
  authUserId,
  activeClockSessions,
  activeClockSessionsFiltered,
  pendingApprovalClockSessions,
  pendingApprovalClockSessionsFiltered,
  approvedClockSessions,
  approvedClockSessionsFiltered,
  rejectedClockSessions,
  rejectedClockSessionsFiltered,
  hoursClockSessionsSearch,
  setHoursClockSessionsSearch,
  hoursClockSessionsSearching,
  noClockSessionsMatchSearch,
  showSalariedWorkdaysHoursButton,
  onOpenSalariedWorkdays,
  prefixMap,
  openHoursMyTimeFromSession,
  setEditClockSession,
  setError,
  reloadSessions,
  reloadHours,
  rejectedSectionOpen,
  onToggleRejected,
}: PeopleHoursSessionsProps) {
  const { showToast } = useToastContext()

  return (
    <section id="people-hours-sessions" style={HOURS_TAB_SECTION_SHELL}>
      <div style={hoursTabSectionHeaderGap(open)}>
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          style={HOURS_TAB_SECTION_TOGGLE_BTN}
        >
          <span aria-hidden style={HOURS_TAB_SECTION_CHEVRON}>{open ? '▼' : '▶'}</span>
          Clock sessions
        </button>
      </div>
      {open ? (
        <>
          <div style={{ marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="search"
              value={hoursClockSessionsSearch}
              onChange={(e) => setHoursClockSessionsSearch(e.target.value)}
              placeholder="Search name, notes, job/bid, date…"
              aria-label="Search clock sessions"
              style={{
                flex: '1 1 220px',
                minWidth: 160,
                padding: '0.35rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
              }}
            />
            {hoursClockSessionsSearching ? (
              <button
                type="button"
                onClick={() => setHoursClockSessionsSearch('')}
                style={{
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Clear
              </button>
            ) : null}
            {showSalariedWorkdaysHoursButton ? (
              <button
                type="button"
                onClick={onOpenSalariedWorkdays}
                style={{
                  marginLeft: 'auto',
                  padding: '0.35rem 0.65rem',
                  border: '1px solid #d1d5db',
                  borderRadius: 4,
                  background: '#f9fafb',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  flexShrink: 0,
                }}
              >
                Salaried workdays
              </button>
            ) : null}
          </div>
          {noClockSessionsMatchSearch ? (
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>No sessions match this search.</p>
          ) : null}
          <div style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
              {hoursClockSessionsSearching
                ? `Active clock sessions (${activeClockSessionsFiltered.length} of ${activeClockSessions.length} matching)`
                : `Active clock sessions (${activeClockSessions.length})`}
            </div>
            <ClockSessionsTable
              sessions={activeClockSessionsFiltered}
              showActionsColumn
              locationVariant="full"
              enableDurationColumnSort
              onDurationClick={openHoursMyTimeFromSession}
              emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : 'No active sessions'}
              renderNotesSecondary={(s) => {
                const label = formatClockSessionJobOrBidLabel(s, prefixMap)
                return label ? (
                  <span title={label.replace(/\n/g, ' ')} style={{ whiteSpace: 'pre-line' }}>
                    {label}
                  </span>
                ) : null
              }}
              renderJob={() => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }} />
              )}
              renderActions={(s) => {
                const personName = s.users?.name?.trim() ?? 'Unknown'
                return (
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditClockSession(s)
                        setError(null)
                      }}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Force clock out ${personName}?`)) return
                        const now = new Date().toISOString()
                        const { error } = await supabase.from('clock_sessions').update({ clocked_out_at: now }).eq('id', s.id)
                        if (error) setError(error.message)
                        else {
                          showToast?.('Session clocked out', 'success')
                          reloadSessions()
                        }
                      }}
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #dc2626', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                    >
                      Force clock out
                    </button>
                  </div>
                )
              }}
            />
          </div>
          <div style={{ marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
              {hoursClockSessionsSearching
                ? `Pending sessions (${pendingApprovalClockSessionsFiltered.length} of ${pendingApprovalClockSessions.length} matching)`
                : `Pending sessions (${pendingApprovalClockSessions.length})`}
            </div>
            <ClockSessionsTable
              sessions={pendingApprovalClockSessionsFiltered}
              showActionsColumn
              locationVariant="full"
              enableDurationColumnSort
              onDurationClick={openHoursMyTimeFromSession}
              emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : 'No sessions awaiting approval'}
              renderNotesSecondary={(s) => {
                const label = formatClockSessionJobOrBidLabel(s, prefixMap)
                return label ? (
                  <span title={label.replace(/\n/g, ' ')} style={{ whiteSpace: 'pre-line' }}>
                    {label}
                  </span>
                ) : null
              }}
              renderJob={(s) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                  <span style={{ flexShrink: 0 }}>
                    <AssignSessionJobPopover
                      session={s}
                      onSaved={() => {
                        showToast?.('Job assigned', 'success')
                        reloadSessions()
                      }}
                      onError={(msg) => setError(msg)}
                      dispatchScheduleAssigneeUserId={s.user_id}
                      dispatchScheduleWorkDateYmd={s.work_date}
                    />
                  </span>
                </div>
              )}
              renderActions={(s) => (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const { data, error } = await approveClockSessions([s.id])
                      if (error) { setError(error.message); return }
                      const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
                      const row = result[0]
                      if (row?.error_message) { setError(row.error_message); return }
                      showToast?.(`Approved ${row?.approved_count ?? 0} session(s)`, 'success')
                      reloadSessions()
                      reloadHours()
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #22c55e', borderRadius: 4, background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Reject this clock session?')) return
                      const { error } = await supabase.from('clock_sessions').update({ rejected_at: new Date().toISOString(), rejected_by: authUserId ?? null }).eq('id', s.id)
                      if (error) setError(error.message)
                      else { showToast?.('Session rejected', 'success'); reloadSessions() }
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #dc2626', borderRadius: 4, background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditClockSession(s)
                    }}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #d1d5db', borderRadius: 4, background: 'white', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                </div>
              )}
            />
          </div>
          <ClockSessionsSection
            title="Approved Sessions"
            sessions={approvedClockSessionsFiltered}
            enableDurationColumnSort
            onDurationClick={openHoursMyTimeFromSession}
            headerCountLabel={
              hoursClockSessionsSearching
                ? `${approvedClockSessionsFiltered.length} of ${approvedClockSessions.length} matching`
                : undefined
            }
            headerCount={hoursClockSessionsSearching ? undefined : approvedClockSessions.length}
            emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : 'No sessions'}
            collapsedByDefault
            showActionsColumn
            renderActions={(s) => (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm('Revoke this session? It will move back to Pending and remove its hours from Hours.')) return
                  const { data, error } = await supabase.rpc('revoke_clock_sessions', { p_session_ids: [s.id] })
                  if (error) { setError(error.message); return }
                  const result = (data ?? []) as Array<{ revoked_count: number; error_message: string | null }>
                  const row = result[0]
                  if (row?.error_message) { setError(row.error_message); return }
                  showToast?.(`Revoked ${row?.revoked_count ?? 0} session(s)`, 'success')
                  reloadSessions()
                  reloadHours()
                }}
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.8125rem', border: '1px solid #f59e0b', borderRadius: 4, background: '#fffbeb', color: '#d97706', cursor: 'pointer' }}
              >
                Revoke
              </button>
            )}
          />
          <div id="people-hours-rejected">
            <RejectedClockSessionsSection
              sessions={rejectedClockSessionsFiltered}
              headerCountLabel={
                hoursClockSessionsSearching
                  ? `${rejectedClockSessionsFiltered.length} of ${rejectedClockSessions.length} matching`
                  : undefined
              }
              headerCount={hoursClockSessionsSearching ? undefined : rejectedClockSessions.length}
              emptyMessage={hoursClockSessionsSearching ? 'No matching sessions' : undefined}
              onDeleted={() => reloadSessions()}
              onError={(message) => setError(message)}
              canDeleteRejectedSessions={canAccessPay}
              open={rejectedSectionOpen}
              onToggle={onToggleRejected}
              onEdit={(s) => {
                setEditClockSession(s)
              }}
            />
          </div>
        </>
      ) : null}
    </section>
  )
}
