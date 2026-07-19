import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { DashboardTeamActiveClockStrip } from '../DashboardTeamActiveClockStrip'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { ApplyScheduleApprovedConfirmModal } from '../clock-sessions/ApplyScheduleApprovedConfirmModal'
import { useAuth } from '../../hooks/useAuth'
import { useApplyScheduleProportions } from '../../hooks/useApplyScheduleProportions'
import { useReportQuickfillSectionMetric } from '../../contexts/QuickfillSectionMetricsContext'
import { useDashboardMyTeamSectionState } from '../../hooks/useDashboardMyTeamSectionState'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { useToastContext } from '../../contexts/ToastContext'
import {
  denverCalendarDayKey,
  formatDenverCalendarDayWithWeekdayAndYear,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'
import { syncSalaryClockSessionsForUserDay } from '../../lib/salaryScheduleSync'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import type { ClockSessionRow, DashboardStripSession } from '../../types/clockSessions'
import { shiftWorkDateYmd } from '../../lib/peopleHoursClockStripSelectedDay'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import {
  buildPeopleHoursClockStripMiniCalendarYmds,
  pendingWorkDateRangeFromMiniCalendarYmds,
  PeopleHoursClockStripMiniCalendar,
} from '../people/PeopleHoursClockStripMiniCalendar'

const QUICKFILL_CLOCK_STRIP_SCOPE_KEY = 'quickfill_clock_strip_scope'

const PEOPLE_HOURS_NAV_MOBILE_MQ = '(max-width: 640px)'

function subscribePeopleHoursNavMobile(onChange: () => void): () => void {
  const mq = window.matchMedia(PEOPLE_HOURS_NAV_MOBILE_MQ)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function snapshotPeopleHoursNavMobile(): boolean {
  return window.matchMedia(PEOPLE_HOURS_NAV_MOBILE_MQ).matches
}

function usePeopleHoursNavMobileLayout(): boolean {
  return useSyncExternalStore(subscribePeopleHoursNavMobile, snapshotPeopleHoursNavMobile, () => false)
}

function readQuickfillClockStripScope(): 'team' | 'everyone' {
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(QUICKFILL_CLOCK_STRIP_SCOPE_KEY)
      if (v === 'everyone' || v === 'team') return v
    }
  } catch {
    /* ignore */
  }
  return 'everyone'
}

function closedSessionDurationHours(clockedIn: string, clockedOut: string): number {
  const inMs = new Date(clockedIn).getTime()
  const outMs = new Date(clockedOut).getTime()
  return Math.max(0, (outMs - inMs) / 3600000)
}

const navBtnStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
  cursor: 'pointer',
  fontSize: '0.875rem',
}

const navMobileSepStyle: CSSProperties = {
  color: 'var(--text-faint)',
  userSelect: 'none',
  fontSize: '0.875rem',
  padding: '0 0.15rem',
}

const assistanceNoticeStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.875rem',
  margin: '0.625rem 0 1rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #fbbf24',
  background: 'var(--bg-amber-100)',
  color: 'var(--text-amber-800)',
  fontWeight: 500,
}

export function QuickfillPeopleHoursNewSection() {
  const peopleHoursNavMobile = usePeopleHoursNavMobileLayout()
  const narrowViewport640 = useNarrowViewport640()
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const [selectedYmd, setSelectedYmd] = useState(() => denverCalendarDayKey(Date.now()))
  const [clockStripScope, setClockStripScope] = useState<'team' | 'everyone'>(readQuickfillClockStripScope)
  const [stripMyTimeEditor, setStripMyTimeEditor] = useState<{
    subjectUserId: string
    displayName: string
  } | null>(null)

  const setClockStripScopePersist = useCallback((next: 'team' | 'everyone') => {
    setClockStripScope(next)
    try {
      localStorage.setItem(QUICKFILL_CLOCK_STRIP_SCOPE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'
  const orgWideStripEnabled = showClockStripScopeToggle && clockStripScope === 'everyone'

  const todayDenver = denverCalendarDayKey(Date.now())
  const miniCalendarYmds = useMemo(() => buildPeopleHoursClockStripMiniCalendarYmds(todayDenver), [todayDenver])
  const pendingWorkDateRange = useMemo(
    () => pendingWorkDateRangeFromMiniCalendarYmds(miniCalendarYmds, todayDenver),
    [miniCalendarYmds, todayDenver],
  )

  const myTeam = useDashboardMyTeamSectionState(authUser?.id, {
    orgWideStripEnabled,
    stripWorkDateYmd: selectedYmd,
    pendingWorkDateRange,
  })
  const reloadMyTeamPendingSilent = useCallback(() => {
    void myTeam.loadPending({ silent: true })
  }, [myTeam.loadPending])
  const applySchedule = useApplyScheduleProportions({
    authUserId: authUser?.id,
    onApplied: reloadMyTeamPendingSilent,
  })

  const pendingUnapprovedCountByWorkDate = useMemo(() => {
    const base = orgWideStripEnabled ? myTeam.orgWidePendingSessions : myTeam.pendingSessions
    const counts: Record<string, number> = {}
    for (const s of base) {
      const wd = s.work_date
      if (!wd) continue
      counts[wd] = (counts[wd] ?? 0) + 1
    }
    return counts
  }, [orgWideStripEnabled, myTeam.orgWidePendingSessions, myTeam.pendingSessions])

  const [pendingBreakdownOpen, setPendingBreakdownOpen] = useState(false)

  const pendingApprovalSessions = useMemo(() => {
    if (!authUser?.id) return []
    const base = orgWideStripEnabled ? myTeam.orgWidePendingSessions : myTeam.pendingSessions
    return base.filter(
      (s) =>
        s.clocked_out_at != null && s.approved_at == null && s.rejected_at == null,
    )
  }, [authUser?.id, orgWideStripEnabled, myTeam.orgWidePendingSessions, myTeam.pendingSessions])

  const pendingApprovalBreakdown = useMemo(() => {
    const byDay = new Map<string, { count: number; hours: number }>()
    for (const s of pendingApprovalSessions) {
      const wd = s.work_date
      const cur = byDay.get(wd) ?? { count: 0, hours: 0 }
      cur.count += 1
      if (s.clocked_out_at) {
        cur.hours += closedSessionDurationHours(s.clocked_in_at, s.clocked_out_at)
      }
      byDay.set(wd, cur)
    }
    const rows = [...byDay.entries()].map(([workDate, v]) => ({
      workDate,
      count: v.count,
      hours: v.hours,
    }))
    rows.sort((a, b) => b.workDate.localeCompare(a.workDate))
    return rows
  }, [pendingApprovalSessions])

  const pendingApprovalTotal = pendingApprovalSessions.length

  const openPendingBreakdown = useCallback(() => {
    setPendingBreakdownOpen(true)
  }, [])

  useReportQuickfillSectionMetric(
    'people-hours-new',
    !authUser?.id ? null : myTeam.loadingSessions ? null : pendingApprovalTotal,
    !!(authUser?.id && myTeam.loadingSessions),
    pendingApprovalTotal > 0 ? openPendingBreakdown : null,
  )

  useEffect(() => {
    if (!pendingBreakdownOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingBreakdownOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingBreakdownOpen])

  const showLiveCurrentlyIn = selectedYmd === todayDenver

  const sessionsForStrip = useMemo((): DashboardStripSession[] => {
    const isOpen = (s: DashboardStripSession) => s.clocked_out_at == null
    const base =
      showClockStripScopeToggle && clockStripScope === 'everyone'
        ? myTeam.orgWidePendingSessions
        : myTeam.pendingSessions
    const realOpen = base.filter(isOpen) as ClockSessionRow[]
    const merged: DashboardStripSession[] = [...realOpen, ...myTeam.stripSyntheticSalarySessions]
    merged.sort((a, b) => {
      const an = (a.users?.name ?? '').trim() || a.user_id
      const bn = (b.users?.name ?? '').trim() || b.user_id
      const c = an.localeCompare(bn, undefined, { sensitivity: 'base' })
      if (c !== 0) return c
      return a.clocked_in_at.localeCompare(b.clocked_in_at)
    })
    return merged
  }, [
    showClockStripScopeToggle,
    clockStripScope,
    myTeam.orgWidePendingSessions,
    myTeam.pendingSessions,
    myTeam.stripSyntheticSalarySessions,
  ])

  const sessionsForQuickfillStrip = useMemo(
    () => (showLiveCurrentlyIn ? sessionsForStrip : []),
    [showLiveCurrentlyIn, sessionsForStrip],
  )

  const hoursTodayForStrip = useMemo(() => {
    if (showClockStripScopeToggle && clockStripScope === 'everyone') {
      return myTeam.hoursTodayByUserIdOrg
    }
    return myTeam.hoursTodayByUserId
  }, [showClockStripScopeToggle, clockStripScope, myTeam.hoursTodayByUserIdOrg, myTeam.hoursTodayByUserId])

  const materializeSalarySessionForStrip = useCallback(
    async (userId: string) => {
      const { error } = await syncSalaryClockSessionsForUserDay(userId, selectedYmd)
      if (error) {
        showToast(error, 'error')
        return
      }
      await myTeam.loadPending({ silent: true })
    },
    [showToast, myTeam.loadPending, selectedYmd],
  )

  const handleStripMarkNotComingIn = useCallback(
    async (p: { subjectUserId: string; displayName: string; workDateYmd: string }) => {
      const result = await recordNotComingInForUserAsStaff({
        subjectUserId: p.subjectUserId,
        workDateYmd: p.workDateYmd,
      })
      if (result.ok && result.alreadyMarked) {
        showToast(`${p.displayName} already has unpaid time off on ${p.workDateYmd}.`, 'warning')
        return
      }
      if (!result.ok) {
        showToast(result.message, 'error')
        return
      }
      showToast(`Marked ${p.displayName} as not coming in (${p.workDateYmd}).`, 'success')
      if (result.syncWarning) {
        showToast(`Salary sync: ${result.syncWarning}`, 'warning')
      }
      void myTeam.loadPending({ silent: true })
    },
    [showToast, myTeam.loadPending],
  )

  const openStripMyTimeEditor = useCallback((p: { subjectUserId: string; displayName: string }) => {
    setStripMyTimeEditor(p)
  }, [])

  if (!authUser?.id) {
    return <p style={{ color: 'var(--text-muted)' }}>Sign in to view clock activity.</p>
  }

  if (!showClockStripScopeToggle && role !== 'superintendent') {
    return (
      <p style={{ color: 'var(--text-muted)' }}>You do not have access to the team clock strip.</p>
    )
  }

  const dateLabel = formatDenverCalendarDayWithWeekdayAndYear(referenceDateForWorkDateYmd(selectedYmd).getTime())

  return (
    <section style={{ marginBottom: '2rem' }}>
      {pendingBreakdownOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setPendingBreakdownOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quickfill-pending-breakdown-title"
            style={{
              background: 'var(--surface)',
              borderRadius: 10,
              maxWidth: 420,
              width: '100%',
              maxHeight: 'min(70vh, 520px)',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <h2
                id="quickfill-pending-breakdown-title"
                style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-slate-900)' }}
              >
                Pending approvals by day
              </h2>
              <button
                type="button"
                onClick={() => setPendingBreakdownOpen(false)}
                aria-label="Close"
                style={{
                  padding: '0.35rem 0.6rem',
                  borderRadius: 6,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-slate-tint)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: '0.75rem 1.25rem 1.25rem' }}>
              {pendingApprovalBreakdown.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--text-slate-500)', fontSize: '0.875rem' }}>
                  No pending approvals in the mini-calendar date range.
                </p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.5rem 0.35rem', color: 'var(--text-slate-600)', fontWeight: 600 }}>
                        Day
                      </th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.35rem', color: 'var(--text-slate-600)', fontWeight: 600 }}>
                        Sessions
                      </th>
                      <th style={{ textAlign: 'right', padding: '0.5rem 0.35rem', color: 'var(--text-slate-600)', fontWeight: 600 }}>
                        Hours
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovalBreakdown.map((row) => (
                      <tr key={row.workDate} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.35rem', color: 'var(--text-slate-900)' }}>
                          {formatDenverCalendarDayWithWeekdayAndYear(
                            referenceDateForWorkDateYmd(row.workDate).getTime(),
                          )}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0.35rem', color: '#334155' }}>{row.count}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0.35rem', color: '#334155' }}>
                          {row.hours.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      <PeopleHoursClockStripMiniCalendar
        miniCalendarYmds={miniCalendarYmds}
        todayDenver={todayDenver}
        selectedYmd={selectedYmd}
        onSelectYmd={setSelectedYmd}
        pendingUnapprovedCountByWorkDate={pendingUnapprovedCountByWorkDate}
        countsLoading={myTeam.loadingSessions}
        narrowViewport640={narrowViewport640}
      />
      {peopleHoursNavMobile ? (
        <div style={{ marginBottom: 0 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: '0.9375rem',
              textAlign: 'center',
              width: '100%',
              lineHeight: 1.3,
            }}
          >
            {dateLabel}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              marginTop: '0.5rem',
            }}
          >
            <button
              type="button"
              style={{ ...navBtnStyle, fontSize: '0.8125rem', padding: '0.35rem 0.5rem' }}
              onClick={() => setSelectedYmd((d) => shiftWorkDateYmd(d, -1))}
            >
              Previous day
            </button>
            <span style={navMobileSepStyle} aria-hidden>
              |
            </span>
            <button
              type="button"
              style={{ ...navBtnStyle, fontSize: '0.8125rem', padding: '0.35rem 0.5rem' }}
              onClick={() => setSelectedYmd((d) => shiftWorkDateYmd(d, 1))}
            >
              Next day
            </button>
            {selectedYmd !== todayDenver ? (
              <>
                <span style={navMobileSepStyle} aria-hidden>
                  |
                </span>
                <button
                  type="button"
                  style={{
                    ...navBtnStyle,
                    fontSize: '0.8125rem',
                    padding: '0.35rem 0.5rem',
                    borderColor: '#93c5fd',
                    color: 'var(--text-blue-700)',
                  }}
                  onClick={() => setSelectedYmd(todayDenver)}
                >
                  Today
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0',
          }}
        >
          <button
            type="button"
            style={navBtnStyle}
            onClick={() => setSelectedYmd((d) => shiftWorkDateYmd(d, -1))}
          >
            Previous day
          </button>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{dateLabel}</span>
          <button
            type="button"
            style={navBtnStyle}
            onClick={() => setSelectedYmd((d) => shiftWorkDateYmd(d, 1))}
          >
            Next day
          </button>
          {selectedYmd !== todayDenver && (
            <button
              type="button"
              style={{ ...navBtnStyle, borderColor: '#93c5fd', color: 'var(--text-blue-700)' }}
              onClick={() => setSelectedYmd(todayDenver)}
            >
              Today
            </button>
          )}
        </div>
      )}
      <p style={assistanceNoticeStyle}>
        Assistance only makes sure hours are correct, they do not approve!
      </p>
      <DashboardTeamActiveClockStrip
        sessions={sessionsForQuickfillStrip}
        hideCurrentlyInTable={!showLiveCurrentlyIn}
        hoursTodayByUserId={hoursTodayForStrip}
        clockedInTodayRows={myTeam.clockedInTodayStripRows}
        jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
        jobsWorkedTodayReportKeys={myTeam.jobsWorkedTodayReportKeys}
        jobsWorkedTodayReportIdByKey={myTeam.jobsWorkedTodayReportIdByKey}
        jobsWorkedTodayJobLedgerIdsWithReport={myTeam.jobsWorkedTodayJobLedgerIdsWithReport}
        showScopeToggle={showClockStripScopeToggle}
        clockStripScope={clockStripScope}
        onClockStripScopeChange={setClockStripScopePersist}
        showJobBidColumn={showClockStripScopeToggle}
        onJobBidSaved={(patch) => {
          myTeam.applyOptimisticClockSessionAssign(patch)
          void myTeam.loadPending({ silent: true })
        }}
        onJobBidAssignError={(msg) => showToast(msg, 'error')}
        onApplyScheduleProportionsForSession={applySchedule.requestApply}
        onOpenStripMyTimeEditor={showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined}
        authUserId={authUser.id}
        canApproveClockSessions={showClockStripScopeToggle}
        onClockSessionsMutated={() => {
          void myTeam.loadPending({ silent: true })
        }}
        onMaterializeSalarySession={
          showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
        }
        clockStripWorkDateYmd={selectedYmd}
      />
      <ApplyScheduleApprovedConfirmModal {...applySchedule.approvedConfirm} />
      {stripMyTimeEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={selectedYmd}
          sessions={[]}
          subjectUserId={stripMyTimeEditor.subjectUserId}
          subjectDisplayName={stripMyTimeEditor.displayName}
          jobLabels={{}}
          bidLabels={{}}
          allowNcnsFromMyTime={showClockStripScopeToggle}
          showMarkNotComingIn={showStripSubjectMyTimeEditor}
          onMarkNotComingIn={
            showStripSubjectMyTimeEditor
              ? () =>
                  void handleStripMarkNotComingIn({
                    subjectUserId: stripMyTimeEditor.subjectUserId,
                    displayName: stripMyTimeEditor.displayName,
                    workDateYmd: selectedYmd,
                  })
              : undefined
          }
          onClose={() => setStripMyTimeEditor(null)}
          onSaved={() => {
            void myTeam.loadPending({ silent: true })
            setStripMyTimeEditor(null)
          }}
          onLinkedSessionsUpdated={() => void myTeam.loadPending({ silent: true })}
        />
      )}
    </section>
  )
}
