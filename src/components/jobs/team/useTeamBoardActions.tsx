import { useCallback, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../../contexts/ToastContext'
import { useConfirmDialog } from '../../../contexts/ConfirmDialogContext'
import { linkClockSessionsToPick, partialLinkMessage } from '../../../lib/linkClockSessionsToPick'
import { crewLinkSuccessMessage } from '../../../lib/crewAssignSessionLinkPlan'
import { insertJobScheduleBlock } from '../../../lib/jobScheduleBlocks'
import { recordNotComingInForUserAsStaff } from '../../../lib/notComingInTimeOff'
import { CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES } from '../../../lib/scheduleDispatchEditRoles'
import { formatBoardDay, formatHours2, pickFromTargetKey, plannedWindowFromClock, teamAckKey, teamAckKindFor, type TeamBoard, type TeamCell, type TeamException } from '../../../lib/teamBoard'
import { supabase } from '../../../lib/supabase'
import { companyWeekStartSundayContaining } from '../../../utils/dateUtils'
import { AssignFocusModal } from '../../AssignFocusModal'
import { ClockSessionEditSplitModal } from '../../ClockSessionEditSplitModal'
import { DashboardMyTimeDayEditorModal } from '../../DashboardMyTimeDayEditorModal'
import { smallButton, smallPrimaryButton } from './teamBoardStyles'

/** Who may act: the same cohort that edits sessions elsewhere. RLS still has the last word (0-row updates toast). */
export function canActOnTeamBoard(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'controller'
}

type PickTarget = { sessionIds: string[]; label: string }
type DayTarget = { userId: string; personName: string; workDate: string }

/**
 * v2.2978: the actions behind every chip, ledger row and exception. Each one
 * writes to the clock session or the dispatch plan — never to the crew split —
 * then reloads the week.
 *
 *   not on a job  → Link to <dispatch block> · Pick job… · Split day…
 *   planned, no clock → Add session · Not coming in · Adjust plan (Schedule Dispatch)
 *   clocked, not planned → Move to plan · Split day…
 *   ran long / on plan → Split day… / Open day
 */
export function useTeamBoardActions({ board, reload, role, authUserId, ackIdByKey = {} }: { board: TeamBoard | null; reload: () => void; role: string | null | undefined; authUserId: string | null | undefined; ackIdByKey?: Record<string, string> }) {
  const { showToast } = useToastContext()
  const confirm = useConfirmDialog()
  const navigate = useNavigate()
  const canEdit = canActOnTeamBoard(role)
  const canEditDispatch = !!role && CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES.has(role)
  const [pick, setPick] = useState<PickTarget | null>(null)
  const [dayEditor, setDayEditor] = useState<DayTarget | null>(null)
  const [addSession, setAddSession] = useState<DayTarget | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const labelOf = useCallback((key: string) => board?.labels[key]?.label ?? key, [board])

  const linkTo = useCallback(
    async (key: string, sessionIds: string[], targetKey: string, personName: string, hours: number) => {
      const pickTarget = pickFromTargetKey(targetKey)
      if (!pickTarget || sessionIds.length === 0) return
      setBusyKey(key)
      const { updated, error } = await linkClockSessionsToPick(sessionIds, pickTarget)
      setBusyKey(null)
      if (error) {
        showToast(`Could not link ${personName}'s sessions: ${error}`, 'error')
        return
      }
      if (updated < sessionIds.length) {
        showToast(partialLinkMessage(personName, updated, sessionIds.length), 'warning', 8000)
        if (updated === 0) return
      } else {
        showToast(crewLinkSuccessMessage(updated, hours, labelOf(targetKey)), 'success')
      }
      reload()
    },
    [labelOf, reload, showToast],
  )

  const notComingIn = useCallback(
    async (key: string, target: DayTarget) => {
      const ok = await confirm({
        title: 'Not coming in?',
        message: `${target.personName} · ${formatBoardDay(target.workDate)}: records an unpaid day off for the day. The dispatch blocks stay on the plan.`,
        confirmLabel: 'Record day off',
      })
      if (!ok) return
      setBusyKey(key)
      const r = await recordNotComingInForUserAsStaff({ subjectUserId: target.userId, workDateYmd: target.workDate })
      setBusyKey(null)
      if (!r.ok) {
        showToast(r.message, 'error')
        return
      }
      showToast(r.alreadyMarked ? `${target.personName} already has time off that day.` : `${target.personName} marked not coming in on ${formatBoardDay(target.workDate)}.`, r.alreadyMarked ? 'info' : 'success')
      reload()
    },
    [confirm, reload, showToast],
  )

  const moveToPlan = useCallback(
    async (key: string, cell: TeamCell) => {
      const pickTarget = pickFromTargetKey(cell.targetKey)
      const win = plannedWindowFromClock(cell)
      if (!pickTarget || !win || !cell.userId || !authUserId) return
      setBusyKey(key)
      const { error } = await insertJobScheduleBlock({
        job_id: pickTarget.type === 'job' ? pickTarget.id : null,
        bid_id: pickTarget.type === 'bid' ? pickTarget.id : null,
        assignee_user_id: cell.userId,
        work_date: cell.workDate,
        time_start: win.time_start,
        time_end: win.time_end,
        note: 'From the clock (Team board)',
        created_by: authUserId,
      })
      setBusyKey(null)
      if (error) {
        showToast(`Could not add the dispatch block: ${error}`, 'error')
        return
      }
      showToast(`Added ${cell.personName} to the plan for ${labelOf(cell.targetKey)} on ${formatBoardDay(cell.workDate)} (${formatHours2(cell.clockHours)} h clocked).`, 'success')
      reload()
    },
    [authUserId, labelOf, reload, showToast],
  )

  /** v2.2981: "Looks right" — accept a ran-long / not-planned chip; "Undo" deletes the row. */
  const looksRight = useCallback(
    async (key: string, cell: TeamCell) => {
      const kind = teamAckKindFor(cell)
      if (!kind || !cell.userId || !authUserId) return
      const pickTarget = pickFromTargetKey(cell.targetKey)
      setBusyKey(key)
      const { error } = await supabase.from('team_board_acks').insert({
        kind,
        work_date: cell.workDate,
        person_user_id: cell.userId,
        target_key: cell.targetKey,
        job_ledger_id: pickTarget?.type === 'job' ? pickTarget.id : null,
        bid_id: pickTarget?.type === 'bid' ? pickTarget.id : null,
        acked_by: authUserId,
      })
      setBusyKey(null)
      if (error) {
        showToast(`Could not record it: ${error.message}`, 'error')
        return
      }
      showToast(`Accepted — ${cell.personName} on ${labelOf(cell.targetKey)}, ${formatBoardDay(cell.workDate)}. Undo from the chip.`, 'success')
      reload()
    },
    [authUserId, labelOf, reload, showToast],
  )
  const undoAck = useCallback(
    async (key: string, cell: TeamCell) => {
      const kind = teamAckKindFor(cell)
      const id = kind && cell.userId ? ackIdByKey[teamAckKey(kind, cell.workDate, cell.userId, cell.targetKey)] : undefined
      if (!id) return
      setBusyKey(key)
      const { error } = await supabase.from('team_board_acks').delete().eq('id', id)
      setBusyKey(null)
      if (error) {
        showToast(`Could not undo: ${error.message}`, 'error')
        return
      }
      reload()
    },
    [ackIdByKey, reload, showToast],
  )

  const adjustPlan = useCallback(
    (workDate: string) => {
      const weekStart = companyWeekStartSundayContaining(workDate) ?? workDate
      navigate(`/schedule-dispatch?week=${encodeURIComponent(weekStart)}&day=${encodeURIComponent(workDate)}`)
    },
    [navigate],
  )

  const btn = (key: string, label: string, onClick: () => void, primary = false, title?: string) => (
    <button key={label} type="button" disabled={busyKey === key} onClick={onClick} title={title} style={{ ...(primary ? smallPrimaryButton : smallButton), cursor: busyKey === key ? 'not-allowed' : 'pointer' }}>
      {label}
    </button>
  )

  const renderCellActions = useCallback(
    (cell: TeamCell): ReactNode => {
      if (!canEdit) return null
      const key = `${cell.targetKey}|${cell.workDate}|${cell.personName}`
      const day: DayTarget | null = cell.userId ? { userId: cell.userId, personName: cell.personName, workDate: cell.workDate } : null
      const out: ReactNode[] = []
      if (cell.kind === 'unlinked') {
        const sug = board?.exceptions.find((e) => e.kind === 'unlinked' && e.workDate === cell.workDate && e.personName === cell.personName)?.suggestion ?? null
        if (sug) out.push(btn(key, `Link to ${labelOf(sug.targetKey).split(' · ')[0]}`, () => void linkTo(key, cell.unlinkedSessionIds, sug.targetKey, cell.personName, cell.clockHours), true, `Put ${labelOf(sug.targetKey)} on ${cell.unlinkedSessionIds.length === 1 ? 'this session' : 'these sessions'}`))
        out.push(btn(key, 'Pick job…', () => setPick({ sessionIds: cell.unlinkedSessionIds, label: `${cell.personName} · ${formatBoardDay(cell.workDate)} · ${formatHours2(cell.clockHours)} h` })))
        if (day) out.push(btn(key, 'Split day…', () => setDayEditor(day)))
      } else if (cell.kind === 'miss') {
        if (day) out.push(btn(key, 'Add session', () => setAddSession(day), false, 'Add a clock session for this day'))
        if (day) out.push(btn(key, 'Not coming in', () => void notComingIn(key, day)))
        if (canEditDispatch) out.push(btn(key, 'Adjust plan', () => adjustPlan(cell.workDate), false, 'Open this day in Schedule Dispatch'))
      } else if (cell.kind === 'unplanned') {
        if (cell.acked) out.push(btn(key, 'Undo accept', () => void undoAck(key, cell), false, 'Show this chip as an exception again'))
        else out.push(btn(key, 'Looks right', () => void looksRight(key, cell), false, 'Accept the clocked time as it is — the chip stops showing as an exception'))
        if (canEditDispatch && cell.userId && !cell.acked) out.push(btn(key, 'Move to plan', () => void moveToPlan(key, cell), true, 'Add a dispatch block matching the clocked span'))
        if (day) out.push(btn(key, 'Split day…', () => setDayEditor(day)))
      } else if (cell.kind === 'ok') {
        if (cell.over) {
          if (cell.acked) out.push(btn(key, 'Undo accept', () => void undoAck(key, cell), false, 'Show this chip as ran long again'))
          else out.push(btn(key, 'Looks right', () => void looksRight(key, cell), false, 'Accept the overrun — the chip stops showing as an exception'))
        }
        if (day) out.push(btn(key, cell.over ? 'Split day…' : 'Open day', () => setDayEditor(day)))
      }
      return out.length ? <>{out}</> : null
    },
    [adjustPlan, board, canEdit, canEditDispatch, labelOf, linkTo, looksRight, moveToPlan, notComingIn, undoAck],
  )

  const renderExceptionActions = useCallback(
    (e: TeamException): ReactNode => {
      if (!canEdit) return null
      const key = `${e.targetKey}|${e.workDate}|${e.personName}`
      const day: DayTarget | null = e.userId ? { userId: e.userId, personName: e.personName, workDate: e.workDate } : null
      const out: ReactNode[] = []
      if (e.kind === 'unlinked') {
        if (e.suggestion) out.push(btn(key, `Link to ${labelOf(e.suggestion.targetKey).split(' · ')[0]}`, () => void linkTo(key, e.sessionIds, e.suggestion!.targetKey, e.personName, e.hours), true))
        out.push(btn(key, 'Pick job…', () => setPick({ sessionIds: e.sessionIds, label: `${e.personName} · ${formatBoardDay(e.workDate)} · ${formatHours2(e.hours)} h` })))
        if (day) out.push(btn(key, 'Split day…', () => setDayEditor(day)))
      } else if (e.kind === 'miss') {
        if (day) out.push(btn(key, 'Add session', () => setAddSession(day)))
        if (day) out.push(btn(key, 'Not coming in', () => void notComingIn(key, day)))
        if (canEditDispatch) out.push(btn(key, 'Adjust plan', () => adjustPlan(e.workDate)))
      } else {
        const cell = board?.cells.find((c) => c.targetKey === e.targetKey && c.workDate === e.workDate && c.personName === e.personName)
        if (cell) out.push(btn(key, 'Looks right', () => void looksRight(key, cell)))
        if (e.kind === 'unplanned' && canEditDispatch && cell?.userId) out.push(btn(key, 'Move to plan', () => void moveToPlan(key, cell), true))
        if (day) out.push(btn(key, 'Split day…', () => setDayEditor(day)))
      }
      return out.length ? <>{out}</> : null
    },
    [adjustPlan, board, canEdit, canEditDispatch, labelOf, linkTo, looksRight, moveToPlan, notComingIn],
  )

  const modals = (
    <>
      {pick ? (
        <AssignFocusModal
          sessionIds={pick.sessionIds}
          label={pick.label}
          overlayZIndex={1200}
          onClose={() => setPick(null)}
          onSaved={() => {
            showToast('Linked — the split recomputes from the clock.', 'success')
            reload()
          }}
        />
      ) : null}
      {dayEditor ? (
        <DashboardMyTimeDayEditorModal
          dateStr={dayEditor.workDate}
          sessions={[]}
          subjectUserId={dayEditor.userId}
          subjectDisplayName={dayEditor.personName}
          onClose={() => setDayEditor(null)}
          onSaved={() => {
            setDayEditor(null)
            reload()
          }}
          onLinkedSessionsUpdated={reload}
        />
      ) : null}
      {addSession ? (
        <ClockSessionEditSplitModal
          createFor={{ userId: addSession.userId, workDate: addSession.workDate }}
          zIndex={1200}
          onClose={() => setAddSession(null)}
          onSaved={() => {
            setAddSession(null)
            reload()
          }}
          showToast={(m, v) => showToast(m, v)}
        />
      ) : null}
    </>
  )

  return { canEdit, renderCellActions, renderExceptionActions, modals }
}
