import type { ReactNode } from 'react'
import { formatClockSessionJobOrBidLabel, type ClockSessionRow } from '../../types/clockSessions'
import { ClockSessionLocationCell } from './ClockSessionLocationCell'

const thStyle = { padding: '0.35rem 0.5rem', textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb' }
const tdStyle = { padding: '0.35rem 0.5rem' }

type ClockSessionsTableProps = {
  sessions: ClockSessionRow[]
  showActionsColumn?: boolean
  renderActions?: (session: ClockSessionRow) => ReactNode
  renderJob?: (session: ClockSessionRow) => ReactNode
  renderNotesSecondary?: (session: ClockSessionRow) => ReactNode
  renderDuration?: (session: ClockSessionRow) => ReactNode
  locationVariant?: 'compact' | 'full'
  emptyMessage?: string
}

const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
/** Short date + time without seconds (locale-aware). */
const accountabilityDateTimeOpts: Intl.DateTimeFormatOptions = {
  dateStyle: 'short',
  timeStyle: 'short',
}

function formatAccountabilityTimestamp(d: Date): string {
  return d.toLocaleString(undefined, accountabilityDateTimeOpts)
}

/** Weekday + MM/DD (en-US), e.g. "Monday 02/22" — for Clock activity / My Team tables. */
export function formatClockActivityWorkDayLabel(workDate: string): string {
  const d = new Date(workDate + 'T12:00:00')
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const md = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
  return `${weekday} ${md}`
}

/** Elapsed hours from clock-in to clock-out, or to now if still clocked in (same as duration cells). */
export function sessionDecimalHours(s: ClockSessionRow): number {
  const inDate = new Date(s.clocked_in_at)
  const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date()
  return (outDate.getTime() - inDate.getTime()) / (1000 * 3600)
}

function defaultRenderDuration(s: ClockSessionRow): ReactNode {
  const hrs = sessionDecimalHours(s)
  const isActive = s.clocked_out_at == null
  const inDate = new Date(s.clocked_in_at)
  const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date()
  const inStr = inDate.toLocaleTimeString(undefined, timeOpts)
  const outStr = isActive ? '—' : outDate.toLocaleTimeString(undefined, timeOpts)
  const durationStr = `${hrs.toFixed(2)}h`
  return (
    <>
      {inStr} | {outStr} | <span style={{ fontWeight: 600 }}>{durationStr}</span>
    </>
  )
}

/** Same math as defaultRenderDuration; order: duration | clock-in | clock-out (My Team Clock activity). */
export function renderDurationDurationFirst(s: ClockSessionRow): ReactNode {
  const hrs = sessionDecimalHours(s)
  const isActive = s.clocked_out_at == null
  const inDate = new Date(s.clocked_in_at)
  const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date()
  const inStr = inDate.toLocaleTimeString(undefined, timeOpts)
  const outStr = isActive ? '—' : outDate.toLocaleTimeString(undefined, timeOpts)
  const durationStr = `${hrs.toFixed(2)}h`
  return (
    <>
      <span style={{ fontWeight: 600 }}>{durationStr}</span> | {inStr} | {outStr}
    </>
  )
}

function formatAccountability(s: ClockSessionRow): string {
  if (s.approved_at && s.approved_by_user?.name) {
    const d = new Date(s.approved_at)
    return `Approved by ${s.approved_by_user.name.trim()} at\n${formatAccountabilityTimestamp(d)}`
  }
  if (s.rejected_at && s.rejected_by_user?.name) {
    const d = new Date(s.rejected_at)
    return `Rejected by ${s.rejected_by_user.name.trim()} at\n${formatAccountabilityTimestamp(d)}`
  }
  if (s.revoked_at && s.revoked_by_user?.name) {
    const d = new Date(s.revoked_at)
    return `Revoked by ${s.revoked_by_user.name.trim()} at\n${formatAccountabilityTimestamp(d)}`
  }
  return '—'
}

export function ClockSessionsTable({
  sessions,
  showActionsColumn = false,
  renderActions,
  renderJob,
  renderNotesSecondary,
  renderDuration = defaultRenderDuration,
  locationVariant = 'compact',
  emptyMessage = 'No sessions',
}: ClockSessionsTableProps) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: 'max-content', maxWidth: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead style={{ background: '#f3f4f6' }}>
          <tr>
            <th style={thStyle}>Person</th>
            <th style={thStyle}>Work day</th>
            <th style={thStyle}>Time & location</th>
            <th style={thStyle} colSpan={2} title="Notes and job or bid assignment">
              Notes &amp; job
            </th>
            <th style={thStyle}>Status</th>
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
              const jobLabel = formatClockSessionJobOrBidLabel(s)
              const jobTitle = jobLabel ?? undefined
              const jobDisplay = jobLabel ?? '—'
              const jobFromRender = renderJob?.(s)
              const jobCellContent = renderJob ? jobFromRender : jobDisplay
              /** When renderJob returns null, omit the inline job column (e.g. job shown only in notesSecondary). */
              const showInlineJobColumn = !renderJob || jobFromRender != null
              const notesSecondary = renderNotesSecondary?.(s)
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                  <td style={tdStyle}>{personName}</td>
                  <td style={tdStyle}>{formatClockActivityWorkDayLabel(s.work_date)}</td>
                  <td style={tdStyle}>
                    <div style={{ whiteSpace: 'nowrap' }}>{renderDuration(s)}</div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      <ClockSessionLocationCell
                        clockInLat={s.clock_in_lat}
                        clockInLng={s.clock_in_lng}
                        clockOutLat={s.clock_out_lat}
                        clockOutLng={s.clock_out_lng}
                        variant={locationVariant}
                      />
                    </div>
                  </td>
                  <td
                    colSpan={2}
                    style={{
                      ...tdStyle,
                      maxWidth: 480,
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }} title={s.notes || undefined}>
                        {s.notes || '—'}
                      </div>
                      {showInlineJobColumn ? (
                        <div
                          style={{
                            flexShrink: 0,
                            ...(renderJob
                              ? {}
                              : {
                                  maxWidth: 220,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap' as const,
                                }),
                          }}
                          title={renderJob ? undefined : jobTitle}
                        >
                          {jobCellContent}
                        </div>
                      ) : null}
                    </div>
                    {notesSecondary ? (
                      <div
                        style={{
                          marginTop: '0.25rem',
                          width: '100%',
                          fontSize: '0.8125rem',
                          color: '#6b7280',
                          overflowWrap: 'break-word',
                          wordBreak: 'break-word',
                        }}
                      >
                        {notesSecondary}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ ...tdStyle, fontSize: '0.8125rem', whiteSpace: 'pre-line', color: '#6b7280' }}>
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
