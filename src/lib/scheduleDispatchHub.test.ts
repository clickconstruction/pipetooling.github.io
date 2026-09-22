import { describe, expect, it } from 'vitest'
import {
  buildScheduleDispatchHubRoster,
  findDuplicateJobAddress,
  isFinishedJobPickerStatus,
  jobPickerStatusChip,
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
