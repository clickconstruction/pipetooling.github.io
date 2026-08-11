import { describe, expect, it } from 'vitest'
import {
  EMPTY_BUNDLE_FILTERS,
  buildBundleDigestChips,
  bundleInAlertWindows,
  clockSessionStatus,
  deriveBundleBadges,
  distinctValues,
  filterDeletedBundles,
  groupBundlesByBurst,
  humanizeArchiveTable,
  sortBundlesAlertFirst,
  summarizeDeletedRow,
  summarizeDeletedRowForTable,
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
      'clock sessions: 2026-08-07 · pending approval',
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

describe('summarizeDeletedRowForTable (v2.1566 type-aware summaries)', () => {
  const users = new Map([['u-paige', 'Paige'], ['u-taunya', 'Taunya']])

  it('clock session: person, company-time window, hours, status, note', () => {
    const line = summarizeDeletedRowForTable(
      'clock_sessions',
      {
        user_id: 'u-paige',
        work_date: '2026-08-07',
        clocked_in_at: '2026-08-07T11:32:00Z', // 6:32 AM Chicago (CDT)
        clocked_out_at: '2026-08-07T21:15:00Z', // 4:15 PM
        approved_at: null,
        notes: 'Abe',
      },
      { userNameById: users },
    )
    expect(line).toBe('Paige — 6:32 AM–4:15 PM · 9.7h · pending approval · “Abe”')
  })

  it('clock session with no clock-out says so', () => {
    const line = summarizeDeletedRowForTable(
      'clock_sessions',
      { user_id: 'u-paige', clocked_in_at: '2026-08-07T11:32:00Z' },
      { userNameById: users },
    )
    expect(line).toBe('Paige — in at 6:32 AM (no clock-out) · pending approval')
  })

  it('report: template, author, date', () => {
    expect(
      summarizeDeletedRowForTable('reports', {
        template_name: 'Daily report',
        created_by_name: 'Abraham',
        created_at: '2026-08-07T12:00:00Z',
      }),
    ).toBe('“Daily report” · Abraham · 2026-08-07')
  })

  it('invoice: sequence, amount, status', () => {
    expect(
      summarizeDeletedRowForTable('invoices', { sequence_order: 2, amount: 4520, stripe_invoice_status: 'paid' }),
    ).toBe('invoice #2 · $4,520.00 · paid')
  })

  it('falls back to the generic summary for unknown tables', () => {
    expect(summarizeDeletedRowForTable('jobs_ledger_fixtures', { fixture_name: 'Tub drain', price: 340 })).toBe(
      'Tub drain · $340.00',
    )
  })
})

describe('clockSessionStatus', () => {
  it('orders revoked > rejected > approved > pending', () => {
    expect(clockSessionStatus({ approved_at: '2026-08-01T00:00:00Z' })).toBe('approved')
    expect(clockSessionStatus({ rejected_at: '2026-08-01T00:00:00Z' })).toBe('rejected')
    expect(clockSessionStatus({})).toBe('pending approval')
  })
})

describe('deriveBundleBadges', () => {
  const base = {
    groupKey: 'g1',
    deletedAt: '2026-08-07T16:39:00Z',
    deletedById: 'u-taunya',
    deletedByName: 'Taunya',
    userNameById: new Map([['u-paige', 'Paige']]),
  }

  it('flags money, young age, pending approval, and foreign ownership from full rows', () => {
    const badges = deriveBundleBadges({
      ...base,
      rows: [
        {
          table_name: 'clock_sessions',
          record_id: 'g1',
          row_data: { user_id: 'u-paige', created_at: '2026-08-07T16:15:00Z' },
        },
        { table_name: 'invoices', record_id: 'x', row_data: { amount: 4520 } },
      ],
    })
    expect(badges).toEqual([
      { label: '$4,520 in invoices', tone: 'red' },
      { label: 'created 24m before deletion', tone: 'red' },
      { label: 'pending approval', tone: 'amber' },
      { label: 'belonged to Paige', tone: 'blue' },
    ])
  })

  it('uses the digest RPC fields when rows are absent', () => {
    const badges = deriveBundleBadges({
      ...base,
      tables: ['payments_made'],
      moneyTotal: 900,
      headCreatedAt: '2026-04-01T00:00:00Z',
      ownerUserId: 'u-paige',
      ownerName: 'Paige',
    })
    expect(badges).toEqual([
      { label: '$900 in payments', tone: 'red' },
      { label: 'existed 4 months', tone: 'neutral' },
      { label: 'belonged to Paige', tone: 'blue' },
    ])
  })

  it('reports approved sessions and job value as red, own-record deletions get no ownership badge', () => {
    const badges = deriveBundleBadges({
      ...base,
      deletedById: 'u-paige',
      rows: [
        {
          table_name: 'clock_sessions',
          record_id: 'g1',
          row_data: { user_id: 'u-paige', approved_at: '2026-08-01T00:00:00Z', created_at: '2026-06-01T00:00:00Z' },
        },
        { table_name: 'jobs_ledger_fixtures', record_id: 'f1', row_data: { price: 340 } },
      ],
    })
    expect(badges).toEqual([
      { label: '$340 removed from job', tone: 'red' },
      { label: 'existed 2 months', tone: 'neutral' },
      { label: 'approved session deleted', tone: 'red' },
    ])
  })

  it('renders nothing when nothing is known', () => {
    expect(deriveBundleBadges({ groupKey: 'g', deletedAt: '2026-08-07T00:00:00Z' })).toEqual([])
  })
})

describe('groupBundlesByBurst', () => {
  const alerts = [
    { actor_name: 'Taunya', window_start: '2026-08-07T15:00:00Z', window_end: '2026-08-07T17:00:00Z' },
    { actor_name: 'Wendi', window_start: '2026-08-04T13:00:00Z', window_end: '2026-08-04T15:00:00Z' },
  ]

  it('assigns bundles to their burst window and keeps the rest in order', () => {
    const bundles = [
      { label: 'a', deleted_at: '2026-08-07T16:00:00Z' },
      { label: 'b', deleted_at: '2026-08-04T14:00:00Z' },
      { label: 'c', deleted_at: '2026-08-01T09:00:00Z' },
      { label: 'd', deleted_at: '2026-08-07T15:30:00Z' },
    ]
    const { bursts, rest } = groupBundlesByBurst(bundles, alerts)
    expect(bursts.map((g) => ({ actor: g.alert.actor_name, labels: g.bundles.map((b) => b.label) }))).toEqual([
      { actor: 'Taunya', labels: ['a', 'd'] },
      { actor: 'Wendi', labels: ['b'] },
    ])
    expect(rest.map((b) => b.label)).toEqual(['c'])
  })

  it('drops empty bursts and handles no alerts', () => {
    expect(groupBundlesByBurst([{ deleted_at: '2026-08-01T00:00:00Z' }], alerts).bursts).toEqual([])
    const none = groupBundlesByBurst([{ deleted_at: '2026-08-01T00:00:00Z' }], [])
    expect(none.bursts).toEqual([])
    expect(none.rest).toHaveLength(1)
  })
})
