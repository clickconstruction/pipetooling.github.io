import { normalizeDayEditorSession, type DayEditorSession } from './myTimeDayTimeline'
import { salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'

export const DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX = 'draft:people-hours:'

export function isDraftPeopleHoursSessionId(id: string): boolean {
  return id.startsWith(DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX)
}

const DEFAULT_DRAFT_NOTES = 'People Hours — manual entry draft'

/**
 * Closed draft session: 8:00 AM wall (APP_CALENDAR_TZ) on workDate through enteredHours.
 */
export function buildPeopleHoursManualDraftSession(
  workDateYmd: string,
  enteredHoursDecimal: number,
): DayEditorSession {
  const inMs = salaryZonedWallClockToUtcMs(workDateYmd, 8, 0, 0, APP_CALENDAR_TZ)
  if (inMs == null) {
    throw new Error('Invalid work date for draft session')
  }
  const durMs = Math.max(0, enteredHoursDecimal) * 3600 * 1000
  const outMs = inMs + durMs
  return normalizeDayEditorSession({
    id: `${DRAFT_PEOPLE_HOURS_SESSION_ID_PREFIX}${crypto.randomUUID()}`,
    clocked_in_at: new Date(inMs).toISOString(),
    clocked_out_at: new Date(outMs).toISOString(),
    work_date: workDateYmd,
    notes: DEFAULT_DRAFT_NOTES,
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
  })
}
