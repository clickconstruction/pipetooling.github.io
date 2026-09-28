import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import type { DispatchNoteRequirement } from '../dispatchNoteRequirements'
import type { DispatchSwimLanesData } from '../dispatchSwimLanes'
import type { JobScheduleBlockRow } from '../jobScheduleBlocks'
import { buildPersonDayBlockMap } from '../scheduleDispatchHub'
import {
  countBlocksMissingNoteForDay,
  filterHubJobsPanelBidRows,
  filterHubJobsPanelRows,
  filterHubPeopleBySearch,
  filterHubPeopleWithBlocks,
} from './hubPanels'

const ids = (rows: Array<{ id?: string; userId?: string }>) => rows.map((r) => r.id ?? r.userId)

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id: 'blk',
    job_id: 'job-1',
    bid_id: null,
    assignee_user_id: 'abraham',
    work_date: '2026-09-28',
    time_start: '08:00:00',
    time_end: '12:00:00',
    note: null,
    shared_block_group_id: null,
    created_by: null,
    created_at: '2026-09-25T15:00:00Z',
    updated_at: '2026-09-25T15:00:00Z',
    field_moved_at: null,
    field_moved_from: null,
    ...over,
  }
}

describe('filterHubJobsPanelRows', () => {
  const rows = [
    { id: '1', hcp_number: '927', job_name: 'Berg AirBnb', displayTitle: 'J927 · Berg AirBnb', totalBlocks: 3 },
    { id: '2', hcp_number: '412', job_name: 'Rough-in', displayTitle: 'J412 · Rough-in', totalBlocks: 0 },
    { id: '3', hcp_number: null, job_name: null, displayTitle: 'J4102 · Job', totalBlocks: 1 },
  ]

  it('hands the list back as it was when there is nothing to filter by', () => {
    expect(filterHubJobsPanelRows(rows, '', false)).toBe(rows)
    expect(filterHubJobsPanelRows(rows, '   ', false)).toBe(rows)
  })

  it('finds a job by its number, its name or its identity line, whatever the case', () => {
    expect(ids(filterHubJobsPanelRows(rows, '927', false))).toEqual(['1'])
    expect(ids(filterHubJobsPanelRows(rows, ' ROUGH ', false))).toEqual(['2'])
    expect(ids(filterHubJobsPanelRows(rows, '4102', false))).toEqual(['3'])
    expect(ids(filterHubJobsPanelRows(rows, 'j4', false))).toEqual(['2', '3'])
  })

  it('drops the jobs with nothing this week when asked to', () => {
    expect(ids(filterHubJobsPanelRows(rows, '', true))).toEqual(['1', '3'])
  })

  it('applies the search and the blocks filter together', () => {
    expect(ids(filterHubJobsPanelRows(rows, 'j4', true))).toEqual(['3'])
    expect(filterHubJobsPanelRows(rows, 'rough', true)).toEqual([])
  })
})

describe('filterHubJobsPanelBidRows', () => {
  const bidRows = [
    { id: 'bid:1', displayTitle: 'Bid visit · B375 · Tower West' },
    { id: 'bid:2', displayTitle: 'Bid visit' },
  ]

  it('hands the list back as it was with no search', () => {
    expect(filterHubJobsPanelBidRows(bidRows, '  ')).toBe(bidRows)
  })

  it('reads the identity line only', () => {
    expect(ids(filterHubJobsPanelBidRows(bidRows, 'tower'))).toEqual(['bid:1'])
    expect(ids(filterHubJobsPanelBidRows(bidRows, 'BID VISIT'))).toEqual(['bid:1', 'bid:2'])
    expect(filterHubJobsPanelBidRows(bidRows, 'zzz')).toEqual([])
  })
})

describe('filterHubPeopleWithBlocks', () => {
  const people = [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }]

  it('hands everyone back as they were when the filter is off', () => {
    expect(filterHubPeopleWithBlocks(people, false, new Set(['a']))).toBe(people)
  })

  it('keeps only the people with a block this week, in order', () => {
    expect(ids(filterHubPeopleWithBlocks(people, true, new Set(['c', 'a'])))).toEqual(['a', 'c'])
    expect(filterHubPeopleWithBlocks(people, true, new Set())).toEqual([])
  })
})

describe('filterHubPeopleBySearch', () => {
  const people = [
    { userId: 'abraham', displayName: 'Abraham' },
    { userId: 'paige', displayName: 'Paige' },
    { userId: 'cruz', displayName: 'Cruz' },
  ]
  const titles: Record<string, string> = {
    'job-1': 'J927 · Berg AirBnb',
    'job-2': 'J412 · Rough-in',
    'bid:bid-9': 'Bid visit · B375 · Tower West',
  }
  const swimLanes: DispatchSwimLanesData = {
    lanes: [{ id: 'lane-1', name: 'Underground crew' }] as DispatchSwimLanesData['lanes'],
    memberIdsByLaneId: new Map([['lane-1', ['cruz']]]),
    laneIdByUserId: new Map([['cruz', 'lane-1']]),
  }
  const ctx = {
    visibleDayKeys: ['2026-09-28', '2026-09-29'],
    personDayBlocks: buildPersonDayBlockMap([
      block({ id: '1', assignee_user_id: 'paige', job_id: 'job-1', work_date: '2026-09-29' }),
      block({ id: '2', assignee_user_id: 'abraham', job_id: null, bid_id: 'bid-9' }),
      block({ id: '3', assignee_user_id: 'cruz', job_id: 'job-2', work_date: '2026-10-03' }),
    ]),
    getJobDisplayTitle: (anchorId: string) => titles[anchorId] ?? '— · Job',
    swimLanes,
  }

  it('hands the list back as it was with no search', () => {
    expect(filterHubPeopleBySearch(people, '  ', ctx)).toBe(people)
  })

  it('finds a person by name, whatever the case', () => {
    expect(ids(filterHubPeopleBySearch(people, ' PAI ', ctx))).toEqual(['paige'])
  })

  it('finds a person by the job they are on in a visible day', () => {
    expect(ids(filterHubPeopleBySearch(people, 'berg', ctx))).toEqual(['paige'])
  })

  it('finds a person by a bid visit, through the bid: anchor', () => {
    expect(ids(filterHubPeopleBySearch(people, 'tower west', ctx))).toEqual(['abraham'])
  })

  it('does not look at a day that is not showing', () => {
    expect(filterHubPeopleBySearch(people, 'rough-in', ctx)).toEqual([])
    expect(
      ids(filterHubPeopleBySearch(people, 'rough-in', { ...ctx, visibleDayKeys: [...ctx.visibleDayKeys, '2026-10-03'] })),
    ).toEqual(['cruz'])
  })

  it('finds a person by the name of their crew', () => {
    expect(ids(filterHubPeopleBySearch(people, 'underground', ctx))).toEqual(['cruz'])
  })

  it('skips the crew names when there are no crews', () => {
    expect(filterHubPeopleBySearch(people, 'underground', { ...ctx, swimLanes: null })).toEqual([])
    expect(filterHubPeopleBySearch(people, 'underground', { ...ctx, swimLanes: undefined })).toEqual([])
  })

  it('keeps the list order when several people match', () => {
    expect(ids(filterHubPeopleBySearch(people, 'a', ctx))).toEqual(['abraham', 'paige'])
  })
})

describe('countBlocksMissingNoteForDay', () => {
  const TODAY = '2026-09-28'
  const people = [{ userId: 'abraham' }, { userId: 'paige' }]
  const blocks = buildPersonDayBlockMap([
    block({ id: '1', assignee_user_id: 'abraham', note: null }),
    block({ id: '2', assignee_user_id: 'abraham', note: 'Set the water heater', time_start: '13:00:00' }),
    block({ id: '3', assignee_user_id: 'paige', note: '', job_id: 'job-2' }),
    block({ id: '4', assignee_user_id: 'cruz', note: null }),
    block({ id: '5', assignee_user_id: 'abraham', note: null, work_date: '2026-09-29' }),
  ])
  const always =
    (r: DispatchNoteRequirement) =>
    (): DispatchNoteRequirement =>
      r

  it('counts the cards with no note, among the people listed, on that day', () => {
    expect(countBlocksMissingNoteForDay(TODAY, TODAY, people, blocks, always('default'))).toBe(2)
    expect(countBlocksMissingNoteForDay('2026-09-29', TODAY, people, blocks, always('default'))).toBe(1)
  })

  it('counts an empty note as missing', () => {
    expect(countBlocksMissingNoteForDay(TODAY, TODAY, [{ userId: 'paige' }], blocks, always('default'))).toBe(1)
  })

  it('counts nothing on a past day, and nothing when there is no day', () => {
    expect(countBlocksMissingNoteForDay('2026-09-27', TODAY, people, blocks, always('required'))).toBe(0)
    expect(countBlocksMissingNoteForDay('', TODAY, people, blocks, always('required'))).toBe(0)
  })

  it('leaves out a block whose person or job skips the note, and asks with both', () => {
    const asked: Array<{ userId: string | null | undefined; jobId: string | null | undefined }> = []
    const n = countBlocksMissingNoteForDay(TODAY, TODAY, people, blocks, (input) => {
      asked.push(input)
      return input.jobId === 'job-2' ? 'skip' : 'required'
    })
    expect(n).toBe(1)
    expect(asked).toEqual([
      { userId: 'abraham', jobId: 'job-1' },
      { userId: 'paige', jobId: 'job-2' },
    ])
  })

  it('counts a bid visit with no note', () => {
    const bidBlocks = buildPersonDayBlockMap([block({ assignee_user_id: 'abraham', job_id: null, bid_id: 'bid-9' })])
    expect(countBlocksMissingNoteForDay(TODAY, TODAY, people, bidBlocks, always('default'))).toBe(1)
  })

  it('counts nothing for nobody', () => {
    expect(countBlocksMissingNoteForDay(TODAY, TODAY, [], blocks, always('required'))).toBe(0)
  })
})
