import { describe, expect, it } from 'vitest'
import {
  pickCurrentAndNextScheduleBlock,
  sortJobModeScheduleBlocks,
  type JobModeScheduleBlock,
} from './jobModePickCurrentNext'

const JOB_A = '00000000-0000-0000-0000-00000000aaaa'
const JOB_B = '00000000-0000-0000-0000-00000000bbbb'
const JOB_C = '00000000-0000-0000-0000-00000000cccc'

function block(overrides: Partial<JobModeScheduleBlock> & { id: string; job_id: string; time_start: string; time_end: string }): JobModeScheduleBlock {
  return {
    hcp_number: '100',
    job_name: 'Test Job',
    job_address: '123 Main',
    service_type_id: null,
    ...overrides,
  }
}

describe('sortJobModeScheduleBlocks', () => {
  it('orders by time_start ascending', () => {
    const out = sortJobModeScheduleBlocks([
      block({ id: 'b', job_id: JOB_B, time_start: '13:00', time_end: '17:00' }),
      block({ id: 'a', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
    ])
    expect(out.map((b) => b.id)).toEqual(['a', 'b'])
  })

  it('breaks ties by time_end then id deterministically', () => {
    const out = sortJobModeScheduleBlocks([
      block({ id: 'z', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
      block({ id: 'a', job_id: JOB_B, time_start: '08:00', time_end: '11:00' }),
      block({ id: 'm', job_id: JOB_C, time_start: '08:00', time_end: '12:00' }),
    ])
    expect(out.map((b) => b.id)).toEqual(['a', 'm', 'z'])
  })
})

describe('pickCurrentAndNextScheduleBlock', () => {
  it('not clocked in + no schedule → no-clock-no-schedule', () => {
    const result = pickCurrentAndNextScheduleBlock({ blocks: [], openSession: null })
    expect(result).toEqual({
      state: 'no-clock-no-schedule',
      currentBlock: null,
      nextBlock: null,
    })
  })

  it('not clocked in + has schedule → first block is next', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
      block({ id: 'b2', job_id: JOB_B, time_start: '13:00', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({ blocks, openSession: null })
    expect(result.state).toBe('not-clocked-in-with-schedule')
    expect(result.currentBlock).toBeNull()
    expect(result.nextBlock?.id).toBe('b1')
  })

  it('clocked on a bid → state on-bid; next = first block', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: null, bidId: 'some-bid' },
    })
    expect(result.state).toBe('on-bid')
    expect(result.currentBlock).toBeNull()
    expect(result.nextBlock?.id).toBe('b1')
  })

  it('clocked on a bid + no schedule → on-bid with no next', () => {
    const result = pickCurrentAndNextScheduleBlock({
      blocks: [],
      openSession: { jobLedgerId: null, bidId: 'some-bid' },
    })
    expect(result.state).toBe('on-bid')
    expect(result.nextBlock).toBeNull()
  })

  it('clocked on first scheduled job, with more after → on-scheduled-job-not-last', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
      block({ id: 'b2', job_id: JOB_B, time_start: '13:00', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: JOB_A, bidId: null },
    })
    expect(result.state).toBe('on-scheduled-job-not-last')
    expect(result.currentBlock?.id).toBe('b1')
    expect(result.nextBlock?.id).toBe('b2')
  })

  it('clocked on the last scheduled job → on-scheduled-job-last', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
      block({ id: 'b2', job_id: JOB_B, time_start: '13:00', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: JOB_B, bidId: null },
    })
    expect(result.state).toBe('on-scheduled-job-last')
    expect(result.currentBlock?.id).toBe('b2')
    expect(result.nextBlock).toBeNull()
  })

  it('clocked on a job NOT on schedule → on-off-schedule-job; next = first block', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
      block({ id: 'b2', job_id: JOB_B, time_start: '13:00', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: JOB_C, bidId: null },
    })
    expect(result.state).toBe('on-off-schedule-job')
    expect(result.currentBlock).toBeNull()
    expect(result.nextBlock?.id).toBe('b1')
  })

  it('clocked on a job that has multiple windows → next is the first different-job block', () => {
    // Same job split into morning + afternoon, plus a later different job.
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '11:00' }),
      block({ id: 'b2', job_id: JOB_A, time_start: '13:00', time_end: '15:00' }),
      block({ id: 'b3', job_id: JOB_B, time_start: '15:30', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: JOB_A, bidId: null },
    })
    expect(result.state).toBe('on-scheduled-job-not-last')
    expect(result.currentBlock?.id).toBe('b1')
    expect(result.nextBlock?.id).toBe('b3')
  })

  it('clocked on a job with multiple windows but no later different job → on-scheduled-job-last', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '11:00' }),
      block({ id: 'b2', job_id: JOB_A, time_start: '13:00', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: JOB_A, bidId: null },
    })
    expect(result.state).toBe('on-scheduled-job-last')
    expect(result.currentBlock?.id).toBe('b1')
    expect(result.nextBlock).toBeNull()
  })

  it('clocked in with no association (orphan session) → on-off-schedule-job', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: null, bidId: null },
    })
    expect(result.state).toBe('on-off-schedule-job')
    expect(result.currentBlock).toBeNull()
    expect(result.nextBlock?.id).toBe('b1')
  })

  it('blocks input order does not matter — picker sorts internally', () => {
    const blocks = [
      block({ id: 'b2', job_id: JOB_B, time_start: '13:00', time_end: '17:00' }),
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '12:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: null,
    })
    expect(result.nextBlock?.id).toBe('b1')
  })

  it('three-job day, clocked on middle job → next is third', () => {
    const blocks = [
      block({ id: 'b1', job_id: JOB_A, time_start: '08:00', time_end: '10:00' }),
      block({ id: 'b2', job_id: JOB_B, time_start: '10:30', time_end: '13:00' }),
      block({ id: 'b3', job_id: JOB_C, time_start: '14:00', time_end: '17:00' }),
    ]
    const result = pickCurrentAndNextScheduleBlock({
      blocks,
      openSession: { jobLedgerId: JOB_B, bidId: null },
    })
    expect(result.state).toBe('on-scheduled-job-not-last')
    expect(result.currentBlock?.id).toBe('b2')
    expect(result.nextBlock?.id).toBe('b3')
  })
})
