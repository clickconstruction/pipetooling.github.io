import { describe, expect, it } from 'vitest'
import {
  EMPTY_BUNDLE_FILTERS,
  distinctValues,
  filterDeletedBundles,
  humanizeArchiveTable,
  summarizeDeletedRow,
} from './deletedRecordContents'

describe('humanizeArchiveTable', () => {
  it('maps known archive tables to friendly names', () => {
    expect(humanizeArchiveTable('jobs_ledger_fixtures')).toBe('fixtures')
    expect(humanizeArchiveTable('job_schedule_blocks')).toBe('schedule blocks')
    expect(humanizeArchiveTable('clock_sessions')).toBe('clock sessions')
  })

  it('falls back to underscores → spaces for unmapped tables', () => {
    expect(humanizeArchiveTable('some_future_table')).toBe('some future table')
  })
})

describe('summarizeDeletedRow', () => {
  it('composes title · date · money from whichever fields the row has', () => {
    expect(
      summarizeDeletedRow({ job_name: 'Take 5- Seguin', work_date: '2026-07-29', amount: 1250.5, id: 'x' }),
    ).toBe('Take 5- Seguin · 2026-07-29 · $1,250.50')
  })

  it('prefers the most specific title field and trims to the date part', () => {
    expect(summarizeDeletedRow({ name: 'generic', person_name: 'Malachi', date: '2026-07-01T12:00:00Z' })).toBe(
      'Malachi · 2026-07-01',
    )
  })

  it('adds a quantity when the row has little else', () => {
    expect(summarizeDeletedRow({ description: 'PVC 2in', quantity: 4 })).toBe('PVC 2in · 4 qty')
    expect(summarizeDeletedRow({ hours_total: 8.5 })).toBe('8.5 hr')
  })

  it('ignores empty strings and non-finite numbers', () => {
    expect(summarizeDeletedRow({ name: '  ', title: 'Real title', amount: Number.NaN })).toBe('Real title')
  })

  it('falls back to a short id, then a constant', () => {
    expect(summarizeDeletedRow({ id: 'f845bed0-1234-5678-9abc-def012345678' })).toBe('id f845bed0')
    expect(summarizeDeletedRow({})).toBe('row')
  })
})

describe('filterDeletedBundles', () => {
  const bundles = [
    { kind: 'job', label: 'Take 5- Seguin', deleted_by_name: 'Wendi' },
    { kind: 'clock session', label: 'Robert · 2026-07-26', deleted_by_name: 'Robert' },
    { kind: 'clock session', label: 'Malachi · 2026-07-21', deleted_by_name: null },
  ]

  it('returns everything for empty filters', () => {
    expect(filterDeletedBundles(bundles, EMPTY_BUNDLE_FILTERS)).toHaveLength(3)
  })

  it('filters by kind, deleter, and case-insensitive label search — combined', () => {
    expect(filterDeletedBundles(bundles, { kind: 'clock session', deletedBy: '', search: '' })).toHaveLength(2)
    expect(filterDeletedBundles(bundles, { kind: '', deletedBy: 'Wendi', search: '' })).toHaveLength(1)
    expect(filterDeletedBundles(bundles, { kind: '', deletedBy: '', search: 'seguin' })).toHaveLength(1)
    expect(filterDeletedBundles(bundles, { kind: 'clock session', deletedBy: 'Wendi', search: '' })).toHaveLength(0)
  })
})

describe('distinctValues', () => {
  it('keeps first-seen order and drops null/empty', () => {
    const rows = [{ v: 'b' }, { v: 'a' }, { v: 'b' }, { v: null }, { v: '' }]
    expect(distinctValues(rows, (r) => r.v)).toEqual(['b', 'a'])
  })
})
