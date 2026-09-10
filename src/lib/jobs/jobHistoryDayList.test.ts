import { describe, expect, it } from 'vitest'
import { buildJobHistoryDayList, daysBetweenYmd, jobHistoryDayListSummary, jobHistoryGapLabel } from './jobHistoryDayList'
import type { ProjectsJobHistoryClockRow } from '../projectsJobHistoryData'

const row = (work_date: string, user_id: string, extra?: Partial<ProjectsJobHistoryClockRow>): ProjectsJobHistoryClockRow => ({
  job_ledger_id: 'job-927',
  user_id,
  work_date,
  clocked_out_at: '2026-09-01T20:00:00Z',
  ...extra,
})

const OPTS = { jobId: 'job-927', todayYmd: '2026-09-10', startYmd: '2026-03-14', endYmd: '2026-09-10' }

describe('buildJobHistoryDayList', () => {
  it('one row per day worked, newest first, distinct people, gaps counted, today open when a session is still running', () => {
    const list = buildJobHistoryDayList(
      [
        row('2026-03-14', 'abraham'),
        row('2026-08-27', 'malachi'),
        row('2026-08-28', 'malachi'),
        row('2026-09-08', 'malachi'),
        row('2026-09-08', 'grace'),
        row('2026-09-08', 'roxi'),
        row('2026-09-08', 'malachi'), // a second session, same person, same day — still one person
        row('2026-09-09', 'malachi'),
        row('2026-09-09', 'grace'),
        row('2026-09-10', 'malachi', { clocked_out_at: null }),
        row('2026-09-10', 'grace'),
        row('2026-09-05', 'someone', { job_ledger_id: 'other-job' }), // another job — ignored
        row('2026-02-01', 'abraham'), // before the range — ignored
      ],
      OPTS,
    )
    expect(list.rows.map((r) => r.ymd)).toEqual(['2026-09-10', '2026-09-09', '2026-09-08', '2026-08-28', '2026-08-27', '2026-03-14'])
    expect(list.rows.map((r) => r.people)).toEqual([2, 2, 3, 1, 1, 1])
    expect(list.rows[2]!.userIds).toEqual(['malachi', 'grace', 'roxi'])
    expect(list.rows.map((r) => r.gapBefore)).toEqual([0, 0, 10, 0, 165, 0])
    expect(list.rows[0]!.open).toBe(true)
    expect(list.rows[1]!.open).toBe(false)
    expect(list.rows[0]!.quietAfter).toBe(0)
    expect(list.daysWorked).toBe(6)
    expect(list.maxPeople).toBe(3)
    expect(list.userIds).toEqual(['malachi', 'grace', 'roxi', 'abraham'])
    expect(jobHistoryDayListSummary(list)).toBe('6 days worked · 3 people at most')
  })

  it('a job that went quiet carries the quiet run on its newest row; a one-day job reads as one person', () => {
    const list = buildJobHistoryDayList([row('2026-03-14', 'abraham')], OPTS)
    expect(list.rows).toHaveLength(1)
    expect(list.rows[0]!.quietAfter).toBe(180)
    expect(jobHistoryDayListSummary(list)).toBe('1 day worked · 1 person')
  })

  it('an open session on a day that is not today does not read as open (it is just unclosed history)', () => {
    const list = buildJobHistoryDayList([row('2026-09-01', 'malachi', { clocked_out_at: null })], OPTS)
    expect(list.rows[0]!.open).toBe(false)
  })

  it('empty range reads plainly', () => {
    const list = buildJobHistoryDayList([], OPTS)
    expect(list.rows).toEqual([])
    expect(jobHistoryDayListSummary(list)).toBe('No days worked in this range')
  })
})

describe('helpers', () => {
  it('daysBetweenYmd counts whole days forward only', () => {
    expect(daysBetweenYmd('2026-09-08', '2026-09-10')).toBe(2)
    expect(daysBetweenYmd('2026-09-10', '2026-09-08')).toBe(0)
    expect(daysBetweenYmd('2026-02-27', '2026-03-02')).toBe(3) // 2026 is not a leap year
  })
  it('gap label', () => {
    expect(jobHistoryGapLabel(0)).toBeNull()
    expect(jobHistoryGapLabel(1)).toBe('1 day without work')
    expect(jobHistoryGapLabel(11)).toBe('11 days without work')
  })
})
