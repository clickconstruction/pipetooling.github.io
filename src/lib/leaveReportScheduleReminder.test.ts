import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../utils/dateUtils'
import { salaryZonedWallClockToUtcMs } from './salaryZonedWallClock'
import {
  LEAVE_REPORT_REMINDER_MY_REPORT_SILENCE_MS,
  shouldShowLeaveReportScheduleReminder,
} from './leaveReportScheduleReminder'

const FIXED_YMD = '2026-07-15'

function endUtcMsChicago(h: number, m: number, s: number): number {
  const n = salaryZonedWallClockToUtcMs(FIXED_YMD, h, m, s, APP_CALENDAR_TZ)
  if (n == null) throw new Error('expected wall time')
  return n
}

describe('shouldShowLeaveReportScheduleReminder', () => {
  it('returns false when there are no blocks for the job/today', () => {
    const blockEndMs = endUtcMsChicago(17, 0, 0)
    const now = new Date(blockEndMs + 60 * 60 * 1000)
    expect(
      shouldShowLeaveReportScheduleReminder({
        now,
        todayYmd: FIXED_YMD,
        jobId: 'job-a',
        blocks: [{ job_id: 'other-job', work_date: FIXED_YMD, time_end: '12:00:00' }],
        myLastReportAtIso: null,
      }),
    ).toBe(false)
  })

  it('returns false when the block has not ended yet', () => {
    const blockEndMs = endUtcMsChicago(17, 0, 0)
    expect(
      shouldShowLeaveReportScheduleReminder({
        now: new Date(blockEndMs - 60 * 60 * 1000),
        todayYmd: FIXED_YMD,
        jobId: 'job-a',
        blocks: [{ job_id: 'job-a', work_date: FIXED_YMD, time_end: '17:00:00' }],
        myLastReportAtIso: null,
      }),
    ).toBe(false)
  })

  it('returns true after block end when the user has never reported on this job', () => {
    const blockEndMs = endUtcMsChicago(17, 0, 0)
    expect(
      shouldShowLeaveReportScheduleReminder({
        now: new Date(blockEndMs + 60 * 1000),
        todayYmd: FIXED_YMD,
        jobId: 'job-a',
        blocks: [{ job_id: 'job-a', work_date: FIXED_YMD, time_end: '17:00:00' }],
        myLastReportAtIso: null,
      }),
    ).toBe(true)
  })

  it('returns false within 12h after the user authored a report', () => {
    const blockEndMs = endUtcMsChicago(17, 0, 0)
    const now = new Date(blockEndMs + 60 * 1000)
    const myReport = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    expect(
      shouldShowLeaveReportScheduleReminder({
        now,
        todayYmd: FIXED_YMD,
        jobId: 'job-a',
        blocks: [{ job_id: 'job-a', work_date: FIXED_YMD, time_end: '17:00:00' }],
        myLastReportAtIso: myReport.toISOString(),
      }),
    ).toBe(false)
  })

  it('returns true after block end when user report is older than 12 hours', () => {
    const blockEndMs = endUtcMsChicago(17, 0, 0)
    const now = new Date(blockEndMs + 60 * 1000)
    const olderThan12hMs = LEAVE_REPORT_REMINDER_MY_REPORT_SILENCE_MS + 60_000
    const myReport = new Date(now.getTime() - olderThan12hMs)
    expect(
      shouldShowLeaveReportScheduleReminder({
        now,
        todayYmd: FIXED_YMD,
        jobId: 'job-a',
        blocks: [{ job_id: 'job-a', work_date: FIXED_YMD, time_end: '17:00:00' }],
        myLastReportAtIso: myReport.toISOString(),
      }),
    ).toBe(true)
  })

  it('returns false soon after block end until 12h passes even if coworker timeline would have cleared old logic', () => {
    const blockEndMs = endUtcMsChicago(17, 0, 0)
    const nowMs = blockEndMs + 60 * 60 * 1000
    const elevenHoursAgo = new Date(nowMs - 11 * 60 * 60 * 1000)
    expect(
      shouldShowLeaveReportScheduleReminder({
        now: new Date(nowMs),
        todayYmd: FIXED_YMD,
        jobId: 'job-a',
        blocks: [{ job_id: 'job-a', work_date: FIXED_YMD, time_end: '17:00:00' }],
        myLastReportAtIso: elevenHoursAgo.toISOString(),
      }),
    ).toBe(false)
  })
})
