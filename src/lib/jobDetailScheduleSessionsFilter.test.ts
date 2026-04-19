import { describe, expect, it } from 'vitest'
import type { JobDetailClockSessionRow } from './fetchClockSessionsForJobLedger'
import type { JobScheduleBlockWithAssigneeName } from './jobScheduleBlocks'
import { filterJobDetailClockSessions, filterJobDetailScheduleBlocks } from './jobDetailScheduleSessionsFilter'

const block = (over: Partial<JobScheduleBlockWithAssigneeName>): JobScheduleBlockWithAssigneeName =>
  ({
    id: 'b1',
    job_id: 'j1',
    assignee_user_id: 'u1',
    work_date: '2026-04-01',
    time_start: '09:00',
    time_end: '17:00',
    note: null,
    shared_block_group_id: null,
    created_at: '',
    created_by: null,
    updated_at: null,
    users: { name: 'Alex' },
    ...over,
  }) as JobScheduleBlockWithAssigneeName

const session = (over: Partial<JobDetailClockSessionRow>): JobDetailClockSessionRow =>
  ({
    id: 's1',
    user_id: 'u9',
    clocked_in_at: '2026-04-02T14:00:00.000Z',
    clocked_out_at: '2026-04-02T18:00:00.000Z',
    work_date: '2026-04-02',
    notes: null,
    approved_at: null,
    rejected_at: null,
    users: { name: 'Pat' },
    ...over,
  }) as JobDetailClockSessionRow

describe('filterJobDetailScheduleBlocks', () => {
  const blocks = [block({ note: 'Roof rough-in' }), block({ id: 'b2', note: 'Other' })]

  it('returns all blocks when query is empty', () => {
    expect(filterJobDetailScheduleBlocks(blocks, '')).toEqual(blocks)
    expect(filterJobDetailScheduleBlocks(blocks, '   ')).toEqual(blocks)
  })

  it('filters by note substring case-insensitively', () => {
    const out = filterJobDetailScheduleBlocks(blocks, 'rough')
    expect(out).toHaveLength(1)
    expect(out[0]!.note).toBe('Roof rough-in')
  })

  it('filters by assignee name', () => {
    const out = filterJobDetailScheduleBlocks(blocks, 'alex')
    expect(out).toHaveLength(2)
  })
})

describe('filterJobDetailClockSessions', () => {
  const sessions = [
    session({ notes: 'Breakdown cart' }),
    session({ id: 's2', notes: 'Nothing special', user_id: 'u2', users: { name: 'Sam' } }),
  ]

  it('returns all sessions when query is empty', () => {
    expect(filterJobDetailClockSessions(sessions, '')).toEqual(sessions)
  })

  it('filters by notes', () => {
    const out = filterJobDetailClockSessions(sessions, 'cart')
    expect(out).toHaveLength(1)
    expect(out[0]!.notes).toBe('Breakdown cart')
  })

  it('returns empty when no match', () => {
    expect(filterJobDetailClockSessions(sessions, 'zzz')).toEqual([])
  })
})
