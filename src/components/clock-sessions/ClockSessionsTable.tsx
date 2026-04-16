import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
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
  /** People Hours: click Time & location header (or narrow toolbar) to sort by duration, longest first. */
  enableDurationColumnSort?: boolean
  /** People Hours: click bold duration to open My Time day editor for that user/day. */
  onDurationClick?: (session: ClockSessionRow) => void
}

const durationLinkButtonStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 'none',
  background: 'none',
  font: 'inherit',
  fontWeight: 600,
  color: '#2563eb',
  cursor: 'pointer',
  textDecoration: 'underline',
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

function compareSessionsByDurationDescThenClockInThenId(a: ClockSessionRow, b: ClockSessionRow): number {
  const d = sessionDecimalHours(b) - sessionDecimalHours(a)
  if (d !== 0) return d
  const ta = new Date(b.clocked_in_at).getTime() - new Date(a.clocked_in_at).getTime()
  if (ta !== 0) return ta
  return a.id.localeCompare(b.id)
}

function renderDurationBoldSegment(
  s: ClockSessionRow,
  durationStr: string,
  onDurationClick?: (session: ClockSessionRow) => void,
): ReactNode {
  if (onDurationClick && s.user_id?.trim()) {
    return (
      <button
        type="button"
        style={durationLinkButtonStyle}
        aria-label={`Open My Time editor for ${s.work_date}`}
        onClick={(e) => {
          e.stopPropagation()
          onDurationClick(s)
        }}
      >
        {durationStr}
      </button>
    )
  }
  return <span style={{ fontWeight: 600 }}>{durationStr}</span>
}

function renderDefaultDuration(s: ClockSessionRow, onDurationClick?: (session: ClockSessionRow) => void): ReactNode {
  const hrs = sessionDecimalHours(s)
  const isActive = s.clocked_out_at == null
  const inDate = new Date(s.clocked_in_at)
  const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date()
  const inStr = inDate.toLocaleTimeString(undefined, timeOpts)
  const outStr = isActive ? '—' : outDate.toLocaleTimeString(undefined, timeOpts)
  const durationStr = `${hrs.toFixed(2)}h`
  return (
    <>
      {inStr} | {outStr} | {renderDurationBoldSegment(s, durationStr, onDurationClick)}
    </>
  )
}

function renderDurationDurationFirstImpl(
  s: ClockSessionRow,
  onDurationClick?: (session: ClockSessionRow) => void,
): ReactNode {
  const hrs = sessionDecimalHours(s)
  const isActive = s.clocked_out_at == null
  const inDate = new Date(s.clocked_in_at)
  const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : new Date()
  const inStr = inDate.toLocaleTimeString(undefined, timeOpts)
  const outStr = isActive ? '—' : outDate.toLocaleTimeString(undefined, timeOpts)
  const durationStr = `${hrs.toFixed(2)}h`
  return (
    <>
      {renderDurationBoldSegment(s, durationStr, onDurationClick)} | {inStr} | {outStr}
    </>
  )
}

/** Same math as table default; order: duration | clock-in | clock-out (My Team Clock activity). */
export function renderDurationDurationFirst(s: ClockSessionRow): ReactNode {
  return renderDurationDurationFirstImpl(s, undefined)
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

function hasAccountabilityStatus(s: ClockSessionRow): boolean {
  return (
    !!(s.approved_at && s.approved_by_user?.name) ||
    !!(s.rejected_at && s.rejected_by_user?.name) ||
    !!(s.revoked_at && s.revoked_by_user?.name)
  )
}

/** Notes + optional inline job + secondary line (shared by table cell and mobile card). */
function ClockSessionNotesJobContent({
  s,
  renderJob,
  renderNotesSecondary,
}: {
  s: ClockSessionRow
  renderJob?: (session: ClockSessionRow) => ReactNode
  renderNotesSecondary?: (session: ClockSessionRow) => ReactNode
}) {
  const jobLabel = formatClockSessionJobOrBidLabel(s)
  const jobTitle = jobLabel ?? undefined
  const jobDisplay = jobLabel ?? '—'
  const jobFromRender = renderJob?.(s)
  const jobCellContent = renderJob ? jobFromRender : jobDisplay
  const showInlineJobColumn = !renderJob || jobFromRender != null
  const notesSecondary = renderNotesSecondary?.(s)
  return (
    <>
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
    </>
  )
}

function SessionTimeLocationBlock({
  s,
  renderDuration,
  locationVariant,
  timeWhiteSpace,
  tightGap,
  alignEnd,
}: {
  s: ClockSessionRow
  renderDuration: (session: ClockSessionRow) => ReactNode
  locationVariant: 'compact' | 'full'
  timeWhiteSpace: 'nowrap' | 'normal'
  /** Narrow mobile card only — tighter gap between duration and location lines. */
  tightGap?: boolean
  /** Mobile card header right column — full width + right-align wrapped lines. */
  alignEnd?: boolean
}) {
  const locationGap = tightGap ? '0.15rem' : '0.25rem'
  const endAlign = alignEnd ? { width: '100%', textAlign: 'right' as const } : {}
  return (
    <>
      <div style={{ whiteSpace: timeWhiteSpace, ...endAlign }}>{renderDuration(s)}</div>
      <div
        style={{
          marginTop: locationGap,
          fontSize: '0.8125rem',
          whiteSpace: timeWhiteSpace === 'nowrap' ? 'nowrap' : 'normal',
          ...endAlign,
        }}
      >
        <ClockSessionLocationCell
          clockInLat={s.clock_in_lat}
          clockInLng={s.clock_in_lng}
          clockOutLat={s.clock_out_lat}
          clockOutLng={s.clock_out_lng}
          clockInLocationSource={s.clock_in_location_source}
          clockOutLocationSource={s.clock_out_location_source}
          variant={locationVariant}
        />
      </div>
    </>
  )
}

function ClockSessionCard({
  s,
  renderDuration,
  locationVariant,
  renderJob,
  renderNotesSecondary,
  showActionsColumn,
  renderActions,
}: {
  s: ClockSessionRow
  renderDuration: (session: ClockSessionRow) => ReactNode
  locationVariant: 'compact' | 'full'
  renderJob?: (session: ClockSessionRow) => ReactNode
  renderNotesSecondary?: (session: ClockSessionRow) => ReactNode
  showActionsColumn: boolean
  renderActions?: (session: ClockSessionRow) => ReactNode
}) {
  const personName = s.users?.name?.trim() ?? 'Unknown'
  const showStatusBlock = hasAccountabilityStatus(s)
  return (
    <div
      style={{
        marginBottom: '0.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      <div style={{ padding: '0.4rem 0.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{personName}</div>
            <div style={{ fontSize: '0.8125rem', color: '#374151', marginTop: '0.25rem' }}>
              {formatClockActivityWorkDayLabel(s.work_date)}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              flex: '0 1 58%',
              maxWidth: '58%',
              minWidth: 0,
              textAlign: 'right',
            }}
          >
            <SessionTimeLocationBlock
              s={s}
              renderDuration={renderDuration}
              locationVariant={locationVariant}
              timeWhiteSpace="normal"
              tightGap
              alignEnd
            />
          </div>
        </div>
      </div>
      <div
        style={{
          padding: '0.5rem',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          maxWidth: '100%',
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        }}
      >
        <ClockSessionNotesJobContent s={s} renderJob={renderJob} renderNotesSecondary={renderNotesSecondary} />
        {showStatusBlock ? (
          <div
            style={{
              marginTop: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid #e5e7eb',
              fontSize: '0.8125rem',
              whiteSpace: 'pre-line',
              color: '#6b7280',
            }}
          >
            {formatAccountability(s)}
          </div>
        ) : null}
        {showActionsColumn ? (
          <div
            style={{
              marginTop: '0.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              gap: '0.35rem',
              width: '100%',
              ...(showStatusBlock
                ? {}
                : {
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #e5e7eb',
                  }),
            }}
          >
            {renderActions?.(s)}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function ClockSessionsTable({
  sessions,
  showActionsColumn = false,
  renderActions,
  renderJob,
  renderNotesSecondary,
  renderDuration: renderDurationProp,
  locationVariant = 'compact',
  emptyMessage = 'No sessions',
  enableDurationColumnSort = false,
  onDurationClick,
}: ClockSessionsTableProps) {
  const [durationSortActive, setDurationSortActive] = useState(false)

  const displaySessions = useMemo(() => {
    if (!enableDurationColumnSort || !durationSortActive) return sessions
    return [...sessions].sort(compareSessionsByDurationDescThenClockInThenId)
  }, [sessions, enableDurationColumnSort, durationSortActive])

  const renderDurationForTable = useMemo(() => {
    if (renderDurationProp != null) return renderDurationProp
    return (s: ClockSessionRow) => renderDefaultDuration(s, onDurationClick)
  }, [renderDurationProp, onDurationClick])

  const renderDurationForNarrow = useMemo(() => {
    if (renderDurationProp != null) return renderDurationProp
    return (s: ClockSessionRow) => renderDurationDurationFirstImpl(s, onDurationClick)
  }, [renderDurationProp, onDurationClick])

  const isNarrow = useNarrowViewport640()

  if (isNarrow) {
    return (
      <div style={{ fontSize: '0.875rem' }}>
        {enableDurationColumnSort && sessions.length > 0 ? (
          <div style={{ marginBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setDurationSortActive((p) => !p)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.8125rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: durationSortActive ? '#eff6ff' : 'white',
                cursor: 'pointer',
                color: '#374151',
              }}
            >
              {durationSortActive ? 'Default order' : 'Sort by duration (longest first)'}
            </button>
          </div>
        ) : null}
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '0.5rem',
              color: '#6b7280',
              textAlign: 'center',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          displaySessions.map((s) => (
            <ClockSessionCard
              key={s.id}
              s={s}
              renderDuration={renderDurationForNarrow}
              locationVariant={locationVariant}
              renderJob={renderJob}
              renderNotesSecondary={renderNotesSecondary}
              showActionsColumn={showActionsColumn}
              renderActions={renderActions}
            />
          ))
        )}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: 'max-content', maxWidth: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead style={{ background: '#f3f4f6' }}>
          <tr>
            <th style={thStyle}>Person</th>
            <th style={thStyle}>Work day</th>
            <th
              style={thStyle}
              aria-sort={enableDurationColumnSort && durationSortActive ? 'descending' : undefined}
            >
              {enableDurationColumnSort ? (
                <button
                  type="button"
                  onClick={() => setDurationSortActive((p) => !p)}
                  title="Toggle sort by session duration (longest first)"
                  style={{
                    margin: 0,
                    padding: 0,
                    border: 'none',
                    background: 'none',
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  Time & location
                  {durationSortActive ? <span aria-hidden="true">{'\u25bc'}</span> : null}
                </button>
              ) : (
                'Time & location'
              )}
            </th>
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
            displaySessions.map((s) => {
              const personName = s.users?.name?.trim() ?? 'Unknown'
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                  <td style={tdStyle}>{personName}</td>
                  <td style={tdStyle}>{formatClockActivityWorkDayLabel(s.work_date)}</td>
                  <td style={tdStyle}>
                    <SessionTimeLocationBlock
                      s={s}
                      renderDuration={renderDurationForTable}
                      locationVariant={locationVariant}
                      timeWhiteSpace="nowrap"
                    />
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
                    <ClockSessionNotesJobContent s={s} renderJob={renderJob} renderNotesSecondary={renderNotesSecondary} />
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
