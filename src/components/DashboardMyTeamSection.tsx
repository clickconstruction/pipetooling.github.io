import { Fragment, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { approveClockSessions } from '../lib/approveClockSessions'
import { supabase } from '../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { DashboardMyTeamSectionState } from '../hooks/useDashboardMyTeamSectionState'
import {
  AssignSessionJobPopover,
  ClockSessionsTable,
  formatClockActivityWorkDayLabel,
  formatClockSessionJobOrBidLabel,
  renderDurationDurationFirst,
  sessionDecimalHours,
} from './clock-sessions'
import type { ClockSessionRow } from '../types/clockSessions'

function formatDecimalHours(hours: number): string {
  return `${hours.toFixed(2)}h`
}

const teamHoursThStyle = {
  padding: '0.35rem 0.5rem',
  textAlign: 'left' as const,
  borderBottom: '1px solid #e5e7eb',
}
const teamHoursTdStyle = { padding: '0.35rem 0.5rem' }
const teamHoursTdNum = { ...teamHoursTdStyle, textAlign: 'right' as const }

const peopleYouLeadThStyle = {
  padding: '0.35rem 0.5rem',
  textAlign: 'left' as const,
  borderBottom: '1px solid #e5e7eb',
}
const peopleYouLeadMutedColor = { color: '#6b7280' as const }
const peopleYouLeadThMutedLabel = {
  ...peopleYouLeadMutedColor,
  fontWeight: 500 as const,
}
const peopleYouLeadTdStyle = { padding: '0.35rem 0.5rem' }
const peopleYouLeadTdNum = { ...peopleYouLeadTdStyle, textAlign: 'right' as const }
const peopleYouLeadTdMutedText = peopleYouLeadMutedColor

const JOB_LABEL_DISPLAY_MAX = 35

function truncateJobLabel(full: string): string {
  if (full.length <= JOB_LABEL_DISPLAY_MAX) return full
  return `${full.slice(0, JOB_LABEL_DISPLAY_MAX)}…`
}

function personDisplayName(s: ClockSessionRow): string {
  return s.users?.name?.trim() ?? 'Unknown'
}

type Props = { myTeam: DashboardMyTeamSectionState }

export default function DashboardMyTeamSection({ myTeam }: Props) {
  const {
    authUserId,
    memberUserIds,
    teamMemberRoster,
    hoursSummaryByUserId,
    loadingHours,
    notifyByAssignment,
    notifySavingId,
    clockActivityExpanded,
    setClockActivityExpanded,
    clockActivitySimpleView,
    setClockActivitySimpleView,
    clockActivityListMode,
    setClockActivityListMode,
    clockActivityVisibleUserIds,
    toggleLedgerPersonVisible,
    ledgerSessions,
    loadingLedger,
    loadingMeta,
    pendingSessions,
    pendingApprovalCount,
    loadingSessions,
    error,
    setError,
    myTeamExpanded,
    setMyTeamExpanded,
    dateStart,
    dateEnd,
    setDateRange,
    shiftWeek,
    loadPending,
    setNotifyPreference,
    orderedLedgerSessions,
    ledgerPeopleForFilter,
    simpleLedgerGroups,
  } = myTeam

  const refreshPendingAfterAction = useCallback(async () => {
    const y = window.scrollY
    await loadPending({ silent: true })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y)
      })
    })
  }, [loadPending])

  const activeClockSessions = useMemo(
    () => pendingSessions.filter((s) => s.clocked_out_at == null),
    [pendingSessions],
  )
  const pendingApprovalClockSessions = useMemo(
    () => pendingSessions.filter((s) => s.clocked_out_at != null),
    [pendingSessions],
  )

  if (!authUserId || loadingMeta) {
    return null
  }
  if (memberUserIds.length === 0) {
    return null
  }

  return (
    <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
      <button
        type="button"
        onClick={() => setMyTeamExpanded((open) => !open)}
        aria-expanded={myTeamExpanded}
        aria-controls="dashboard-my-team-content"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          width: '100%',
          textAlign: 'left',
          fontSize: '1.125rem',
          fontWeight: 600,
          margin: 0,
          marginBottom: myTeamExpanded ? '0.75rem' : 0,
          padding: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'inherit',
        }}
      >
        <span aria-hidden>{myTeamExpanded ? '▼' : '▶'}</span>
        <span>My Team</span>
        {!myTeamExpanded && (
          <span style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.875rem' }}>
            {loadingSessions ? ' — …' : ` — ${pendingApprovalCount} pending`}
          </span>
        )}
      </button>
      {myTeamExpanded && (
        <div id="dashboard-my-team-content">
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
                style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </label>
            <label>
              <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
                style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </label>
            <button
              type="button"
              onClick={() => shiftWeek(-1)}
              style={{
                padding: '0.35rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              ← last week
            </button>
            <button
              type="button"
              onClick={() => shiftWeek(1)}
              style={{
                padding: '0.35rem 0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                background: 'white',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              next week →
            </button>
          </div>
          {teamMemberRoster.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: 'max-content',
                    maxWidth: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem',
                  }}
                >
                  <thead style={{ background: '#f3f4f6' }}>
                    <tr>
                      <th scope="col" style={{ ...peopleYouLeadThStyle, textAlign: 'right' }}>
                        Total
                      </th>
                      <th scope="col" style={peopleYouLeadThStyle}>
                        Person
                      </th>
                      <th
                        scope="col"
                        style={{ ...peopleYouLeadThStyle, textAlign: 'right', ...peopleYouLeadThMutedLabel }}
                      >
                        Active
                      </th>
                      <th
                        scope="col"
                        style={{ ...peopleYouLeadThStyle, textAlign: 'right', ...peopleYouLeadThMutedLabel }}
                      >
                        Pending
                      </th>
                      <th
                        scope="col"
                        style={{ ...peopleYouLeadThStyle, textAlign: 'right', ...peopleYouLeadThMutedLabel }}
                      >
                        Approved
                      </th>
                      <th scope="col" style={{ ...peopleYouLeadThStyle, ...peopleYouLeadThMutedLabel }}>Notify in/out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingHours ? (
                      <tr>
                        <td colSpan={6} style={{ ...peopleYouLeadTdStyle, ...peopleYouLeadMutedColor }}>
                          Loading…
                        </td>
                      </tr>
                    ) : (
                      teamMemberRoster.map((m) => {
                        const h = hoursSummaryByUserId[m.userId] ?? {
                          active: 0,
                          pending: 0,
                          approved: 0,
                          total: 0,
                        }
                        return (
                          <tr key={m.assignmentId}>
                            <td style={peopleYouLeadTdNum}>{formatDecimalHours(h.total)}</td>
                            <td style={peopleYouLeadTdStyle}>{m.displayName}</td>
                            <td style={{ ...peopleYouLeadTdNum, ...peopleYouLeadTdMutedText }}>
                              {formatDecimalHours(h.active)}
                            </td>
                            <td style={{ ...peopleYouLeadTdNum, ...peopleYouLeadTdMutedText }}>
                              {formatDecimalHours(h.pending)}
                            </td>
                            <td style={{ ...peopleYouLeadTdNum, ...peopleYouLeadTdMutedText }}>
                              {formatDecimalHours(h.approved)}
                            </td>
                            <td style={{ ...peopleYouLeadTdStyle, ...peopleYouLeadTdMutedText }}>
                              <label
                                style={{
                                  fontSize: '0.8125rem',
                                  cursor: notifySavingId === m.assignmentId ? 'wait' : 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={notifyByAssignment[m.assignmentId] ?? false}
                                  disabled={notifySavingId === m.assignmentId}
                                  onChange={(e) => void setNotifyPreference(m.assignmentId, e.target.checked)}
                                  aria-label="Notify on clock in and clock out"
                                  title="On clock in/out"
                                  style={{ verticalAlign: 'middle' }}
                                />
                              </label>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {loadingSessions ? (
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>Loading…</p>
          ) : (
            <div id="dashboard-my-team-pending">
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setClockActivityExpanded((o) => !o)}
                  aria-expanded={clockActivityExpanded}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: 0,
                    marginBottom: clockActivityExpanded ? '0.5rem' : 0,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  <span aria-hidden>{clockActivityExpanded ? '▼' : '▶'}</span>
                  Clock activity
                </button>
                {clockActivityExpanded && (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        justifyContent: 'space-between',
                      }}
                    >
                      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0, flex: '1 1 12rem' }}>
                        All clock sessions for people you lead in the date range above (same as pending week).
                      </p>
                      <div role="group" aria-label="Clock activity view" style={{ display: 'inline-flex', gap: '0.2rem' }}>
                        <button
                          type="button"
                          aria-pressed={!clockActivitySimpleView}
                          onClick={() => setClockActivitySimpleView(false)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8125rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: !clockActivitySimpleView ? '#e5e7eb' : 'white',
                            cursor: 'pointer',
                            color: '#374151',
                          }}
                        >
                          Detailed
                        </button>
                        <button
                          type="button"
                          aria-pressed={clockActivitySimpleView}
                          onClick={() => setClockActivitySimpleView(true)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.8125rem',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            background: clockActivitySimpleView ? '#e5e7eb' : 'white',
                            cursor: 'pointer',
                            color: '#374151',
                          }}
                        >
                          Simple
                        </button>
                      </div>
                    </div>
                    {ledgerSessions.length > 0 && (
                      <div
                        style={{
                          marginBottom: '0.5rem',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div role="group" aria-label="Clock activity order" style={{ display: 'inline-flex', gap: '0.2rem' }}>
                          <button
                            type="button"
                            aria-pressed={clockActivityListMode === 'chronological'}
                            onClick={() => setClockActivityListMode('chronological')}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: clockActivityListMode === 'chronological' ? '#e5e7eb' : 'white',
                              cursor: 'pointer',
                              color: '#374151',
                            }}
                          >
                            Chronological
                          </button>
                          <button
                            type="button"
                            aria-pressed={clockActivityListMode === 'byPerson'}
                            onClick={() => setClockActivityListMode('byPerson')}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              background: clockActivityListMode === 'byPerson' ? '#e5e7eb' : 'white',
                              cursor: 'pointer',
                              color: '#374151',
                            }}
                          >
                            By person
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: '0.8125rem',
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                          }}
                        >
                          <div
                            id="clock-activity-filter-label"
                            style={{
                              color: '#374151',
                              fontWeight: 500,
                              flexShrink: 0,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Filter people
                          </div>
                          <div
                            role="group"
                            aria-labelledby="clock-activity-filter-label"
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.4rem',
                              flex: '1 1 12rem',
                              minWidth: 0,
                              maxWidth: '42rem',
                            }}
                          >
                            {ledgerPeopleForFilter.map(({ userId, name }) => (
                              <label
                                key={userId}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', cursor: 'pointer' }}
                              >
                                <input
                                  type="checkbox"
                                  checked={clockActivityVisibleUserIds.has(userId)}
                                  onChange={() => toggleLedgerPersonVisible(userId)}
                                  disabled={
                                    clockActivityVisibleUserIds.has(userId) && clockActivityVisibleUserIds.size <= 1
                                  }
                                />
                                {name}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {loadingLedger ? (
                      <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
                    ) : clockActivitySimpleView ? (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table
                            style={{
                              width: 'max-content',
                              maxWidth: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.875rem',
                            }}
                          >
                            <thead style={{ background: '#f3f4f6' }}>
                              <tr>
                                <th scope="col" style={teamHoursThStyle}>
                                  Person
                                </th>
                                <th scope="col" style={teamHoursThStyle}>
                                  Work day
                                </th>
                                <th scope="col" style={{ ...teamHoursThStyle, textAlign: 'right' }}>
                                  Hours
                                </th>
                                <th scope="col" style={teamHoursThStyle}>
                                  Notes
                                </th>
                                <th scope="col" style={teamHoursThStyle}>
                                  Job
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderedLedgerSessions.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ ...teamHoursTdStyle, color: '#6b7280', textAlign: 'center' }}>
                                    {ledgerSessions.length === 0
                                      ? 'No sessions in this date range'
                                      : 'No sessions for selected people'}
                                  </td>
                                </tr>
                              ) : clockActivityListMode === 'byPerson' && simpleLedgerGroups ? (
                                simpleLedgerGroups.map((g) => (
                                  <Fragment key={g.userId}>
                                    <tr>
                                      <td
                                        colSpan={5}
                                        style={{
                                          ...teamHoursTdStyle,
                                          background: '#f3f4f6',
                                          fontWeight: 600,
                                          color: '#374151',
                                        }}
                                      >
                                        {g.name}
                                      </td>
                                    </tr>
                                    {g.sessions.map((s) => {
                                      const personName = personDisplayName(s)
                                      const hrs = sessionDecimalHours(s)
                                      const jobFull = formatClockSessionJobOrBidLabel(s)
                                      const jobDisplay = jobFull ? truncateJobLabel(jobFull) : '—'
                                      const jobTruncated = Boolean(jobFull && jobFull.length > JOB_LABEL_DISPLAY_MAX)
                                      return (
                                        <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                                          <td style={teamHoursTdStyle}>{personName}</td>
                                          <td style={teamHoursTdStyle}>{formatClockActivityWorkDayLabel(s.work_date)}</td>
                                          <td style={teamHoursTdNum}>
                                            <span style={{ fontWeight: 600 }}>{hrs.toFixed(2)}h</span>
                                          </td>
                                          <td
                                            style={{
                                              ...teamHoursTdStyle,
                                              maxWidth: 280,
                                              overflowWrap: 'break-word',
                                              wordBreak: 'break-word',
                                            }}
                                          >
                                            {s.notes || '—'}
                                          </td>
                                          <td
                                            style={teamHoursTdStyle}
                                            title={jobFull || undefined}
                                            aria-label={jobTruncated ? jobFull ?? undefined : undefined}
                                          >
                                            {jobDisplay}
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </Fragment>
                                ))
                              ) : (
                                orderedLedgerSessions.map((s) => {
                                  const personName = personDisplayName(s)
                                  const hrs = sessionDecimalHours(s)
                                  const jobFull = formatClockSessionJobOrBidLabel(s)
                                  const jobDisplay = jobFull ? truncateJobLabel(jobFull) : '—'
                                  const jobTruncated = Boolean(jobFull && jobFull.length > JOB_LABEL_DISPLAY_MAX)
                                  return (
                                    <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' }}>
                                      <td style={teamHoursTdStyle}>{personName}</td>
                                      <td style={teamHoursTdStyle}>{formatClockActivityWorkDayLabel(s.work_date)}</td>
                                      <td style={teamHoursTdNum}>
                                        <span style={{ fontWeight: 600 }}>{hrs.toFixed(2)}h</span>
                                      </td>
                                      <td
                                        style={{
                                          ...teamHoursTdStyle,
                                          maxWidth: 280,
                                          overflowWrap: 'break-word',
                                          wordBreak: 'break-word',
                                        }}
                                      >
                                        {s.notes || '—'}
                                      </td>
                                      <td
                                        style={teamHoursTdStyle}
                                        title={jobFull || undefined}
                                        aria-label={jobTruncated ? jobFull ?? undefined : undefined}
                                      >
                                        {jobDisplay}
                                      </td>
                                    </tr>
                                  )
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                        <ClockSessionsTable
                          sessions={orderedLedgerSessions}
                          locationVariant="full"
                          emptyMessage={
                            ledgerSessions.length === 0
                              ? 'No sessions in this date range'
                              : 'No sessions for selected people'
                          }
                          renderDuration={renderDurationDurationFirst}
                          renderJob={() => null}
                          renderNotesSecondary={(s) => {
                            const label = formatClockSessionJobOrBidLabel(s)
                            return label ? <span title={label}>{label}</span> : null
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
              <div
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
                  Active clock sessions ({activeClockSessions.length})
                </div>
                <ClockSessionsTable
                  sessions={activeClockSessions}
                  showActionsColumn
                  locationVariant="full"
                  emptyMessage="No active sessions"
                  renderNotesSecondary={(s) => {
                    const label = formatClockSessionJobOrBidLabel(s)
                    return label ? <span title={label}>{label}</span> : null
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
                          onClick={async () => {
                            if (!confirm(`Force clock out ${personName}?`)) return
                            const now = new Date().toISOString()
                            try {
                              await withSupabaseRetry(
                                async () => supabase.from('clock_sessions').update({ clocked_out_at: now }).eq('id', s.id),
                                'force clock out',
                              )
                              await refreshPendingAfterAction()
                            } catch (e) {
                              setError(formatErrorMessage(e))
                            }
                          }}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.8125rem',
                            border: '1px solid #dc2626',
                            borderRadius: 4,
                            background: '#fef2f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                        >
                          Force clock out
                        </button>
                      </div>
                    )
                  }}
                />
              </div>
              <div
                id="dashboard-my-team-pending-sessions"
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', fontWeight: 600, fontSize: '0.875rem' }}>
                  Pending sessions ({pendingApprovalClockSessions.length})
                </div>
                <ClockSessionsTable
                  sessions={pendingApprovalClockSessions}
                  showActionsColumn
                  locationVariant="full"
                  emptyMessage="No sessions awaiting approval"
                  renderNotesSecondary={(s) => {
                    const label = formatClockSessionJobOrBidLabel(s)
                    return label ? <span title={label}>{label}</span> : null
                  }}
                  renderJob={(s) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap', minWidth: 0 }}>
                      <span style={{ flexShrink: 0 }}>
                        <AssignSessionJobPopover
                          session={s}
                          onSaved={() => void refreshPendingAfterAction()}
                          onError={(msg) => setError(msg)}
                        />
                      </span>
                    </div>
                  )}
                  renderActions={(s) => (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={async () => {
                          const { data, error: rpcErr } = await approveClockSessions([s.id])
                          if (rpcErr) {
                            setError(rpcErr.message)
                            return
                          }
                          const result = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
                          const row = result[0]
                          if (row?.error_message) {
                            setError(row.error_message)
                            return
                          }
                          await refreshPendingAfterAction()
                        }}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #22c55e',
                          borderRadius: 4,
                          background: '#f0fdf4',
                          color: '#16a34a',
                          cursor: 'pointer',
                        }}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Reject this clock session?')) return
                          try {
                            await withSupabaseRetry(
                              async () =>
                                supabase
                                  .from('clock_sessions')
                                  .update({ rejected_at: new Date().toISOString(), rejected_by: authUserId ?? null })
                                  .eq('id', s.id),
                              'reject clock session',
                            )
                            await refreshPendingAfterAction()
                          } catch (e) {
                            setError(formatErrorMessage(e))
                          }
                        }}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #dc2626',
                          borderRadius: 4,
                          background: '#fef2f2',
                          color: '#dc2626',
                          cursor: 'pointer',
                        }}
                      >
                        Reject
                      </button>
                      <Link
                        to="/people?tab=hours"
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.8125rem',
                          border: '1px solid #d1d5db',
                          borderRadius: 4,
                          background: 'white',
                          color: '#374151',
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                      >
                        Edit
                      </Link>
                    </div>
                  )}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
