import { describe, expect, it } from 'vitest'
import {
  filterActiveCustomersForPicker,
  isCustomerArchived,
  partitionCustomersByArchived,
} from './customerArchive'

const active = { id: 'a', archived_at: null }
const archived = { id: 'b', archived_at: '2026-07-18T12:00:00Z' }

describe('isCustomerArchived', () => {
  it('returns true only for a non-empty archived_at string', () => {
    expect(isCustomerArchived(archived)).toBe(true)
    expect(isCustomerArchived(active)).toBe(false)
    expect(isCustomerArchived({ id: 'c', archived_at: '' })).toBe(false)
    expect(isCustomerArchived({ id: 'c', archived_at: '   ' })).toBe(false)
  })

  it('treats a missing column (pre-migration client) and missing row as active', () => {
    expect(isCustomerArchived({ id: 'c' })).toBe(false)
    expect(isCustomerArchived(null)).toBe(false)
    expect(isCustomerArchived(undefined)).toBe(false)
  })
})

describe('partitionCustomersByArchived', () => {
  it('splits rows into active and archived preserving order', () => {
    const other = { id: 'c', archived_at: '2026-01-01T00:00:00Z' }
    const { active: act, archived: arc } = partitionCustomersByArchived([archived, active, other])
    expect(act).toEqual([active])
    expect(arc).toEqual([archived, other])
  })

  it('returns empty buckets for an empty list', () => {
    expect(partitionCustomersByArchived([])).toEqual({ active: [], archived: [] })
  })
})

describe('filterActiveCustomersForPicker', () => {
  it('drops archived rows', () => {
    expect(filterActiveCustomersForPicker([active, archived])).toEqual([active])
  })

  it('keeps the currently-linked archived row via keepId', () => {
    expect(filterActiveCustomersForPicker([active, archived], 'b')).toEqual([active, archived])
  })

  it('keepId matching an active row changes nothing; null/undefined keepId keeps none archived', () => {
    expect(filterActiveCustomersForPicker([active, archived], 'a')).toEqual([active])
    expect(filterActiveCustomersForPicker([active, archived], null)).toEqual([active])
    expect(filterActiveCustomersForPicker([active, archived], undefined)).toEqual([active])
  })

  it('rows without the archived_at column pass through untouched', () => {
    const legacy = { id: 'z' }
    expect(filterActiveCustomersForPicker([legacy, archived])).toEqual([legacy])
  })
})
