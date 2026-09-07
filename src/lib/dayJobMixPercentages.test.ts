import { describe, expect, it } from 'vitest'
import type { TodaySessionStripRow } from '../hooks/useDashboardMyTeamSectionState'
import {
  allocateSecondsForPercents,
  dayJobMixAllocationKey,
  dayMixSessionDurationSeconds,
  normalizeMixRowPercents,
  sessionsToMixRows,
  totalMixSeconds,
} from './dayJobMixPercentages'
import { buildLedgerPrefixMap } from './ledgerDisplayPrefixes'

const NOW = new Date('2026-09-01T20:00:00.000Z').getTime()

function strip(id: string, inIso: string, outIso: string | null, extra: Record<string, unknown> = {}): TodaySessionStripRow {
  return {
    id,
    user_id: 'u1',
    clocked_in_at: inIso,
    clocked_out_at: outIso,
    approved_at: null,
    rejected_at: null,
    revoked_at: null,
    notes: null,
    job_ledger_id: null,
    bid_id: null,
    users: null,
    jobs_ledger: null,
    bids: null,
    ...extra,
  } as unknown as TodaySessionStripRow
}

describe('dayMixSessionDurationSeconds', () => {
  it('measures a closed session in whole seconds, flooring', () => {
    expect(dayMixSessionDurationSeconds('2026-09-01T12:00:00.000Z', '2026-09-01T13:30:00.500Z', NOW)).toBe(5400)
  })
  it('measures an open session up to now', () => {
    expect(dayMixSessionDurationSeconds('2026-09-01T19:00:00.000Z', null, NOW)).toBe(3600)
  })
  it('never goes negative', () => {
    expect(dayMixSessionDurationSeconds('2026-09-01T21:00:00.000Z', null, NOW)).toBe(0)
    expect(dayMixSessionDurationSeconds('2026-09-01T13:00:00.000Z', '2026-09-01T12:00:00.000Z', NOW)).toBe(0)
  })
})

describe('dayJobMixAllocationKey', () => {
  it('prefers the job, then the bid, else unassigned', () => {
    expect(dayJobMixAllocationKey('J1', 'B1')).toBe('job:J1')
    expect(dayJobMixAllocationKey(null, 'B1')).toBe('bid:B1')
    expect(dayJobMixAllocationKey(null, null)).toBe('unassigned')
  })
})

describe('sessionsToMixRows', () => {
  const prefixMap = buildLedgerPrefixMap([])

  it('groups by job / bid, weights by duration, sorts largest first, and pcts sum to 1', () => {
    const rows = sessionsToMixRows(
      [
        strip('a', '2026-09-01T12:00:00.000Z', '2026-09-01T13:00:00.000Z', { job_ledger_id: 'J1', jobs_ledger: { hcp_number: '878', job_name: 'Smith', job_address: null, click_number: null, service_type_id: null } }),
        strip('b', '2026-09-01T13:00:00.000Z', '2026-09-01T16:00:00.000Z'), // unassigned 3 h
        strip('c', '2026-09-01T16:00:00.000Z', '2026-09-01T18:00:00.000Z', { job_ledger_id: 'J1', jobs_ledger: { hcp_number: '878', job_name: 'Smith', job_address: null, click_number: null, service_type_id: null } }),
      ],
      NOW,
      prefixMap,
    )
    expect(rows.map((r) => [r.key, r.seconds])).toEqual([
      ['job:J1', 3 * 3600],
      ['unassigned', 3 * 3600],
    ])
    expect(rows[0]!.label).toContain('878')
    expect(rows[1]!.label).toBe('Unassigned')
    expect(rows.reduce((s, r) => s + r.pct, 0)).toBeCloseTo(1, 10)
  })

  it('drops rejected, revoked and zero-length sessions, and returns [] when nothing counts', () => {
    const rows = sessionsToMixRows(
      [
        strip('r', '2026-09-01T12:00:00.000Z', '2026-09-01T13:00:00.000Z', { rejected_at: '2026-09-01T13:01:00Z' }),
        strip('v', '2026-09-01T12:00:00.000Z', '2026-09-01T13:00:00.000Z', { revoked_at: '2026-09-01T13:01:00Z' }),
        strip('z', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z'),
      ],
      NOW,
      prefixMap,
    )
    expect(rows).toEqual([])
  })

  it('counts an open session up to now', () => {
    const rows = sessionsToMixRows([strip('o', '2026-09-01T19:30:00.000Z', null, { bid_id: 'B1', bids: { bid_number: 'b404', project_name: 'Hyper Kidz', address: null, service_type_id: null, customers: null } })], NOW, prefixMap)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: 'bid:B1', seconds: 1800, pct: 1 })
    expect(rows[0]!.label).toContain('404')
  })
})

describe('totals and re-normalisation', () => {
  it('totalMixSeconds sums the rows', () => {
    expect(totalMixSeconds([{ seconds: 10 }, { seconds: 5 }])).toBe(15)
    expect(totalMixSeconds([])).toBe(0)
  })

  it('normalizeMixRowPercents rescales after filtering, and yields zeros for an empty total', () => {
    const rows = [
      { key: 'a', job_ledger_id: null, bid_id: null, label: '', seconds: 30, pct: 0.3 },
      { key: 'b', job_ledger_id: null, bid_id: null, label: '', seconds: 10, pct: 0.1 },
    ]
    expect(normalizeMixRowPercents(rows).map((r) => r.pct)).toEqual([0.75, 0.25])
    expect(normalizeMixRowPercents([{ ...rows[0]!, seconds: 0 }])).toEqual([{ pct: 0 }])
  })
})

describe('allocateSecondsForPercents', () => {
  it('floors every share but the last, which absorbs the remainder so the total is exact', () => {
    const out = allocateSecondsForPercents(100, [1 / 3, 1 / 3, 1 / 3])
    expect(out).toEqual([33, 33, 34])
    expect(out.reduce((a, b) => a + b, 0)).toBe(100)
  })
  it('never lets the last share go negative when rounding overshoots', () => {
    expect(allocateSecondsForPercents(1, [1, 1])).toEqual([1, 0])
  })
  it('returns [] for no percents', () => {
    expect(allocateSecondsForPercents(100, [])).toEqual([])
  })
})
