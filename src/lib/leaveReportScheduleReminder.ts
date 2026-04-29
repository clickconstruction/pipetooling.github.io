import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { salaryPgTimeToHms, salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'

/** Elapsed time after which another schedule-block-ended nag may show once the user's own job report clears it. */
export const LEAVE_REPORT_REMINDER_MY_REPORT_SILENCE_MS = 12 * 60 * 60 * 1000

export type LeaveReportReminderBlockSlice = Readonly<
  Pick<
    {
      job_id: string
      work_date: string
      time_end: string
    },
    'job_id' | 'work_date' | 'time_end'
  >
>

/**
 * Shows when at least one schedule block on **today** (`company TZ` date key) for the job has ended,
 * unless the viewer has a **reports** row for this job (auth.uid = `created_by_user_id`)
 * whose `created_at` is within the last {@link LEAVE_REPORT_REMINDER_MY_REPORT_SILENCE_MS}.
 */
export function shouldShowLeaveReportScheduleReminder(props: {
  now: Date
  todayYmd: string
  jobId: string
  blocks: ReadonlyArray<LeaveReportReminderBlockSlice>
  myLastReportAtIso: string | null
}): boolean {
  const { now, todayYmd, jobId, blocks, myLastReportAtIso } = props
  const jobBlocks = blocks.filter((b) => b.job_id === jobId && b.work_date === todayYmd)
  const nowMs = now.getTime()

  const my = myLastReportAtIso?.trim()
  if (my) {
    const tMs = new Date(my).getTime()
    if (Number.isFinite(tMs) && nowMs - tMs <= LEAVE_REPORT_REMINDER_MY_REPORT_SILENCE_MS) return false
  }

  for (const b of jobBlocks) {
    const { h, m: min, s } = salaryPgTimeToHms(b.time_end)
    const endMs = salaryZonedWallClockToUtcMs(b.work_date, h, min, s, APP_CALENDAR_TZ)
    if (endMs == null) continue
    if (endMs >= nowMs) continue
    return true
  }

  return false
}
