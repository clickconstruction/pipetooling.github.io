import { describe, expect, it } from 'vitest'
import {
  EMPTY_BUNDLE_FILTERS,
  buildBundleDigestChips,
  bundleInAlertWindows,
  distinctValues,
  filterDeletedBundles,
  humanizeArchiveTable,
  sortBundlesAlertFirst,
  summarizeDeletedRow,
  summarizePreviewItems,
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

describe('buildBundleDigestChips', () => {
  it('puts money tables first, then by count desc, then label', () => {
    const chips = buildBundleDigestChips(
      ['clock_sessions', 'invoices', 'jobs_ledger_line_items', 'job_team_members'],
      { clock_sessions: 2, invoices: 3, jobs_ledger_line_items: 12, job_team_members: 2 },
    )
    expect(chips.map((c) => c.table)).toEqual([
      'invoices',
      'jobs_ledger_line_items',
      'clock_sessions',
      'job_team_members',
    ])
    expect(chips[0]).toEqual({ table: 'invoices', label: 'invoices', count: 3, money: true })
  })

  it('degrades to label-only chips when counts are absent (old RPC shape)', () => {
    const chips = buildBundleDigestChips(['invoices', 'clock_sessions'], null)
    expect(chips.map((c) => c.count)).toEqual([null, null])
    expect(chips.map((c) => c.money)).toEqual([true, false])
  })

  it('ignores non-finite counts', () => {
    const chips = buildBundleDigestChips(['reports'], { reports: Number.NaN })
    expect(chips[0]?.count).toBeNull()
  })
})

describe('summarizePreviewItems', () => {
  it('renders "table: summary" lines, capped at the limit', () => {
    const items = [
      { table_name: 'invoices', fields: { invoice_number: '1042', amount: 4520 } },
      { table_name: 'jobs_ledger_line_items', fields: { description: 'PVC 2in', quantity: 4 } },
      { table_name: 'clock_sessions', fields: { work_date: '2026-08-07', hours: 8 } },
      { table_name: 'reports', fields: { title: 'Day 3' } },
    ]
    expect(summarizePreviewItems(items)).toEqual([
      'invoices: 1042 · $4,520.00',
      'line items: PVC 2in · 4 qty',
      'clock sessions: 2026-08-07 · 8 hr',
    ])
    expect(summarizePreviewItems(items, 4)).toHaveLength(4)
  })

  it('returns [] for absent or malformed payloads (pre-migration RPC)', () => {
    expect(summarizePreviewItems(undefined)).toEqual([])
    expect(summarizePreviewItems(null)).toEqual([])
    expect(summarizePreviewItems('nope')).toEqual([])
    expect(summarizePreviewItems([{ table_name: 42 }, { fields: {} }])).toEqual([])
  })
})

describe('alert-window helpers', () => {
  const windows = [{ start: '2026-08-08T10:00:00Z', end: '2026-08-08T10:20:00Z' }]

  it('bundleInAlertWindows matches inclusively and rejects bad dates', () => {
    expect(bundleInAlertWindows('2026-08-08T10:00:00Z', windows)).toBe(true)
    expect(bundleInAlertWindows('2026-08-08T10:20:00Z', windows)).toBe(true)
    expect(bundleInAlertWindows('2026-08-08T10:21:00Z', windows)).toBe(false)
    expect(bundleInAlertWindows('garbage', windows)).toBe(false)
    expect(bundleInAlertWindows('2026-08-08T10:10:00Z', [])).toBe(false)
  })

  it('sortBundlesAlertFirst stable-partitions, keeping order within each half', () => {
    const bundles = [
      { label: 'newest, outside', deleted_at: '2026-08-08T11:00:00Z' },
      { label: 'burst A', deleted_at: '2026-08-08T10:15:00Z' },
      { label: 'burst B', deleted_at: '2026-08-08T10:05:00Z' },
      { label: 'old, outside', deleted_at: '2026-08-01T09:00:00Z' },
    ]
    expect(sortBundlesAlertFirst(bundles, windows).map((b) => b.label)).toEqual([
      'burst A',
      'burst B',
      'newest, outside',
      'old, outside',
    ])
    expect(sortBundlesAlertFirst(bundles, []).map((b) => b.label)).toEqual(bundles.map((b) => b.label))
  })
})
