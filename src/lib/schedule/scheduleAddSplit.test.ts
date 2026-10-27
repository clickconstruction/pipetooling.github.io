import { describe, expect, it } from 'vitest'
import { scheduleAddSplit, scheduleAddWords, type ScheduleDayBlock } from './scheduleAddSplit'
import { plainWordsFailures } from '../plainWords'

const names: Record<string, string> = { u1: 'Marisol', u2: 'Todd', u3: 'Ana' }
const block = (p: Partial<ScheduleDayBlock> & { assignee_user_id: string }): ScheduleDayBlock => ({ id: `b-${p.assignee_user_id}`, job_id: 'job-other', time_start: '09:00:00', time_end: '11:00:00', ...p })

describe('scheduleAddSplit — an overlap holds only that person (punch list #184)', () => {
  it('holds the person whose day overlaps, with the window and where it is, and keeps the rest', () => {
    const split = scheduleAddSplit({
      ids: ['u1', 'u2', 'u3'],
      timeStart: '08:00:00',
      timeEnd: '12:00:00',
      dayBlocks: [block({ assignee_user_id: 'u2' }), block({ assignee_user_id: 'u3', time_start: '12:00:00', time_end: '14:00:00' })],
      nameOf: (id) => names[id] ?? id,
      currentJobId: 'job-this',
    })
    expect(split.ready).toEqual(['u1', 'u3'])
    expect(split.held).toEqual([{ userId: 'u2', name: 'Todd', why: 'overlaps 9:00 AM–11:00 AM on another job', otherJobId: 'job-other' }])
  })
  it('a block on this job names this job and offers no other job', () => {
    const split = scheduleAddSplit({
      ids: ['u1'],
      timeStart: '08:00:00',
      timeEnd: '12:00:00',
      dayBlocks: [block({ assignee_user_id: 'u1', job_id: 'job-this' })],
      nameOf: (id) => names[id] ?? id,
      currentJobId: 'job-this',
    })
    expect(split.held).toEqual([{ userId: 'u1', name: 'Marisol', why: 'overlaps 9:00 AM–11:00 AM on this job', otherJobId: null }])
  })
  it('a bid visit is named as one', () => {
    const split = scheduleAddSplit({
      ids: ['u1'],
      timeStart: '10:00:00',
      timeEnd: '10:30:00',
      dayBlocks: [block({ assignee_user_id: 'u1', job_id: null, bid_id: 'bid-1' })],
      nameOf: (id) => names[id] ?? id,
      currentJobId: 'job-this',
    })
    expect(split.held[0]?.why).toBe('overlaps 9:00 AM–11:00 AM on a bid visit')
  })
})

describe('scheduleAddWords — the button says who is added and who is held', () => {
  it('some held', () => {
    const w = scheduleAddWords({ ready: ['u1', 'u3'], held: [{}] })
    expect(w).toEqual({ button: 'Add 2 to schedule · 1 held: overlaps ▸', foot: '1 is held. It stays here with the reason. The 2 ready ones add now.', dead: false })
    expect(plainWordsFailures(w.foot ?? '')).toEqual([])
  })
  it('nobody held, one or many', () => {
    expect(scheduleAddWords({ ready: ['u1'], held: [] })).toEqual({ button: 'Add 1 to schedule', foot: null, dead: false })
    expect(scheduleAddWords({ ready: ['u1', 'u2', 'u3'], held: [] }).button).toBe('Add 3 to schedule')
  })
  it('dead when every pick overlaps, or nobody is picked', () => {
    expect(scheduleAddWords({ ready: [], held: [{}] })).toEqual({ button: 'Add to schedule ▸', foot: 'Nothing is ready to add. Fix what is marked in red, then add.', dead: true })
    expect(scheduleAddWords({ ready: [], held: [] })).toEqual({ button: 'Add to schedule', foot: null, dead: true })
  })
})
