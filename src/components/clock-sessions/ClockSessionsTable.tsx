import type { ReactNode } from 'react'
import type { ClockSessionRow } from '../../types/clockSessions'
import { ClockSessionLocationCell } from './ClockSessionLocationCell'

const thStyle = { padding: '0.5rem 0.75rem', textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb' }
const tdStyle = { padding: '0.5rem 0.75rem' }

type ClockSessionsTableProps = {
  sessions: ClockSessionRow[]
  showActionsColumn?: boolean
  renderActions?: (session: ClockSessionRow) => ReactNode
  renderDuration?: (session: ClockSessionRow) => ReactNode
  locationVariant?: 'compact' | 'full'
  emptyMessage?: string
}

const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }

function defaultRenderDuration(s: ClockSessionRow): ReactNode {
  const inDate = new Date(s.clocked_in_at)
  const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date()
  const hrs = (outDate.getTime() - inDate.getTime()) / (1000 * 3600)
  const isActive = s.clocked_out_at == null
  const dateStr = new Date(s.work_date + 'T12:00:00').toLocaleDateString(undefined, dateOpts)
  return `${hrs.toFixed(2)}h | ${inDate.toLocaleTimeString(undefined, timeOpts)} | ${isActive ? '—' : outDate.toLocaleTimeString(undefined, timeOpts)} | ${dateStr}`
}

function formatAccountability(s: ClockSessionRow): string {
  if (s.approved_at && s.approved_by_user?.name) {
    const d = new Date(s.approved_at)
    return `Approved by ${s.approved_by_user.name.trim()} at ${d.toLocaleString()}`
  }
  if (s.rejected_at && s.rejected_by_user?.name) {
    const d = new Date(s.rejected_at)
    return `Rejected by ${s.rejected_by_user.name.trim()} at ${d.toLocaleString()}`
  }
  if (s.revoked_at && s.revoked_by_user?.name) {
    const d = new Date(s.revoked_at)
    return `Revoked by ${s.revoked_by_user.name.trim()} at ${d.toLocaleString()}`
  }
  return '—'
}

export function ClockSessionsTable({
  sessions,
  showActionsColumn = false,
  renderActions,
  renderDuration = defaultRenderDuration,
  locationVariant = 'compact',
  emptyMessage = 'No sessions',
}: ClockSessionsTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead style={{ background: '#f3f4f6' }}>
          <tr>
            <th style={thStyle}>Person</th>
            <th style={thStyle}>Duration | In | Out | Date</th>
            <th style={thStyle}>Notes</th>
            <th style={thStyle}>Job</th>
            <th style={thStyle}>Location</th>
            <th style={thStyle}>Action</th>
            {showActionsColumn && <th style={thStyle}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr>
              <td colSpan={showActionsColumn ? 7 : 6} style={{ ...tdStyle, color: '#6b7280', textAlign: 'center' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sessions.map((s) => {
              const personName = s.users?.name?.trim() ?? 'Unknown'
              const jobTitle = s.jobs_ledger
                ? `${s.jobs_ledger.hcp_number || '—'} · ${s.jobs_ledger.job_name || '—'}${s.jobs_ledger.job_address ? ` — ${s.jobs_ledger.job_address}` : ''}`
                : undefined
              const jobDisplay = s.jobs_ledger
                ? `${s.jobs_ledger.hcp_number || '—'} · ${s.jobs_ledger.job_name || '—'}${s.jobs_ledger.job_address ? ` — ${s.jobs_ledger.job_address}` : ''}`
                : '—'
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={tdStyle}>{personName}</td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{renderDuration(s)}</td>
                  <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.notes || undefined}>{s.notes || '—'}</td>
                  <td style={{ ...tdStyle, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={jobTitle}>{jobDisplay}</td>
                  <td style={{ ...tdStyle, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                    <ClockSessionLocationCell
                      clockInLat={s.clock_in_lat}
                      clockInLng={s.clock_in_lng}
                      clockOutLat={s.clock_out_lat}
                      clockOutLng={s.clock_out_lng}
                      variant={locationVariant}
                    />
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8125rem', whiteSpace: 'nowrap', color: '#6b7280' }}>
                    {formatAccountability(s)}
                  </td>
                  {showActionsColumn && (
                    <td style={tdStyle}>
                      {renderActions?.(s)}
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
