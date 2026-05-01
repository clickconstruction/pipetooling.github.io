import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { ClockSessionRow, DashboardStripSession } from '../../types/clockSessions'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useDashboardMyTeamSectionState } from '../../hooks/useDashboardMyTeamSectionState'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { DashboardTeamActiveClockStrip } from '../DashboardTeamActiveClockStrip'
import { DashboardMyTimeDayEditorModal } from '../DashboardMyTimeDayEditorModal'
import { syncSalaryClockSessionsForUserDay } from '../../lib/salaryScheduleSync'
import { recordNotComingInForUserAsStaff } from '../../lib/notComingInTimeOff'
import { fetchSalariedUserIdSetFromUserIds } from '../../lib/salaryPayConfigGate'
import { fetchHoursDaysCorrectWorkDates } from '../../lib/fetchHoursDaysCorrectWorkDates'
import {
  denverCalendarDayKey,
  formatDenverCalendarDayWithWeekdayAndYear,
  getDefaultWeekRange,
  getLastWeekRange,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'
import { enCaWeekRangeContainingYmd, shiftWorkDateYmd } from '../../lib/peopleHoursClockStripSelectedDay'
import type { AssignSessionJobSavedPatch } from '../clock-sessions/AssignSessionJobPopover'
import {
  DASHBOARD_CLOCK_STRIP_SCOPE_KEY,
  readClockStripScopeFromStorage,
  stripScopeEligible,
} from '../../lib/dashboardClockStripScopeStorage'

const HOURS_DAY_CORRECT_BLOCK_TOAST =
  'This day is marked correct in People → Hours. Unmark it there to edit time from the Dashboard.'

const navBtnStyle: CSSProperties = {
  padding: '0.35rem 0.65rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  background: 'white',
  cursor: 'pointer',
  fontSize: '0.875rem',
}

const navMobileSepStyle: CSSProperties = {
  color: '#9ca3af',
  userSelect: 'none',
  fontSize: '0.875rem',
  padding: '0 0.15rem',
}

type Props = {
  onSessionsChanged?: () => void
}

export function PeopleHoursDashboardClockStrip({ onSessionsChanged }: Props) {
  const { user: authUser, role } = useAuth()
  const narrowViewport640 = useNarrowViewport640()
  const { showToast } = useToastContext()
  const showClockStripScopeToggle =
    role === 'dev' || role === 'master_technician' || role === 'assistant'
  const showStripSubjectMyTimeEditor =
    showClockStripScopeToggle || role === 'superintendent'

  const [selectedYmd, setSelectedYmd] = useState(() => denverCalendarDayKey(Date.now()))

  const [clockStripScope, setClockStripScope] = useState<'team' | 'everyone'>(() =>
    readClockStripScopeFromStorage(role),
  )
  const setClockStripScopePersist = useCallback((next: 'team' | 'everyone') => {
    setClockStripScope(next)
    try {
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!stripScopeEligible(role)) return
    try {
      if (typeof localStorage === 'undefined') return
      if (localStorage.getItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY) != null) return
      localStorage.setItem(DASHBOARD_CLOCK_STRIP_SCOPE_KEY, 'everyone')
      setClockStripScope('everyone')
    } catch {
      /* ignore */
    }
  }, [role])

  const orgWideStripEnabled = showClockStripScopeToggle && clockStripScope === 'everyone'

  const pendingWorkDateRange = useMemo(() => enCaWeekRangeContainingYmd(selectedYmd), [selectedYmd])

  const myTeam = useDashboardMyTeamSectionState(authUser?.id, {
    orgWideStripEnabled,
    stripWorkDateYmd: selectedYmd,
    pendingWorkDateRange,
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

  const sessionsForPeopleStrip = useMemo(
    () => (showLiveCurrentlyIn ? sessionsForStrip : []),
    [showLiveCurrentlyIn, sessionsForStrip],
  )

  const hoursTodayForStrip = useMemo(() => {
    if (showClockStripScopeToggle && clockStripScope === 'everyone') {
      return myTeam.hoursTodayByUserIdOrg
    }
    return myTeam.hoursTodayByUserId
  }, [showClockStripScopeToggle, clockStripScope, myTeam.hoursTodayByUserIdOrg, myTeam.hoursTodayByUserId])

  const stripPayGateUserIds = useMemo(() => {
    const ids = new Set<string>()
    if (authUser?.id) ids.add(authUser.id)
    for (const id of myTeam.memberUserIds) ids.add(id)
    for (const s of sessionsForStrip) ids.add(s.user_id)
    for (const r of myTeam.clockedInTodayStripRows) ids.add(r.userId)
    return [...ids]
  }, [authUser?.id, myTeam.memberUserIds, sessionsForStrip, myTeam.clockedInTodayStripRows])

  const [stripSalariedUserIds, setStripSalariedUserIds] = useState<ReadonlySet<string>>(() => new Set())

  useEffect(() => {
    if (stripPayGateUserIds.length === 0) {
      setStripSalariedUserIds(new Set())
      return
    }
    let cancelled = false
    void fetchSalariedUserIdSetFromUserIds(stripPayGateUserIds).then((set) => {
      if (!cancelled) setStripSalariedUserIds(set)
    })
    return () => {
      cancelled = true
    }
  }, [stripPayGateUserIds])

  const hoursDaysCorrectRange = useMemo(() => {
    const { start: w0, end: w1 } = getDefaultWeekRange()
    const { start: l0, end: l1 } = getLastWeekRange()
    const today = denverCalendarDayKey(Date.now())
    const strip = myTeam.clockStripWorkDateYmd
    const keys = [w0, w1, l0, l1, today, strip, selectedYmd]
    const start = keys.reduce((a, b) => (a < b ? a : b))
    const end = keys.reduce((a, b) => (a > b ? a : b))
    return { start, end }
  }, [myTeam.clockStripWorkDateYmd, selectedYmd])

  const [hoursDaysCorrectSet, setHoursDaysCorrectSet] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!authUser?.id) return
    let cancelled = false
    void (async () => {
      try {
        const set = await fetchHoursDaysCorrectWorkDates(hoursDaysCorrectRange.start, hoursDaysCorrectRange.end)
        if (!cancelled) setHoursDaysCorrectSet(set)
      } catch {
        if (!cancelled) setHoursDaysCorrectSet(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUser?.id, hoursDaysCorrectRange.start, hoursDaysCorrectRange.end])

  const [stripMyTimeEditor, setStripMyTimeEditor] = useState<{
    subjectUserId: string
    displayName: string
    showSalariedStripFooter: boolean
    clockTimesReadOnly: boolean
  } | null>(null)

  const openStripMyTimeEditor = useCallback(
    (p: { subjectUserId: string; displayName: string }) => {
      if (hoursDaysCorrectSet.has(selectedYmd)) {
        showToast(HOURS_DAY_CORRECT_BLOCK_TOAST, 'warning')
        return
      }
      setStripMyTimeEditor({
        ...p,
        showSalariedStripFooter: stripSalariedUserIds.has(p.subjectUserId),
        clockTimesReadOnly: !showClockStripScopeToggle,
      })
    },
    [
      hoursDaysCorrectSet,
      selectedYmd,
      showClockStripScopeToggle,
      showToast,
      stripSalariedUserIds,
    ],
  )

  useEffect(() => {
    setStripMyTimeEditor((prev) => {
      if (!prev) return prev
      const shouldShow = stripSalariedUserIds.has(prev.subjectUserId)
      if (shouldShow === prev.showSalariedStripFooter) return prev
      return { ...prev, showSalariedStripFooter: shouldShow }
    })
  }, [stripSalariedUserIds])

  const bumpParentClockTables = useCallback(() => {
    onSessionsChanged?.()
  }, [onSessionsChanged])

  const materializeSalarySessionForStrip = useCallback(
    async (userId: string) => {
      const { error } = await syncSalaryClockSessionsForUserDay(userId, selectedYmd)
      if (error) {
        showToast(error, 'error')
        return
      }
      await myTeam.loadPending({ silent: true })
      bumpParentClockTables()
    },
    [selectedYmd, showToast, myTeam.loadPending, bumpParentClockTables],
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
      bumpParentClockTables()
    },
    [showToast, myTeam.loadPending, bumpParentClockTables],
  )

  const onSessionsMutated = useCallback(() => {
    void myTeam.loadPending({ silent: true })
    bumpParentClockTables()
  }, [myTeam.loadPending, bumpParentClockTables])

  const onStripJobBidSaved = useCallback(
    (patch: AssignSessionJobSavedPatch) => {
      myTeam.applyOptimisticClockSessionAssign(patch)
      void myTeam.loadPending({ silent: true })
      bumpParentClockTables()
    },
    [myTeam.applyOptimisticClockSessionAssign, myTeam.loadPending, bumpParentClockTables],
  )

  const dateLabel = formatDenverCalendarDayWithWeekdayAndYear(referenceDateForWorkDateYmd(selectedYmd).getTime())

  if (!authUser?.id) {
    return null
  }

  return (
    <section style={{ marginBottom: '1rem' }}>
      {narrowViewport640 ? (
        <div style={{ marginBottom: '0.65rem' }}>
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
                    color: '#1d4ed8',
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
            marginBottom: '0.65rem',
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
          <button type="button" style={navBtnStyle} onClick={() => setSelectedYmd((d) => shiftWorkDateYmd(d, 1))}>
            Next day
          </button>
          {selectedYmd !== todayDenver ? (
            <button
              type="button"
              style={{ ...navBtnStyle, borderColor: '#93c5fd', color: '#1d4ed8' }}
              onClick={() => setSelectedYmd(todayDenver)}
            >
              Today
            </button>
          ) : null}
        </div>
      )}

      <DashboardTeamActiveClockStrip
        sessions={sessionsForPeopleStrip}
        hideCurrentlyInTable={!showLiveCurrentlyIn}
        hoursTodayByUserId={hoursTodayForStrip}
        clockedInTodayRows={myTeam.clockedInTodayStripRows}
        jobsWorkedTodayRows={myTeam.jobsWorkedTodayStripRows}
        jobsWorkedTodayReportKeys={myTeam.jobsWorkedTodayReportKeys}
        jobsWorkedTodayReportIdByKey={myTeam.jobsWorkedTodayReportIdByKey}
        jobsWorkedTodayJobLedgerIdsWithReport={myTeam.jobsWorkedTodayJobLedgerIdsWithReport}
        showScopeToggle={showClockStripScopeToggle}
        clockStripScope={clockStripScope}
        clockStripNarrowScopeLabel={showClockStripScopeToggle ? 'Everyone' : undefined}
        clockStripWideScopeLabel={showClockStripScopeToggle ? 'Organization' : undefined}
        onClockStripScopeChange={setClockStripScopePersist}
        showJobBidColumn={showClockStripScopeToggle}
        onJobBidSaved={onStripJobBidSaved}
        onJobBidAssignError={(msg) => showToast(msg, 'error')}
        onOpenStripMyTimeEditor={showStripSubjectMyTimeEditor ? openStripMyTimeEditor : undefined}
        authUserId={authUser.id}
        canApproveClockSessions={showClockStripScopeToggle}
        onClockSessionsMutated={onSessionsMutated}
        onMaterializeSalarySession={
          showClockStripScopeToggle ? materializeSalarySessionForStrip : undefined
        }
        enableCopyDayJobMix={showClockStripScopeToggle}
        clockStripWorkDateYmd={selectedYmd}
      />

      {stripMyTimeEditor && (
        <DashboardMyTimeDayEditorModal
          dateStr={selectedYmd}
          sessions={[]}
          subjectUserId={stripMyTimeEditor.subjectUserId}
          subjectDisplayName={stripMyTimeEditor.displayName}
          showSalariedLabelUnderVisualStrip={stripMyTimeEditor.showSalariedStripFooter}
          prefetchSalarySessionsWhenEmpty
          clockTimesReadOnly={stripMyTimeEditor.clockTimesReadOnly}
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
            bumpParentClockTables()
          }}
          onLinkedSessionsUpdated={() => {
            void myTeam.loadPending({ silent: true })
            bumpParentClockTables()
          }}
        />
      )}
    </section>
  )
}
