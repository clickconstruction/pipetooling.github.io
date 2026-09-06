import { describe, expect, it } from 'vitest'
import type { ClockSessionRow } from '../types/clockSessions'
import { buildLedgerPrefixMap } from './ledgerDisplayPrefixes'
import { MIN_SEGMENT_MS, type DayEditorSession } from './myTimeDayTimeline'
import {
  buildJobBidLabelMapsFromClockRows,
  collectPeopleHoursDaySessionsForScale,
  scaleClosedSessionsToTargetHours,
  toDayEditorSession,
} from './peopleHoursProportionalScale'

const H = 3600 * 1000

function session(id: string, inIso: string, outIso: string | null, extra: Partial<DayEditorSession> = {}): DayEditorSession {
  return {
    id,
    clocked_in_at: inIso,
    clocked_out_at: outIso,
    work_date: '2026-09-01',
    notes: '',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...extra,
  }
}

const ms = (iso: string) => new Date(iso).getTime()

describe('scaleClosedSessionsToTargetHours', () => {
  it('gives every session the minimum first, splits the rest 1:3, and packs them back to back from the first clock-in', () => {
    // 1 h + 3 h = 4 h → target 2 h. Each segment gets MIN_SEGMENT_MS, then the
    // remainder (2 h − 2·MIN) is split in the old 1:3 ratio — so not exactly
    // 0.5 h / 1.5 h, but MIN + ¼·rem and MIN + ¾·rem.
    const out = scaleClosedSessionsToTargetHours(
      [
        session('b', '2026-09-01T14:00:00.000Z', '2026-09-01T17:00:00.000Z'),
        session('a', '2026-09-01T12:00:00.000Z', '2026-09-01T13:00:00.000Z'),
      ],
      2,
    )
    const rem = 2 * H - 2 * MIN_SEGMENT_MS
    expect(out).not.toBeNull()
    expect(out!.map((s) => s.id)).toEqual(['a', 'b']) // sorted by original clock-in
    expect(ms(out![0]!.clocked_in_at)).toBe(ms('2026-09-01T12:00:00.000Z'))
    expect(ms(out![0]!.clocked_out_at!) - ms(out![0]!.clocked_in_at)).toBe(MIN_SEGMENT_MS + rem / 4)
    expect(ms(out![1]!.clocked_in_at)).toBe(ms(out![0]!.clocked_out_at!)) // contiguous
    expect(ms(out![1]!.clocked_out_at!) - ms(out![1]!.clocked_in_at)).toBe(MIN_SEGMENT_MS + (3 * rem) / 4)
    expect(ms(out![1]!.clocked_out_at!) - ms(out![0]!.clocked_in_at)).toBe(2 * H) // the day totals the target exactly
  })

  it('ignores an open session and keeps every other field of the closed ones', () => {
    const out = scaleClosedSessionsToTargetHours(
      [
        session('open', '2026-09-01T18:00:00.000Z', null),
        session('a', '2026-09-01T12:00:00.000Z', '2026-09-01T14:00:00.000Z', { job_ledger_id: 'J1', notes: 'keep me' }),
      ],
      1,
    )
    expect(out!.map((s) => s.id)).toEqual(['a'])
    expect(out![0]).toMatchObject({ job_ledger_id: 'J1', notes: 'keep me', origin: 'user_punch' })
    expect(ms(out![0]!.clocked_out_at!) - ms(out![0]!.clocked_in_at)).toBe(1 * H)
  })

  it('lands on the exact target in milliseconds even when the split is not a clean ratio', () => {
    const target = 1.2345 // hours
    const out = scaleClosedSessionsToTargetHours(
      [
        session('a', '2026-09-01T12:00:00.000Z', '2026-09-01T12:07:00.000Z'),
        session('b', '2026-09-01T12:07:00.000Z', '2026-09-01T12:18:00.000Z'),
        session('c', '2026-09-01T12:18:00.000Z', '2026-09-01T12:31:00.000Z'),
      ],
      target,
    )
    const total = out!.reduce((sum, s) => sum + (ms(s.clocked_out_at!) - ms(s.clocked_in_at)), 0)
    expect(total).toBe(Math.round(target * H))
    for (const s of out!) expect(ms(s.clocked_out_at!) - ms(s.clocked_in_at)).toBeGreaterThanOrEqual(MIN_SEGMENT_MS)
  })

  it('returns null when there is nothing closed to scale or the target is not a positive number', () => {
    const open = [session('open', '2026-09-01T18:00:00.000Z', null)]
    expect(scaleClosedSessionsToTargetHours(open, 2)).toBeNull()
    expect(scaleClosedSessionsToTargetHours([], 2)).toBeNull()
    const closed = [session('a', '2026-09-01T12:00:00.000Z', '2026-09-01T13:00:00.000Z')]
    expect(scaleClosedSessionsToTargetHours(closed, 0)).toBeNull()
    expect(scaleClosedSessionsToTargetHours(closed, -1)).toBeNull()
    expect(scaleClosedSessionsToTargetHours(closed, Number.NaN)).toBeNull()
    expect(scaleClosedSessionsToTargetHours(closed, Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('refuses a target too small to give every session the minimum segment', () => {
    const three = [
      session('a', '2026-09-01T12:00:00.000Z', '2026-09-01T13:00:00.000Z'),
      session('b', '2026-09-01T13:00:00.000Z', '2026-09-01T14:00:00.000Z'),
      session('c', '2026-09-01T14:00:00.000Z', '2026-09-01T15:00:00.000Z'),
    ]
    // 3 × MIN_SEGMENT_MS = 0.03 h; ask for 0.02 h
    expect(scaleClosedSessionsToTargetHours(three, 0.02)).toBeNull()
    expect(scaleClosedSessionsToTargetHours(three, 0.03)).not.toBeNull()
  })

  it('returns null when the closed sessions have no duration to apportion', () => {
    const zero = [session('a', '2026-09-01T12:00:00.000Z', '2026-09-01T12:00:00.000Z')]
    expect(scaleClosedSessionsToTargetHours(zero, 1)).toBeNull()
  })
})

describe('toDayEditorSession', () => {
  it('defaults origin and segment index for rows the RPC left undefined', () => {
    const s = toDayEditorSession({
      id: 'x',
      clocked_in_at: '2026-09-01T12:00:00.000Z',
      clocked_out_at: null,
      work_date: '2026-09-01',
      notes: '',
      job_ledger_id: null,
      bid_id: null,
      approved_at: null,
    })
    expect(s.origin).toBe('user_punch')
    expect(s.salary_segment_index).toBeNull()
  })
})

describe('collectPeopleHoursDaySessionsForScale', () => {
  const row = (id: string, user_id: string, work_date: string, extra: Partial<ClockSessionRow> = {}) =>
    ({ id, user_id, work_date, rejected_at: null, revoked_at: null, ...extra }) as unknown as ClockSessionRow

  it('keeps only this person, this day, and nothing rejected or revoked — across pending and approved', () => {
    const pending = [row('p1', 'u1', '2026-09-01'), row('p2', 'u2', '2026-09-01'), row('p3', 'u1', '2026-09-02')]
    const approved = [
      row('a1', 'u1', '2026-09-01'),
      row('a2', 'u1', '2026-09-01', { rejected_at: '2026-09-01T20:00:00Z' }),
      row('a3', 'u1', '2026-09-01', { revoked_at: '2026-09-01T20:00:00Z' }),
    ]
    expect(collectPeopleHoursDaySessionsForScale(pending, approved, 'u1', '2026-09-01').map((r) => r.id)).toEqual(['p1', 'a1'])
  })
})

describe('buildJobBidLabelMapsFromClockRows', () => {
  const prefixMap = buildLedgerPrefixMap([])

  it('maps each linked job and bid id to a short label, skipping unlinked rows', () => {
    const rows = [
      { job_ledger_id: 'J1', bid_id: null, jobs_ledger: { hcp_number: '878', job_name: 'Smith', click_number: null, service_type_id: null }, bids: null },
      { job_ledger_id: null, bid_id: 'B1', jobs_ledger: null, bids: { bid_number: 'b404', project_name: 'Hyper Kidz', service_type_id: null } },
      { job_ledger_id: null, bid_id: null, jobs_ledger: null, bids: null },
    ] as unknown as ClockSessionRow[]
    const { jobLabels, bidLabels } = buildJobBidLabelMapsFromClockRows(rows, prefixMap)
    expect(Object.keys(jobLabels)).toEqual(['J1'])
    expect(jobLabels.J1).toContain('878')
    expect(Object.keys(bidLabels)).toEqual(['B1'])
    expect(bidLabels.B1).toContain('404')
  })
})
