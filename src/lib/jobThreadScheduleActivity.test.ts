import { describe, expect, it } from 'vitest'
import type { JobScheduleBlockWithAssigneeName } from './jobScheduleBlocks'
import {
  blocksWithNotesFromFetch,
  scheduleBlocksToScheduleActivityItems,
} from './jobThreadScheduleActivity'
import { sortJobThreadActivity } from './jobThreadActivitySort'
import type { JobThreadActivityItem } from '../components/JobThreadNotesPanel'

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
    created_at: '2026-01-01T12:00:00Z',
    created_by: null,
    updated_at: '2026-01-01T12:00:00Z',
    users: { name: 'Alex' },
    ...over,
  }) as JobScheduleBlockWithAssigneeName

describe('blocksWithNotesFromFetch', () => {
  it('keeps rows with non-empty trimmed note', () => {
    const rows = [
      block({ id: 'a', note: 'Hello' }),
      block({ id: 'b', note: '   ' }),
      block({ id: 'c', note: null }),
    ]
    const filtered = blocksWithNotesFromFetch(rows)
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.id).toBe('a')
  })
})

describe('scheduleBlocksToScheduleActivityItems', () => {
  it('dedupes linked legs into one row', () => {
    const gid = '550e8400-e29b-41d4-a716-446655440000'
    const items = scheduleBlocksToScheduleActivityItems([
      block({
        id: 'b1',
        shared_block_group_id: gid,
        note: 'Meet GC',
        assignee_user_id: 'u1',
        users: { name: 'Alice' },
        work_date: '2026-02-01',
        time_start: '08:00',
        time_end: '12:00',
        updated_at: '2026-01-05T10:00:00Z',
      }),
      block({
        id: 'b2',
        shared_block_group_id: gid,
        note: 'Meet GC',
        assignee_user_id: 'u2',
        users: { name: 'Bob' },
        work_date: '2026-02-01',
        time_start: '08:00',
        time_end: '12:00',
        updated_at: '2026-01-06T15:00:00Z',
      }),
    ])
    expect(items).toHaveLength(1)
    const first = items[0]!
    expect(first.schedule.assigneeLabels).toBe('Alice, Bob')
    expect(first.schedule.sortAt).toBe('2026-01-06T15:00:00Z')
    expect(first.schedule.note).toBe('Meet GC')
    expect(first.schedule.dedupeKey).toBe(`sb-group:${gid}`)
  })

  it('solo block gets sb-solo key', () => {
    const items = scheduleBlocksToScheduleActivityItems([
      block({
        id: 'solo99',
        note: 'On site',
        updated_at: '2026-03-02T18:00:00Z',
      }),
    ])
    expect(items).toHaveLength(1)
    const first = items[0]!
    expect(first.schedule.dedupeKey).toBe('sb-solo:solo99')
    expect(first.schedule.sortAt).toBe('2026-03-02T18:00:00Z')
  })

  it('sort order vs thread note uses updated_at', () => {
    const scheduleItems = scheduleBlocksToScheduleActivityItems([
      block({
        id: 'solo',
        note: 'Dispatch note',
        updated_at: '2026-03-02T18:00:00Z',
      }),
    ])
    const merged: JobThreadActivityItem[] = sortJobThreadActivity([
      ...scheduleItems,
      { kind: 'note', note: { id: 'n1', body: 'Hi', created_at: '2026-03-02T12:00:00Z', author: null } },
    ])
    expect(merged[0]!.kind).toBe('note')
    expect(merged[1]!.kind).toBe('schedule_block')
  })
})
