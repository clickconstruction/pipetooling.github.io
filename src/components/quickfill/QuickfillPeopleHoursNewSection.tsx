import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { DashboardTeamActiveClockStrip } from '../DashboardTeamActiveClockStrip'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { useAuth } from '../../hooks/useAuth'
import { useDashboardMyTeamSectionState } from '../../hooks/useDashboardMyTeamSectionState'
import { useToastContext } from '../../contexts/ToastContext'
import {
  denverCalendarDayKey,
  formatDenverCalendarDayWithYear,
  getDefaultWeekRange,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'
import { syncSalaryClockSessionsForUserDay } from '../../lib/salaryScheduleSync'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import type { ClockSessionRow, DashboardStripSession } from '../../types/clockSessions'

const DASHBOARD_CLOCK_STRIP_SCOPE_KEY = 'dashboard_clock_strip_scope'

function readClockStripScope(): 'team' | 'everyone' {
  try {
    if (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY) === 'everyone'
    ) {
      return 'everyone'
    }
  } catch {
    /* ignore */
  }
  return 'team'
}

/** Pure Gregorian YYYY-MM-DD ± n days (civil dates). */
function shiftWorkDateYmd(ymd: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return ymd
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const base = new Date(Date.UTC(y, mo, d))
  base.setUTCDate(base.getUTCDate() + deltaDays)
  const yy = base.getUTCFullYear()
  const mm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(base.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const navBtnStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: 'white',
  cursor: 'pointer',
  fontSize: '0.875rem',
}

const assistanceNoticeStyle: CSSProperties = {
  textAlign: 'center',
  fontSize: '0.875rem',
  margin: '0.625rem 0 1rem',
  padding: '0.5rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #fbbf24',
  background: '#fef3c7',
  color: '#92400e',
  fontWeight: 500,
}

export function QuickfillPeopleHoursNewSection() {
  const { user: authUser, role } = useAuth()
  const { showToast } = useToastContext()
  const [selectedYmd, setSelectedYmd] = useState(() => denverCalendarDayKey(Date.now()))
  const [clockStripScope, setClockStripScope] = useState<'team' | 'everyone'>(readClockStripScope)
  const [stripMyTimeEditor, setStripMyTimeEditor] = useState<{
    subjectUserId: string
    displayName: string
  } | null>(null)

  const setClockStripScopePersist = useCallback((next: 'team' | 'everyone') => {
    setClockStripScope(next)
    try {
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor = showClockStripScopeToggle || role === 'superintendent'
  const orgWideStripEnabled = showClockStripScopeToggle && clockStripScope === 'everyone'

  const myTeam = useDashboardMyTeamSectionState(authUser?.id, {
    orgWideStripEnabled,
    stripWorkDateYmd: selectedYmd,
  })

  const todayDenver = denverCalendarDayKey(Date.now())
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
    return <p style={{ color: '#6b7280' }}>Sign in to view clock activity.</p>
  }

  if (!showClockStripScopeToggle && role !== 'superintendent') {
    return (
      <p style={{ color: '#6b7280' }}>You do not have access to the team clock strip.</p>
    )
  }

  const dateLabel = formatDenverCalendarDayWithYear(referenceDateForWorkDateYmd(selectedYmd).getTime())

  return (
    <section style={{ marginBottom: '2rem' }}>
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
            style={{ ...navBtnStyle, borderColor: '#93c5fd', color: '#1d4ed8' }}
            onClick={() => setSelectedYmd(todayDenver)}
          >
            Today
          </button>
        )}
      </div>
      <p style={assistanceNoticeStyle}>
        Assistance only makes sure hours are correct, they do not approve!
      </p>
      <DashboardTeamActiveClockStrip
        sessions={sessionsForQuickfillStrip}
        hideCurrentlyInTable={!showLiveCurrentlyIn}
        hoursTodayByUserId={hoursTodayForStrip}
        clockedInTodayRows={myTeam.clockedInTodayStripRows}
        jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
        showScopeToggle={showClockStripScopeToggle}
        clockStripScope={clockStripScope}
        onClockStripScopeChange={setClockStripScopePersist}
        showJobBidColumn={showClockStripScopeToggle}
        onJobBidSaved={(patch) => {
          myTeam.applyOptimisticClockSessionAssign(patch)
          void myTeam.loadPending({ silent: true })
        }}
        onJobBidAssignError={(msg) => showToast(msg, 'error')}
        onOpenStripMyTimeEditor={showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined}
        authUserId={authUser.id}
        canApproveClockSessions={showClockStripScopeToggle}
        onClockSessionsMutated={() => {
          void myTeam.loadPending({ silent: true })
        }}
        onMaterializeSalarySession={
          showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
        }
      />
      {stripMyTimeEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={selectedYmd}
          sessions={[]}
          subjectUserId={stripMyTimeEditor.subjectUserId}
          subjectDisplayName={stripMyTimeEditor.displayName}
          editableRange={getDefaultWeekRange()}
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
