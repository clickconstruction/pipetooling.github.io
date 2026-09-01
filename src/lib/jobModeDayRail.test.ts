import { describe, expect, it } from 'vitest'
import { buildJobModeDayRail } from './jobModeDayRail'
import type { JobModeScheduleBlock } from './jobModePickCurrentNext'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'

function block(
  overrides: Partial<JobModeScheduleBlock> & {
    id: string
    job_id: string
    time_start: string
    time_end: string
  },
): JobModeScheduleBlock {
  return {
    hcp_number: '100',
    click_number: null,
    job_name: 'Test Job',
    job_address: '123 Main',
    service_type_id: null,
    ...overrides,
  }
}

const THREE_JOBS = [
  block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '10:00' }),
  block({ id: 'b2', job_id: JOB_B, time_start: '10:30', time_end: '13:00' }),
  block({ id: 'b3', job_id: JOB_C, time_start: '14:00', time_end: '17:00' }),
]

describe('buildJobModeDayRail', () => {
  it('fresh morning: everything upcoming, nothing done', () => {
    const rail = buildJobModeDayRail({
      blocks: THREE_JOBS,
      currentJobId: null,
      visitedJobIds: new Set(),
    })
    expect(rail.rows.map((r) => r.status)).toEqual(['upcoming', 'upcoming', 'upcoming'])
    expect(rail.doneCount).toBe(0)
    expect(rail.totalCount).toBe(3)
  })

  it('in-order day: done / current / upcoming', () => {
    const rail = buildJobModeDayRail({
      blocks: THREE_JOBS,
      currentJobId: JOB_B,
      visitedJobIds: new Set([JOB_A]),
    })
    expect(rail.rows.map((r) => r.status)).toEqual(['done', 'current', 'upcoming'])
    expect(rail.doneCount).toBe(1)
  })

  it('skipped job behind the current one reads still-open', () => {
    const rail = buildJobModeDayRail({
      blocks: THREE_JOBS,
      currentJobId: JOB_C,
      visitedJobIds: new Set([JOB_A]),
    })
    expect(rail.rows.map((r) => r.status)).toEqual(['done', 'still-open', 'current'])
  })

  it('multi-window job collapses to one row keyed by its first window', () => {
    const rail = buildJobModeDayRail({
      blocks: [
        block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '11:00' }),
        block({ id: 'b2', job_id: JOB_A, time_start: '13:00', time_end: '15:00' }),
        block({ id: 'b3', job_id: JOB_B, time_start: '15:30', time_end: '17:00' }),
      ],
      currentJobId: JOB_A,
      visitedJobIds: new Set(),
    })
    expect(rail.rows.map((r) => r.block.id)).toEqual(['b1', 'b3'])
    expect(rail.totalCount).toBe(2)
  })

  it('not clocked in mid-day: skipped job behind the last visited one reads still-open', () => {
    const rail = buildJobModeDayRail({
      blocks: THREE_JOBS,
      currentJobId: null,
      visitedJobIds: new Set([JOB_B]),
    })
    expect(rail.rows.map((r) => r.status)).toEqual(['still-open', 'done', 'upcoming'])
    expect(rail.doneCount).toBe(1)
  })

  it('current job off today’s schedule: rail keeps scheduled statuses without a current row', () => {
    const rail = buildJobModeDayRail({
      blocks: THREE_JOBS,
      currentJobId: 'not-on-schedule',
      visitedJobIds: new Set([JOB_A]),
    })
    expect(rail.rows.map((r) => r.status)).toEqual(['done', 'upcoming', 'upcoming'])
  })

  it('returning to a finished job shows it current, not done', () => {
    const rail = buildJobModeDayRail({
      blocks: THREE_JOBS,
      currentJobId: JOB_A,
      visitedJobIds: new Set([JOB_A, JOB_B]),
    })
    expect(rail.rows.map((r) => r.status)).toEqual(['current', 'done', 'upcoming'])
    expect(rail.doneCount).toBe(1)
  })
})
