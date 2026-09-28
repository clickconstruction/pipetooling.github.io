/**
 * No-call-no-show (NCNS) rules of the My Time day editor: when the button may be pressed, what
 * its tooltip says, which dialog a day opens on, and what the record RPC is sent. Pure — the
 * state and the writes live in `useMyTimeNcnsFlow`.
 */
import type { DayEditorSession } from './myTimeDayTimeline'

export const NCNS_DETAILS_MAX_LEN = 4000

/** `off` = no dialog; `simple` = nothing approved; approved days warn, then confirm. */
export type NcnsUiPhase = 'off' | 'simple' | 'approved_warn' | 'approved_confirm'

export type NcnsGateInput = {
  /** The mount's `allowNcnsFromMyTime` prop (dev / master / assistant seats). */
  allowNcnsFromMyTime: boolean
  editingSelf: boolean
  /** False in the dashboard clock preview, where punch times are read-only. */
  allowPunchTimeActions: boolean
  hasSubjectUser: boolean
  sessionsLoading: boolean
  pendingAuthForFetch: boolean
  sessionCount: number
  hasOpenSession: boolean
  /** Whether the person has a `job_schedule_blocks` row on the day; null while the probe runs. */
  subjectHasScheduleBlocksForDay: boolean | null
}

/** A day with clock sessions can always be recorded; an empty day only when the person was scheduled. */
export function ncnsClickAllowed(i: NcnsGateInput): boolean {
  return (
    i.allowNcnsFromMyTime &&
    !i.editingSelf &&
    i.allowPunchTimeActions &&
    i.hasSubjectUser &&
    !i.sessionsLoading &&
    !i.pendingAuthForFetch &&
    (i.sessionCount > 0 || i.subjectHasScheduleBlocksForDay !== null) &&
    (i.sessionCount > 0 || i.subjectHasScheduleBlocksForDay === true)
  )
}

/** The button's tooltip, and the toast when a press is refused. Empty where the button does not render. */
export function ncnsButtonTitle(i: NcnsGateInput): string {
  if (!i.allowNcnsFromMyTime || i.editingSelf) return ''
  if (!i.allowPunchTimeActions) return ''
  if (i.sessionsLoading || i.pendingAuthForFetch) return 'Loading…'
  if (i.sessionCount === 0) {
    if (i.subjectHasScheduleBlocksForDay === null) return 'Loading…'
    if (i.subjectHasScheduleBlocksForDay)
      return 'Record no-call-no-show (scheduled, no clock time)'
    return 'No sessions or schedule for this day'
  }
  if (i.hasOpenSession) return 'Click to clock out open sessions at current time, then record NCNS'
  return 'Record no-call-no-show for this day'
}

/** A day with approved time opens on the warning; any other day on the plain confirm. */
export function ncnsEntryPhase(
  rows: ReadonlyArray<Pick<DayEditorSession, 'approved_at'>>
): Extract<NcnsUiPhase, 'simple' | 'approved_warn'> {
  return rows.some((s) => s.approved_at) ? 'approved_warn' : 'simple'
}

/** Args for `record_ncns_and_reject_sessions_for_day`: details trimmed, and left out when blank. */
export function ncnsRecordRpcArgs(
  subjectUserId: string,
  workDate: string,
  details: string
): { p_subject_user_id: string; p_work_date: string; p_details?: string } {
  const trimmedDetails = details.trim()
  return {
    p_subject_user_id: subjectUserId,
    p_work_date: workDate,
    ...(trimmedDetails ? { p_details: trimmedDetails } : {}),
  }
}
