import { describe, expect, it } from 'vitest'
import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import {
  aggregateWeekSummariesByJob,
  blocksToJobWeekSummaries,
  buildPersonDayBlockMap,
  buildScheduleDispatchHubRoster,
  findDuplicateJobAddress,
  formatScheduleDispatchHubBidTitle,
  formatScheduleDispatchHubJobTitle,
  hubPersonDayKey,
  isFinishedJobPickerStatus,
  jobPickerStatusChip,
  parseHubPersonDayKey,
  sortJobPickerRowsFinishedLast,
} from './scheduleDispatchHub'

describe('jobPickerStatusChip', () => {
  it('maps the five pipeline states to labeled chips', () => {
    expect(jobPickerStatusChip('waiting')?.label).toBe('Waiting')
    expect(jobPickerStatusChip('working')?.label).toBe('Working')
    expect(jobPickerStatusChip('ready_to_bill')?.label).toBe('Ready to Bill')
    expect(jobPickerStatusChip('billed')?.label).toBe('Billed')
    expect(jobPickerStatusChip('paid')?.label).toBe('Paid')
  })

  it('hides the chip for unknown, null, or empty status', () => {
    expect(jobPickerStatusChip('collections')).toBeNull()
    expect(jobPickerStatusChip(null)).toBeNull()
    expect(jobPickerStatusChip(undefined)).toBeNull()
    expect(jobPickerStatusChip('  ')).toBeNull()
  })
})

describe('sortJobPickerRowsFinishedLast', () => {
  it('keeps active rows in order first and pushes billed/paid to the back, stably', () => {
    const rows = [
      { id: 'a', status: 'paid' },
      { id: 'b', status: 'working' },
      { id: 'c', status: 'billed' },
      { id: 'd', status: 'waiting' },
      { id: 'e', status: 'ready_to_bill' },
    ]
    expect(sortJobPickerRowsFinishedLast(rows).map((r) => r.id)).toEqual(['b', 'd', 'e', 'a', 'c'])
  })

  it('treats missing/unknown status as active (never silently demote)', () => {
    const rows = [
      { id: 'a', status: 'paid' },
      { id: 'b', status: null },
      { id: 'c' as string, status: undefined },
    ]
    expect(sortJobPickerRowsFinishedLast(rows).map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(isFinishedJobPickerStatus(null)).toBe(false)
    expect(isFinishedJobPickerStatus('billed')).toBe(true)
  })
})

describe('findDuplicateJobAddress', () => {
  it('finds the largest group sharing a normalized address', () => {
    const rows = [
      { job_address: '109 Tuscarora Trail Shavano Park, TX 78231' },
      { job_address: '109  tuscarora trail shavano park, tx 78231' },
      { job_address: '717 Trinity St Lockhart, TX' },
    ]
    const dup = findDuplicateJobAddress(rows)
    expect(dup?.count).toBe(2)
    expect(dup?.address).toBe('109 Tuscarora Trail Shavano Park, TX 78231')
  })

  it('returns null when addresses are unique or blank', () => {
    expect(findDuplicateJobAddress([{ job_address: 'A St' }, { job_address: 'B St' }])).toBeNull()
    expect(findDuplicateJobAddress([{ job_address: '' }, { job_address: '  ' }, { job_address: null }])).toBeNull()
  })

  it('prefers the biggest duplicate group', () => {
    const rows = [
      { job_address: 'A St' },
      { job_address: 'A St' },
      { job_address: 'B Ave' },
      { job_address: 'B Ave' },
      { job_address: 'B Ave' },
    ]
    expect(findDuplicateJobAddress(rows)).toEqual({ address: 'B Ave', count: 3 })
  })
})

describe('buildScheduleDispatchHubRoster (v2.3737: the hub roster is the People roster rule)', () => {
  const assistant = { id: 'u-1', role: 'assistant', needs_supervision: false, archived_at: null, is_digital_twin: false, is_sample: false }
  const helper = { id: 'u-2', role: 'helpers', needs_supervision: null, archived_at: null, is_digital_twin: false, is_sample: false }
  const sampleLeader = { id: 'u-3', role: 'master_technician', needs_supervision: false, archived_at: null, is_digital_twin: false, is_sample: true }
  const twinEstimator = { id: 'u-4', role: 'estimator', needs_supervision: false, archived_at: null, is_digital_twin: true, is_sample: false }
  const archived = { id: 'u-5', role: 'helpers', needs_supervision: true, archived_at: '2026-05-01T00:00:00Z', is_digital_twin: false, is_sample: false }
  const owner = { id: 'u-6', role: 'dev', needs_supervision: false, archived_at: null, is_digital_twin: false, is_sample: false }

  it('drops the View-as sample accounts and the digital twins for every viewer', () => {
    const rows = [assistant, sampleLeader, twinEstimator, helper]
    expect(buildScheduleDispatchHubRoster(rows, false).map((r) => r.id)).toEqual(['u-1', 'u-2'])
    expect(buildScheduleDispatchHubRoster(rows, true).map((r) => r.id)).toEqual(['u-1', 'u-2'])
  })

  it('drops archived rows and keeps dev rows only for a dev viewer', () => {
    expect(buildScheduleDispatchHubRoster([assistant, archived, owner], false).map((r) => r.id)).toEqual(['u-1'])
    expect(buildScheduleDispatchHubRoster([assistant, archived, owner], true).map((r) => r.id)).toEqual(['u-1', 'u-6'])
  })

  it('keeps one row per id, drops rows with no role, and defaults needs_supervision to true', () => {
    const out = buildScheduleDispatchHubRoster([helper, helper, { ...assistant, id: 'u-7', role: '' }], false)
    expect(out).toEqual([{ id: 'u-2', role: 'helpers', needs_supervision: true }])
  })

  it('treats a row without the flags as human (fail-soft for a partial select)', () => {
    expect(buildScheduleDispatchHubRoster([{ id: 'u-8', role: 'assistant' }], false)).toEqual([
      { id: 'u-8', role: 'assistant', needs_supervision: true },
    ])
  })
})

function block(over: Partial<JobScheduleBlockRow> = {}): JobScheduleBlockRow {
  return {
    id: 'blk-1',
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

describe('hubPersonDayKey / parseHubPersonDayKey', () => {
  it('reads back what the builder wrote', () => {
    const key = hubPersonDayKey('abraham', '2026-09-28')
    expect(key).toBe('abraham\t2026-09-28')
    expect(parseHubPersonDayKey(key)).toEqual({ assigneeUserId: 'abraham', workDate: '2026-09-28' })
  })

  it('refuses a key with no separator, no person or no day', () => {
    expect(parseHubPersonDayKey('abraham 2026-09-28')).toBeNull()
    expect(parseHubPersonDayKey('')).toBeNull()
    expect(parseHubPersonDayKey('\t2026-09-28')).toBeNull()
    expect(parseHubPersonDayKey('abraham\t')).toBeNull()
    expect(parseHubPersonDayKey('  \t2026-09-28')).toBeNull()
    expect(parseHubPersonDayKey('abraham\t  ')).toBeNull()
  })

  it('splits at the first separator', () => {
    expect(parseHubPersonDayKey('abraham\t2026-09-28\textra')).toEqual({
      assigneeUserId: 'abraham',
      workDate: '2026-09-28\textra',
    })
  })
})

describe('buildPersonDayBlockMap', () => {
  it('groups the blocks by person and day', () => {
    const m = buildPersonDayBlockMap([
      block({ id: 'a' }),
      block({ id: 'b', assignee_user_id: 'paige' }),
      block({ id: 'c', work_date: '2026-09-29' }),
    ])
    expect([...m.keys()]).toEqual([
      hubPersonDayKey('abraham', '2026-09-28'),
      hubPersonDayKey('paige', '2026-09-28'),
      hubPersonDayKey('abraham', '2026-09-29'),
    ])
    expect(m.get(hubPersonDayKey('paige', '2026-09-28'))?.map((b) => b.id)).toEqual(['b'])
  })

  it('orders a cell by start time, earliest first', () => {
    const m = buildPersonDayBlockMap([
      block({ id: 'noon', time_start: '12:00:00', time_end: '16:00:00' }),
      block({ id: 'early', time_start: '06:30:00', time_end: '08:00:00' }),
      block({ id: 'morning', time_start: '08:00:00', time_end: '12:00:00' }),
    ])
    expect(m.get(hubPersonDayKey('abraham', '2026-09-28'))?.map((b) => b.id)).toEqual(['early', 'morning', 'noon'])
  })

  it('keeps the incoming order for blocks that start together', () => {
    const m = buildPersonDayBlockMap([block({ id: 'first' }), block({ id: 'second' }), block({ id: 'third' })])
    expect(m.get(hubPersonDayKey('abraham', '2026-09-28'))?.map((b) => b.id)).toEqual(['first', 'second', 'third'])
  })

  it('keeps job and bid blocks in the same cell', () => {
    const m = buildPersonDayBlockMap([
      block({ id: 'job', time_start: '13:00:00', time_end: '15:00:00' }),
      block({ id: 'bid', job_id: null, bid_id: 'bid-9', time_start: '09:00:00', time_end: '10:00:00' }),
    ])
    expect(m.get(hubPersonDayKey('abraham', '2026-09-28'))?.map((b) => b.id)).toEqual(['bid', 'job'])
  })

  it('returns an empty map for no blocks', () => {
    expect(buildPersonDayBlockMap([]).size).toBe(0)
  })
})

describe('blocksToJobWeekSummaries', () => {
  it('writes one row per job block and skips the bid blocks', () => {
    expect(
      blocksToJobWeekSummaries([
        block({ id: 'a' }),
        block({ id: 'b', job_id: null, bid_id: 'bid-9' }),
        block({ id: 'c', job_id: 'job-2', work_date: '2026-09-29' }),
        block({ id: 'd', assignee_user_id: 'paige' }),
      ]),
    ).toEqual([
      { job_id: 'job-1', work_date: '2026-09-28' },
      { job_id: 'job-2', work_date: '2026-09-29' },
      { job_id: 'job-1', work_date: '2026-09-28' },
    ])
  })
})

describe('aggregateWeekSummariesByJob', () => {
  it('counts the blocks per job and per day', () => {
    const m = aggregateWeekSummariesByJob([
      { job_id: 'job-1', work_date: '2026-09-28' },
      { job_id: 'job-1', work_date: '2026-09-28' },
      { job_id: 'job-1', work_date: '2026-09-30' },
      { job_id: 'job-2', work_date: '2026-09-28' },
    ])
    expect(m.get('job-1')).toEqual({ total: 3, byDay: { '2026-09-28': 2, '2026-09-30': 1 } })
    expect(m.get('job-2')).toEqual({ total: 1, byDay: { '2026-09-28': 1 } })
    expect(m.size).toBe(2)
  })

  it('has no entry for a job with no blocks', () => {
    expect(aggregateWeekSummariesByJob([]).size).toBe(0)
    expect(aggregateWeekSummariesByJob([{ job_id: 'job-1', work_date: '2026-09-28' }]).get('job-2')).toBeUndefined()
  })
})

describe('formatScheduleDispatchHubJobTitle', () => {
  it('reads "J<number> · <job name>"', () => {
    expect(formatScheduleDispatchHubJobTitle('927', 'Berg AirBnb')).toBe('J927 · Berg AirBnb')
    expect(formatScheduleDispatchHubJobTitle(' 927 ', ' Berg AirBnb ')).toBe('J927 · Berg AirBnb')
  })

  it('falls back to the Click number only when it is handed one', () => {
    expect(formatScheduleDispatchHubJobTitle(null, 'Berg AirBnb', '4102')).toBe('J4102 · Berg AirBnb')
    expect(formatScheduleDispatchHubJobTitle('927', 'Berg AirBnb', '4102')).toBe('J927 · Berg AirBnb')
    expect(formatScheduleDispatchHubJobTitle(null, 'Berg AirBnb')).toBe('— · Berg AirBnb')
  })

  it('says "— · Job" when there is nothing to say', () => {
    expect(formatScheduleDispatchHubJobTitle(null, null)).toBe('— · Job')
    expect(formatScheduleDispatchHubJobTitle('  ', '  ', '  ')).toBe('— · Job')
    expect(formatScheduleDispatchHubJobTitle(undefined, undefined, undefined)).toBe('— · Job')
  })
})

describe('formatScheduleDispatchHubBidTitle', () => {
  it('reads "B<number> · <project>"', () => {
    expect(formatScheduleDispatchHubBidTitle('375', 'Tower West')).toBe('B375 · Tower West')
    expect(formatScheduleDispatchHubBidTitle(' 375 ', ' Tower West ')).toBe('B375 · Tower West')
  })

  it('says "Bid" for whichever half is missing', () => {
    expect(formatScheduleDispatchHubBidTitle(null, 'Tower West')).toBe('Bid · Tower West')
    expect(formatScheduleDispatchHubBidTitle('375', null)).toBe('B375 · Bid')
    expect(formatScheduleDispatchHubBidTitle('', '  ')).toBe('Bid · Bid')
  })
})
