import { describe, expect, it } from 'vitest'
import {
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
