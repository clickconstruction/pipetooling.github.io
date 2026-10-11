import { describe, expect, it } from 'vitest'
import { blockHours, clockToHours, matchSessionsToSchedule, onScheduleIds, pendingDateRange, scheduleMatchTitle } from './scheduleMatch'

const block = (user: string, day: string, job: string | null, start: string, end: string) => ({ assignee_user_id: user, work_date: day, job_id: job, time_start: start, time_end: end })
const session = (id: string, user: string, day: string, job: string | null, hours: number, flagged = false) => ({ id, user_id: user, work_date: day, job_ledger_id: job, hours, flagged })

describe('clockToHours / blockHours', () => {
  it('reads HH:MM and HH:MM:SS', () => {
    expect(clockToHours('08:00:00')).toBe(8)
    expect(clockToHours('16:30')).toBe(16.5)
    expect(blockHours(block('u', 'd', 'j', '07:00:00', '15:30:00'))).toBe(8.5)
    expect(blockHours(block('u', 'd', 'j', '15:00', '07:00'))).toBe(0)
  })
})

describe('matchSessionsToSchedule', () => {
  const blocks = [
    block('tristen', '2026-10-06', 'j912', '07:00', '15:00'), // 8h
    block('tristen', '2026-10-07', 'j912', '07:00', '11:00'), // 4h …
    block('tristen', '2026-10-07', 'j912', '12:00', '16:00'), // … + 4h = 8h
    block('paige', '2026-10-06', null, '07:00', '15:00'), // a bid block: no job
  ]
  it('matches a day whose clocked hours on the scheduled job land within an hour', () => {
    const sessions = [
      session('a', 'tristen', '2026-10-06', 'j912', 7.5),
      session('b', 'tristen', '2026-10-07', 'j912', 4.2),
      session('c', 'tristen', '2026-10-07', 'j912', 3.9),
    ]
    const m = matchSessionsToSchedule(sessions, blocks)
    expect(m.get('a')).toEqual({ scheduledHours: 8, workedHours: 7.5, within: true })
    expect(m.get('b')).toMatchObject({ scheduledHours: 8, workedHours: 8.1, within: true })
    expect(onScheduleIds(sessions, m)).toEqual(['a', 'b', 'c'])
  })
  it('does not match a day more than an hour off, a job not on the schedule, no job, or a flagged session', () => {
    const sessions = [
      session('a', 'tristen', '2026-10-06', 'j912', 10), // 2h over
      session('b', 'tristen', '2026-10-06', 'j999', 8), // not scheduled on j999
      session('c', 'paige', '2026-10-06', null, 8), // no job
      session('d', 'tristen', '2026-10-07', 'j912', 8, true), // flagged (long / tiny)
    ]
    const m = matchSessionsToSchedule(sessions, blocks)
    expect(m.get('a')).toEqual({ scheduledHours: 8, workedHours: 10, within: false })
    expect(m.has('b')).toBe(false)
    expect(m.has('c')).toBe(false)
    expect(m.get('d')).toMatchObject({ within: false })
    expect(onScheduleIds(sessions, m)).toEqual([])
  })
  it('titles say what dispatch had and what was clocked', () => {
    expect(scheduleMatchTitle({ scheduledHours: 8, workedHours: 7.5, within: true })).toBe('Dispatch had this person on this job that day for 8h; 7.5h clocked, within an hour of it.')
    expect(scheduleMatchTitle({ scheduledHours: 8, workedHours: 10, within: false })).toBe('Dispatch had this person on this job that day for 8h, but 10h clocked, more than an hour off, so this one is yours to read.')
  })
  it('pendingDateRange spans the pending days', () => {
    expect(pendingDateRange([{ work_date: '2026-10-07' }, { work_date: '2026-09-20' }, { work_date: '2026-10-01' }])).toEqual({ from: '2026-09-20', to: '2026-10-07' })
    expect(pendingDateRange([])).toBeNull()
  })
})
