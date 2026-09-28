import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { forceClockOutDefaultOutIso } from '../../lib/forceClockOutDefaultOut'
import type { DayEditorSession } from '../../lib/myTimeDayTimeline'
import {
  ncnsButtonTitle,
  ncnsClickAllowed,
  ncnsEntryPhase,
  ncnsRecordRpcArgs,
  type NcnsGateInput,
  type NcnsUiPhase,
} from '../../lib/myTimeNcns'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'

export type UseMyTimeNcnsFlowInput = {
  allowNcnsFromMyTime: boolean
  editingSelf: boolean
  allowPunchTimeActions: boolean
  effectiveSubjectUserId: string | null | undefined
  dateStr: string
  sortedSessions: DayEditorSession[]
  sessionsLoading: boolean
  pendingAuthForFetch: boolean
  /** The parent owns the sessions (`sessions` prop non-empty): open ones cannot be closed from here. */
  sessionsControlledByParent: boolean
  fetchDaySessionsForEditor: () => Promise<DayEditorSession[]>
  setFetchedSessions: (rows: DayEditorSession[]) => void
  onLinkedSessionsUpdated?: () => void
  onSaved: () => void
  onClose: () => void
}

/**
 * The My Time day editor's no-call-no-show flow: the schedule probe, the button's gate, the
 * pre-close sweep of open sessions, the three-phase dialog and the record RPC. The editor keeps
 * its place in `closeTopmostSubFlow` through `closeTopmost`.
 */
export function useMyTimeNcnsFlow({
  allowNcnsFromMyTime,
  editingSelf,
  allowPunchTimeActions,
  effectiveSubjectUserId,
  dateStr,
  sortedSessions,
  sessionsLoading,
  pendingAuthForFetch,
  sessionsControlledByParent,
  fetchDaySessionsForEditor,
  setFetchedSessions,
  onLinkedSessionsUpdated,
  onSaved,
  onClose,
}: UseMyTimeNcnsFlowInput) {
  const { showToast } = useToastContext()
  const [ui, setUi] = useState<NcnsUiPhase>('off')
  const [payrollAck, setPayrollAck] = useState(false)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  /** Per-sub-flow error shown inside the NCNS dialog (simple / approved_confirm). */
  const [error, setError] = useState<string | null>(null)
  const [precloseOpenSessions, setPrecloseOpenSessions] = useState<DayEditorSession[] | null>(null)
  /** Per-sub-flow error shown inside the NCNS pre-close dialog while the force-clock-out sweep runs. */
  const [precloseError, setPrecloseError] = useState<string | null>(null)
  /** When staff may record NCNS: true if assignee has a job_schedule_blocks row on dateStr (null = loading). */
  const [subjectHasScheduleBlocksForDay, setSubjectHasScheduleBlocksForDay] = useState<boolean | null>(null)

  useEffect(() => {
    if (!allowNcnsFromMyTime || editingSelf) {
      setSubjectHasScheduleBlocksForDay(false)
      return
    }
    const uid = effectiveSubjectUserId?.trim()
    if (!uid || !dateStr) {
      setSubjectHasScheduleBlocksForDay(null)
      return
    }
    let cancelled = false
    setSubjectHasScheduleBlocksForDay(null)
    void (async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            supabase
              .from('job_schedule_blocks')
              .select('id')
              .eq('assignee_user_id', uid)
              .eq('work_date', dateStr)
              .limit(1),
          'job_schedule_blocks probe for ncns',
        )
        if (cancelled) return
        const list = (rows ?? []) as { id: string }[]
        setSubjectHasScheduleBlocksForDay(list.length > 0)
      } catch {
        if (cancelled) return
        setSubjectHasScheduleBlocksForDay(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [allowNcnsFromMyTime, editingSelf, effectiveSubjectUserId, dateStr])

  const hasOpenSession = useMemo(() => sortedSessions.some((s) => !s.clocked_out_at), [sortedSessions])
  const gate: NcnsGateInput = {
    allowNcnsFromMyTime,
    editingSelf,
    allowPunchTimeActions,
    hasSubjectUser: !!effectiveSubjectUserId,
    sessionsLoading,
    pendingAuthForFetch,
    sessionCount: sortedSessions.length,
    hasOpenSession,
    subjectHasScheduleBlocksForDay,
  }
  const clickAllowed = ncnsClickAllowed(gate)
  const buttonTitle = ncnsButtonTitle(gate)

  useEffect(() => {
    setUi('off')
    setPayrollAck(false)
    setDetails('')
  }, [dateStr, effectiveSubjectUserId])

  const record = useCallback(async () => {
    if (!effectiveSubjectUserId) return
    setBusy(true)
    setError(null)
    try {
      const data = await withSupabaseRetry(
        async () =>
          supabase.rpc(
            'record_ncns_and_reject_sessions_for_day',
            ncnsRecordRpcArgs(effectiveSubjectUserId, dateStr, details),
          ),
        'record ncns and reject sessions for day'
      )
      const row = (data ?? [])[0] as
        | { rejected_count: number; had_approved_sessions: boolean; error_message: string | null }
        | undefined
      if (row?.error_message) {
        setError(row.error_message)
        return
      }
      setUi('off')
      setPayrollAck(false)
      setDetails('')
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(formatErrorMessage(e, 'Could not record NCNS'))
    } finally {
      setBusy(false)
    }
  }, [dateStr, effectiveSubjectUserId, details, onClose, onSaved])

  const enterDialogFromSessions = useCallback((rows: DayEditorSession[]) => {
    setPayrollAck(false)
    setDetails('')
    setError(null)
    setUi(ncnsEntryPhase(rows))
  }, [])

  const forceClockOutOpenSessionsThenOpen = useCallback(
    async (openSessions: DayEditorSession[]) => {
      setBusy(true)
      setPrecloseError(null)
      try {
        for (const s of openSessions) {
          const outIso = forceClockOutDefaultOutIso(s.clocked_in_at)
          await withSupabaseRetry(
            async () =>
              supabase.from('clock_sessions').update({ clocked_out_at: outIso }).eq('id', s.id),
            'force clock out before ncns',
          )
        }
        onLinkedSessionsUpdated?.()
        const rows = await fetchDaySessionsForEditor()
        if (rows.some((s) => !s.clocked_out_at)) {
          const msg = 'Could not close all sessions. Try again.'
          setPrecloseError(msg)
          showToast(msg, 'error')
          return
        }
        setFetchedSessions(rows)
        enterDialogFromSessions(rows)
      } catch (e: unknown) {
        const msg = formatErrorMessage(e, 'Could not clock out before NCNS')
        setPrecloseError(msg)
        showToast(msg, 'error')
      } finally {
        setBusy(false)
      }
    },
    [
      enterDialogFromSessions,
      fetchDaySessionsForEditor,
      onLinkedSessionsUpdated,
      setFetchedSessions,
      showToast,
    ],
  )

  const closePreclose = useCallback(() => {
    if (busy) return
    setPrecloseError(null)
    setPrecloseOpenSessions(null)
  }, [busy])

  const continuePreclose = useCallback(() => {
    if (!precloseOpenSessions?.length) return
    const toClose = precloseOpenSessions
    setPrecloseOpenSessions(null)
    void forceClockOutOpenSessionsThenOpen(toClose)
  }, [forceClockOutOpenSessionsThenOpen, precloseOpenSessions])

  const onButtonClick = useCallback(() => {
    if (!clickAllowed) {
      showToast(buttonTitle || 'Cannot record NCNS right now.', 'warning')
      return
    }
    if (!hasOpenSession) {
      enterDialogFromSessions(sortedSessions)
      return
    }
    if (sessionsControlledByParent) {
      showToast(
        'Close open sessions in this view first, or refresh after clocking out elsewhere.',
        'warning',
      )
      return
    }
    const openSessions = sortedSessions.filter((s) => !s.clocked_out_at)
    setPrecloseError(null)
    setPrecloseOpenSessions(openSessions)
  }, [
    clickAllowed,
    hasOpenSession,
    sortedSessions,
    sessionsControlledByParent,
    enterDialogFromSessions,
    showToast,
    buttonTitle,
  ])

  /** Cancel in the `simple` and `approved_warn` phases. The buttons are disabled while busy. */
  const cancelDialog = useCallback(() => {
    setUi('off')
    setPayrollAck(false)
    setDetails('')
  }, [])

  /** Backdrop of the three-phase dialog: as Cancel, held while busy. */
  const dismissDialog = useCallback(() => {
    if (busy) return
    setUi('off')
    setPayrollAck(false)
    setDetails('')
  }, [busy])

  /** `approved_warn` → `approved_confirm`, the acknowledgement unticked. */
  const continueToConfirm = useCallback(() => {
    setPayrollAck(false)
    setUi('approved_confirm')
  }, [])

  /** `approved_confirm` → `approved_warn`; the details typed so far are kept. */
  const backToWarn = useCallback(() => {
    setUi('approved_warn')
    setPayrollAck(false)
  }, [])

  /**
   * The editor's `closeTopmostSubFlow` entries for this flow, in their order: the dialog, then
   * the pre-close. True when one was open — busy holds it open and still returns true.
   */
  const closeTopmost = useCallback((): boolean => {
    if (ui !== 'off') {
      if (!busy) {
        setUi('off')
        setPayrollAck(false)
        setDetails('')
      }
      return true
    }
    if (precloseOpenSessions) {
      if (!busy) setPrecloseOpenSessions(null)
      return true
    }
    return false
  }, [ui, busy, precloseOpenSessions])

  return {
    ui,
    payrollAck,
    details,
    busy,
    error,
    precloseOpenSessions,
    precloseError,
    clickAllowed,
    buttonTitle,
    setPayrollAck,
    setDetails,
    onButtonClick,
    record,
    closePreclose,
    continuePreclose,
    cancelDialog,
    dismissDialog,
    continueToConfirm,
    backToWarn,
    closeTopmost,
  }
}

export type MyTimeNcnsFlow = ReturnType<typeof useMyTimeNcnsFlow>
