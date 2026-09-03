import { Fragment, useCallback, useMemo, useState } from 'react'
import { PersonNameDoor } from './personDesk/PersonNameDoor'
import { Link } from 'react-router-dom'
import { approveClockSessions } from '../lib/approveClockSessions'
import {
  formatHoursShort,
  formatTeamWeekLabel,
  isLongSession,
  pendingRollup,
  personWeekSummaryLine,
} from '../lib/myTeamApprovals'
import { supabase } from '../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import type { DashboardMyTeamSectionState } from '../hooks/useDashboardMyTeamSectionState'
import {
  AssignSessionJobPopover,
  ClockSessionLocationCell,
  ClockSessionsTable,
  formatClockActivityWorkDayLabel,
  formatClockSessionJobOrBidLabel,
  renderDurationDurationFirst,
  sessionDecimalHours,
} from './clock-sessions'
import type { ClockSessionRow } from '../types/clockSessions'
import DashboardMyTeamPendingBanner from './DashboardMyTeamPendingBanner'
import { useLedgerPrefixMap } from '../contexts/LedgerDisplayPrefixContext'
import { useConfirmDialog } from '../contexts/ConfirmDialogContext'

const teamHoursThStyle = {
  padding: '0.35rem 0.5rem',
  textAlign: 'left' as const,
  borderBottom: '1px solid var(--border)',
}
const teamHoursTdStyle = { padding: '0.35rem 0.5rem' }
const teamHoursTdNum = { ...teamHoursTdStyle, textAlign: 'right' as const }

const peopleYouLeadMutedColor = { color: 'var(--text-muted)' as const }

const JOB_LABEL_DISPLAY_MAX = 35

function truncateJobLabel(full: string): string {
  if (full.length <= JOB_LABEL_DISPLAY_MAX) return full
  return `${full.slice(0, JOB_LABEL_DISPLAY_MAX)}…`
}

function personDisplayName(s: ClockSessionRow): string {
  return s.users?.name?.trim() ?? 'Unknown'
}

type Props = {
  myTeam: DashboardMyTeamSectionState
  showPendingBannerAtTop?: boolean
  onGoToPendingSessions?: () => void
}

export default function DashboardMyTeamSection({
  myTeam,
  showPendingBannerAtTop = false,
  onGoToPendingSessions,
}: Props) {
  const {
    authUserId,
    memberUserIds,
    fullDetailMemberIds,
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
  const prefixMap = useLedgerPrefixMap()
  const confirmDialog = useConfirmDialog()

  /** v2.2076: the exact Start/End inputs hide behind the week-pager label. */
  const [datePickersOpen, setDatePickersOpen] = useState(false)
  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())

  const refreshPendingAfterAction = useCallback(async () => {
    const y = window.scrollY
    await loadPending({ silent: true })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y)
      })
    })
  }, [loadPending])

  const fullDetailUserIdSet = useMemo(() => new Set(fullDetailMemberIds), [fullDetailMemberIds])

  const rosterFullDetail = useMemo(
    () => teamMemberRoster.filter((m) => m.dashboard_visibility !== 'strip_only'),
    [teamMemberRoster],
  )

  const activeClockSessions = useMemo(
    () =>
      pendingSessions.filter(
        (s) => s.clocked_out_at == null && fullDetailUserIdSet.has(s.user_id),
      ),
    [pendingSessions, fullDetailUserIdSet],
  )
  const pendingApprovalClockSessions = useMemo(
    () =>
      pendingSessions.filter(
        (s) => s.clocked_out_at != null && fullDetailUserIdSet.has(s.user_id),
      ),
    [pendingSessions, fullDetailUserIdSet],
  )

  if (!authUserId || loadingMeta) {
    return null
  }
  if (memberUserIds.length === 0) {
    return null
  }
  if (fullDetailMemberIds.length === 0) {
    return null
  }

  return (
    <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
      {showPendingBannerAtTop && (
        <div style={{ marginBottom: '1rem' }}>
          <DashboardMyTeamPendingBanner
            pendingApprovalCount={pendingApprovalCount}
            loadingSessions={loadingSessions}
            onGoToPendingSessions={onGoToPendingSessions}
          />
        </div>
      )}
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
        {/* v2.2076: the approval count rides the header in BOTH states — it is
            the section's reason to exist, amber while sessions wait. */}
        {!loadingSessions && pendingApprovalCount > 0 ? (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-amber-800)',
              background: 'var(--bg-amber-100)',
              border: '1px solid var(--bg-amber-200)',
              borderRadius: 999,
              padding: '0.15rem 0.6rem',
              whiteSpace: 'nowrap',
            }}
          >
            {pendingApprovalCount} to approve
          </span>
        ) : !myTeamExpanded ? (
          <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {loadingSessions ? ' — …' : ' — nothing pending'}
          </span>
        ) : null}
      </button>
      {myTeamExpanded && (
        <div id="dashboard-my-team-content">
          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</p>}
          {/* v2.2076 week pager (mockup A): one row — ‹ label ›. Tapping the
              label reveals the exact Start/End pickers for odd ranges. */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <button
              type="button"
              onClick={() => shiftWeek(-1)}
              aria-label="Last week"
              style={{ width: 42, height: 38, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '1.05rem', cursor: 'pointer', flexShrink: 0 }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setDatePickersOpen((o) => !o)}
              aria-expanded={datePickersOpen}
              title="Tap to pick exact dates"
              style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.5rem 0', background: 'var(--surface)', cursor: 'pointer' }}
            >
              {formatTeamWeekLabel(dateStart, dateEnd, todayYmd)}
            </button>
            <button
              type="button"
              onClick={() => shiftWeek(1)}
              aria-label="Next week"
              style={{ width: 42, height: 38, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '1.05rem', cursor: 'pointer', flexShrink: 0 }}
            >
              ›
            </button>
          </div>
          {datePickersOpen && (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>Start</span>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateRange((r) => ({ ...r, start: e.target.value }))}
                  style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </label>
              <label>
                <span style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}>End</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateRange((r) => ({ ...r, end: e.target.value }))}
                  style={{ padding: '0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
                />
              </label>
            </div>
          )}
          {/* v2.2076 (mockup A): the 7-column roster table clipped off-screen on
              phones (the Notify toggle never rendered). Each person is now one
              card — name, a sentence for the week, and a bell for clock in/out
              notifications. */}
          {rosterFullDetail.length > 0 && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {loadingHours ? (
                <p style={{ ...peopleYouLeadMutedColor, fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : (
                rosterFullDetail.map((m) => {
                  const h = hoursSummaryByUserId[m.userId] ?? {
                    active: 0,
                    pending: 0,
                    approved: 0,
                    manual: 0,
                    total: 0,
                  }
                  const notifyOn = notifyByAssignment[m.assignmentId] ?? false
                  return (
                    <div
                      key={m.assignmentId}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '0.7rem 0.75rem',
                        background: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.6rem',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>{m.displayName}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {personWeekSummaryLine(h)}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-pressed={notifyOn}
                        disabled={notifySavingId === m.assignmentId}
                        onClick={() => void setNotifyPreference(m.assignmentId, !notifyOn)}
                        aria-label={`Notify me when ${m.displayName} clocks in or out`}
                        title={notifyOn ? `Notifying you when ${m.displayName} clocks in/out — tap to stop` : `Tap to get notified when ${m.displayName} clocks in/out`}
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          border: notifyOn ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                          background: 'var(--surface)',
                          color: notifyOn ? 'var(--text-link)' : 'var(--text-faint)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: notifySavingId === m.assignmentId ? 'wait' : 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {/* Icon: Font Awesome Free 6.x — bell (OFL/CC-BY) */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width={18} height={18} fill="currentColor" aria-hidden focusable={false}>
                          <path d="M224 0c-17.7 0-32 14.3-32 32v19.2C119 66 64 130.6 64 208v18.8c0 47-17.3 92.4-48.5 127.6l-7.4 8.3c-8.4 9.4-10.4 22.9-5.3 34.4S19.4 416 32 416H416c12.6 0 24-7.4 29.2-18.9s3.1-25-5.3-34.4l-7.4-8.3C401.3 319.2 384 273.8 384 226.8V208c0-77.4-55-142-128-156.8V32c0-17.7-14.3-32-32-32zm45.3 493.3c12-12 18.7-28.3 18.7-45.3H224 160c0 17 6.7 33.3 18.7 45.3s28.3 18.7 45.3 18.7s33.3-6.7 45.3-18.7z" />
                        </svg>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
          {loadingSessions ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>Loading…</p>
          ) : (
            <div id="dashboard-my-team-pending">
              {/* v2.2076 (mockup A): approvals lead the section. Approve all rides
                  the existing batch RPC; each card states the hours it attests and
                  flags days past 12h so a 14.5h shift takes a conscious look. */}
              {(() => {
                const rollup = pendingRollup(pendingApprovalClockSessions.map(sessionDecimalHours))
                return (
                  <div
                    id="dashboard-my-team-pending-sessions"
                    style={{ border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0.75rem', marginBottom: '1rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>
                        Pending approval ({rollup.count})
                      </div>
                      {rollup.count > 0 && (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{formatHoursShort(rollup.totalHours)} total</span>
                      )}
                    </div>
                    {rollup.count === 0 ? (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>
                        No sessions awaiting approval — you're caught up.
                      </p>
                    ) : (
                      <>
                        {rollup.count > 1 && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (
                                !(await confirmDialog({
                                  message: `Approve all ${rollup.count} sessions — ${formatHoursShort(rollup.totalHours)} total?`,
                                  confirmLabel: 'Approve all',
                                }))
                              )
                                return
                              const { data, error: rpcErr } = await approveClockSessions(
                                pendingApprovalClockSessions.map((s) => s.id),
                              )
                              if (rpcErr) {
                                setError(rpcErr.message)
                                return
                              }
                              const rows = (data ?? []) as Array<{ approved_count: number; error_message: string | null }>
                              const firstErr = rows.find((r) => r.error_message)?.error_message
                              if (firstErr) {
                                setError(firstErr)
                                return
                              }
                              await refreshPendingAfterAction()
                            }}
                            style={{
                              width: '100%',
                              minHeight: 44,
                              marginTop: '0.6rem',
                              border: 'none',
                              borderRadius: 8,
                              background: '#16a34a',
                              color: '#fff',
                              fontSize: '0.9375rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Approve all {rollup.count} · {formatHoursShort(rollup.totalHours)}
                          </button>
                        )}
                        {pendingApprovalClockSessions.map((s) => {
                          const hrs = sessionDecimalHours(s)
                          const long = isLongSession(hrs)
                          const inDate = new Date(s.clocked_in_at)
                          const outDate = s.clocked_out_at ? new Date(s.clocked_out_at) : null
                          const times = `${inDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${
                            outDate ? outDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'
                          }`
                          const dayLabel = new Date(`${s.work_date}T12:00:00`)
                            .toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
                            .replace(',', '')
                          const jobLabel = formatClockSessionJobOrBidLabel(s, prefixMap)
                          return (
                            <div key={s.id} style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>
                                  {rosterFullDetail.length > 1 ? `${personDisplayName(s)} · ` : ''}
                                  {dayLabel} · {formatHoursShort(hrs)}
                                </span>
                                {long && (
                                  <span
                                    title="Longer than 12 hours — double-check before approving"
                                    style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-amber-800)' }}
                                  >
                                    ⚠ long day
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                <span>{times}</span>
                                <ClockSessionLocationCell
                                  clockInLat={s.clock_in_lat}
                                  clockInLng={s.clock_in_lng}
                                  clockOutLat={s.clock_out_lat}
                                  clockOutLng={s.clock_out_lng}
                                  clockInLocationSource={s.clock_in_location_source}
                                  clockOutLocationSource={s.clock_out_location_source}
                                  variant="full"
                                />
                              </div>
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {jobLabel ? (
                                  <span title={jobLabel} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                    {truncateJobLabel(jobLabel)}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-faint)' }}>No job assigned</span>
                                )}
                                <AssignSessionJobPopover
                                  session={s}
                                  onSaved={() => void refreshPendingAfterAction()}
                                  onError={(msg) => setError(msg)}
                                  dispatchScheduleAssigneeUserId={s.user_id}
                                  dispatchScheduleWorkDateYmd={s.work_date}
                                />
                              </div>
                              {s.notes?.trim() ? (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', fontStyle: 'italic', marginTop: 4, overflowWrap: 'anywhere' }}>
                                  "{s.notes.trim()}"
                                </div>
                              ) : null}
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
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
                                    flex: 1.4,
                                    minHeight: 44,
                                    border: 'none',
                                    borderRadius: 8,
                                    background: '#16a34a',
                                    color: '#fff',
                                    fontSize: '0.9375rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Approve {formatHoursShort(hrs)}
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!(await confirmDialog({ message: 'Reject this clock session?', confirmLabel: 'Reject' }))) return
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
                                    flex: 1,
                                    minHeight: 44,
                                    border: '1px solid #dc2626',
                                    borderRadius: 8,
                                    background: 'transparent',
                                    color: 'var(--text-red-600)',
                                    fontSize: '0.9375rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Reject
                                </button>
                                <Link
                                  to="/people?tab=hours"
                                  style={{
                                    flex: 1,
                                    minHeight: 44,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: 8,
                                    background: 'var(--surface)',
                                    color: 'var(--text-link)',
                                    fontSize: '0.9375rem',
                                    textDecoration: 'none',
                                  }}
                                >
                                  Edit
                                </Link>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
              })()}
              {activeClockSessions.length > 0 && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    overflow: 'hidden',
                    marginBottom: '1rem',
                  }}
                >
                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-subtle)', fontWeight: 600, fontSize: '0.875rem' }}>
                    On the clock right now ({activeClockSessions.length})
                  </div>
                  <ClockSessionsTable
                    sessions={activeClockSessions}
                    showActionsColumn
                    locationVariant="full"
                    emptyMessage="No active sessions"
                    renderNotesSecondary={(s) => {
                      const label = formatClockSessionJobOrBidLabel(s, prefixMap)
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
                              if (!(await confirmDialog({ message: `Force clock out ${personName}?`, confirmLabel: 'Force clock out' }))) return
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
                              background: 'var(--bg-red-tint)',
                              color: 'var(--text-red-600)',
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
              )}
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
                    color: 'var(--text-700)',
                  }}
                >
                  <span aria-hidden>{clockActivityExpanded ? '▼' : '▶'}</span>
                  All clock activity
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
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, flex: '1 1 12rem' }}>
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
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            background: !clockActivitySimpleView ? 'var(--bg-200)' : 'var(--surface)',
                            cursor: 'pointer',
                            color: 'var(--text-700)',
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
                            border: '1px solid var(--border-strong)',
                            borderRadius: 4,
                            background: clockActivitySimpleView ? 'var(--bg-200)' : 'var(--surface)',
                            cursor: 'pointer',
                            color: 'var(--text-700)',
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
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: clockActivityListMode === 'chronological' ? 'var(--bg-200)' : 'var(--surface)',
                              cursor: 'pointer',
                              color: 'var(--text-700)',
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
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: clockActivityListMode === 'byPerson' ? 'var(--bg-200)' : 'var(--surface)',
                              cursor: 'pointer',
                              color: 'var(--text-700)',
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
                              color: 'var(--text-700)',
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
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
                    ) : clockActivitySimpleView ? (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table
                            style={{
                              width: 'max-content',
                              maxWidth: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.875rem',
                            }}
                          >
                            <thead style={{ background: 'var(--bg-muted)' }}>
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
                                  <td colSpan={5} style={{ ...teamHoursTdStyle, color: 'var(--text-muted)', textAlign: 'center' }}>
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
                                          background: 'var(--bg-muted)',
                                          fontWeight: 600,
                                          color: 'var(--text-700)',
                                        }}
                                      >
                                        {g.name}
                                      </td>
                                    </tr>
                                    {g.sessions.map((s) => {
                                      const personName = personDisplayName(s)
                                      const hrs = sessionDecimalHours(s)
                                      const jobFull = formatClockSessionJobOrBidLabel(s, prefixMap)
                                      const jobDisplay = jobFull ? truncateJobLabel(jobFull) : '—'
                                      const jobTruncated = Boolean(jobFull && jobFull.length > JOB_LABEL_DISPLAY_MAX)
                                      return (
                                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                                          <td style={teamHoursTdStyle}><PersonNameDoor name={personName} userId={s.user_id} /></td>
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
                                  const jobFull = formatClockSessionJobOrBidLabel(s, prefixMap)
                                  const jobDisplay = jobFull ? truncateJobLabel(jobFull) : '—'
                                  const jobTruncated = Boolean(jobFull && jobFull.length > JOB_LABEL_DISPLAY_MAX)
                                  return (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                                      <td style={teamHoursTdStyle}><PersonNameDoor name={personName} userId={s.user_id} /></td>
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
                      <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
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
                            const label = formatClockSessionJobOrBidLabel(s, prefixMap)
                            return label ? <span title={label}>{label}</span> : null
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
