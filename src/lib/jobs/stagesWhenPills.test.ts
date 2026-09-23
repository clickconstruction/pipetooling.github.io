import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StagesUpcomingAppointment } from '../stagesUpcomingSchedule'
import {
  classifyStagesWhen,
  countStagesWhenPills,
  filterJobsByStagesWhenPill,
  makeStagesNextFirstComparator,
  stagesNextFirstKey,
  stagesWhenForJobs,
  stripWeekEndYmd,
} from './stagesWhenPills'

// Tue Sep 22 2026; this week ends Sun Sep 27.
const TODAY = '2026-09-22'

function job(over: Partial<JobWithDetails> & { id: string }): JobWithDetails {
  return { status: 'working', pct_complete: null, last_work_date: null, last_schedule_work_date: null, ...over } as JobWithDetails
}
function up(ymd: string, timeStart = '08:00:00'): StagesUpcomingAppointment {
  return { ymd, timeStart, timeEnd: '10:00:00', assigneeNames: ['Abraham'], note: null, bookedYmds: [ymd], lastYmd: ymd, visitCount: 1 }
}

describe('stripWeekEndYmd + classifyStagesWhen', () => {
  it('this week reaches Sunday; Monday next week is later', () => {
    expect(stripWeekEndYmd(TODAY)).toBe('2026-09-27')
    const byJob = stagesWhenForJobs(
      [job({ id: 'sun' }), job({ id: 'mon' }), job({ id: 'none', last_work_date: '2026-09-17' }), job({ id: 'done', pct_complete: 100 })],
      { sun: up('2026-09-27'), mon: up('2026-09-28') },
      TODAY,
    )
    expect(byJob.get('sun')?.kind).toBe('thisWeek')
    expect(byJob.get('mon')?.kind).toBe('later')
    expect(byJob.get('none')?.kind).toBe('unscheduled')
    expect(byJob.get('done')?.kind).toBe('done')
    expect(classifyStagesWhen({ kind: 'done', lastYmd: null }, TODAY)).toBe('done')
  })
})

describe('counts and the pill filter', () => {
  const jobs = [
    job({ id: 'a' }),
    job({ id: 'b' }),
    job({ id: 'c', last_work_date: '2026-09-17' }),
    job({ id: 'd', pct_complete: 100 }),
    job({ id: 'e' }),
  ]
  const byJob = stagesWhenForJobs(jobs, { a: up('2026-09-23'), b: up('2026-09-30'), e: up('2026-09-25') }, TODAY)

  it('All counts everyone; Not scheduled never counts a finished job', () => {
    expect(countStagesWhenPills(jobs, byJob)).toEqual({ all: 5, unscheduled: 1, thisWeek: 2, later: 1, done: 1 })
  })

  it('filters keep the input order and All returns a copy', () => {
    expect(filterJobsByStagesWhenPill(jobs, 'thisWeek', byJob).map((j) => j.id)).toEqual(['a', 'e'])
    expect(filterJobsByStagesWhenPill(jobs, 'unscheduled', byJob).map((j) => j.id)).toEqual(['c'])
    expect(filterJobsByStagesWhenPill(jobs, 'later', byJob).map((j) => j.id)).toEqual(['b'])
    const all = filterJobsByStagesWhenPill(jobs, 'all', byJob)
    expect(all.map((j) => j.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(all).not.toBe(jobs)
  })
})

describe('next-first order', () => {
  it('keys: booked by day then start; unbooked by oldest last-worked, never-worked first; finished last', () => {
    expect(stagesNextFirstKey(job({ id: 'x' }), up('2026-09-23', '13:00:00'))).toBe('0 2026-09-23 13:00:00')
    expect(stagesNextFirstKey(job({ id: 'x', last_work_date: '2026-09-17' }), null)).toBe('1 2026-09-17')
    expect(stagesNextFirstKey(job({ id: 'x' }), null)).toBe('1 0000-00-00')
    expect(stagesNextFirstKey(job({ id: 'x', pct_complete: 100, last_work_date: '2026-09-21' }), null)).toBe('2 2026-09-21')
    expect(stagesNextFirstKey(job({ id: 'x', status: 'billed', last_work_date: '2026-09-01' }), null)).toBe('2 2026-09-01')
  })

  it('sorts a section: today first, then later this week, unbooked oldest first, finished last; ties by the classic order', () => {
    const jobs = [
      job({ id: 'fin', pct_complete: 100, last_work_date: '2026-09-21' }),
      job({ id: 'never' }),
      job({ id: 'thu' }),
      job({ id: 'old', last_work_date: '2026-09-10' }),
      job({ id: 'tue-pm' }),
      job({ id: 'tue-am' }),
      job({ id: 'recent', last_work_date: '2026-09-21' }),
    ]
    const cmp = makeStagesNextFirstComparator(
      { thu: up('2026-09-24'), 'tue-pm': up(TODAY, '13:00:00'), 'tue-am': up(TODAY, '07:00:00') },
      (a, b) => a.id.localeCompare(b.id),
    )
    expect([...jobs].sort(cmp).map((j) => j.id)).toEqual(['tue-am', 'tue-pm', 'thu', 'never', 'old', 'recent', 'fin'])
  })
})
