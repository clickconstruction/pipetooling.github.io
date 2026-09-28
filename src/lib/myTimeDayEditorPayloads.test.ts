import { describe, expect, it } from 'vitest'
import {
  buildPayloads,
  dayEditorClusterCanSave,
  singleSegmentTimesMatchSession,
  stripJobBidForSegmentRpc,
} from './myTimeDayEditorPayloads'
import { MIN_SEGMENT_MS, type DayEditorSession } from './myTimeDayTimeline'

const H = 3_600_000
const DAY = Date.UTC(2026, 0, 5, 14, 0, 0)
const T = (hours: number, extraMs = 0) => DAY + hours * H + extraMs
const iso = (ms: number) => new Date(ms).toISOString()

function mk(
  id: string,
  inMs: number,
  outMs: number | null,
  over: Partial<DayEditorSession> = {}
): DayEditorSession {
  return {
    id,
    clocked_in_at: iso(inMs),
    clocked_out_at: outMs != null ? iso(outMs) : null,
    work_date: '2026-01-05',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
    ...over,
  }
}

describe('buildPayloads', () => {
  it('returns null without two boundaries', () => {
    const s = mk('a', T(0), T(2))
    expect(buildPayloads(s, { boundaries: [], notes: [] }, T(3))).toBeNull()
    expect(buildPayloads(s, { boundaries: [T(0)], notes: ['x'] }, T(3))).toBeNull()
  })

  it('writes one payload per segment, notes trimmed, times as ISO', () => {
    const s = mk('a', T(0), T(3))
    const out = buildPayloads(s, { boundaries: [T(0), T(1), T(3)], notes: ['  rough-in ', 'trim'] }, T(9))
    expect(out).toEqual([
      { clocked_in_at: iso(T(0)), clocked_out_at: iso(T(1)), notes: 'rough-in' },
      { clocked_in_at: iso(T(1)), clocked_out_at: iso(T(3)), notes: 'trim' },
    ])
  })

  it('never carries job or bid — the row and the overrides hold those', () => {
    const s = mk('a', T(0), T(2), { job_ledger_id: 'job-1', bid_id: 'bid-1' })
    const out = buildPayloads(
      s,
      {
        boundaries: [T(0), T(2)],
        notes: ['x'],
        segmentJobOverrides: { 0: { job_ledger_id: 'job-2', bid_id: null } },
      },
      T(9)
    )
    expect(out).toHaveLength(1)
    expect(out![0]).not.toHaveProperty('job_ledger_id')
    expect(out![0]).not.toHaveProperty('bid_id')
  })

  it('rejects a blank, whitespace or missing note on any segment', () => {
    const s = mk('a', T(0), T(3))
    const boundaries = [T(0), T(1), T(3)]
    expect(buildPayloads(s, { boundaries, notes: ['ok', ''] }, T(9))).toBeNull()
    expect(buildPayloads(s, { boundaries, notes: ['   ', 'ok'] }, T(9))).toBeNull()
    expect(buildPayloads(s, { boundaries, notes: ['ok'] }, T(9))).toBeNull()
  })

  it('holds every closed segment to the 0.01 h minimum, inclusive', () => {
    const s = mk('a', T(0), T(3))
    const short = { boundaries: [T(0), T(0, MIN_SEGMENT_MS - 1), T(3)], notes: ['a', 'b'] }
    const exact = { boundaries: [T(0), T(0, MIN_SEGMENT_MS), T(3)], notes: ['a', 'b'] }
    expect(buildPayloads(s, short, T(9))).toBeNull()
    expect(buildPayloads(s, exact, T(9))).toHaveLength(2)
  })

  it('an open last segment saves with no clock-out and is measured against now, not its boundary', () => {
    const s = mk('a', T(0), null)
    // The last boundary is stale (equal to the one before it); the clock has run an hour since.
    const split = { boundaries: [T(0), T(1), T(1)], notes: ['a', 'b'] }
    expect(buildPayloads(s, split, T(2))).toEqual([
      { clocked_in_at: iso(T(0)), clocked_out_at: iso(T(1)), notes: 'a' },
      { clocked_in_at: iso(T(1)), clocked_out_at: null, notes: 'b' },
    ])
  })

  it('rejects an open last segment younger than the minimum', () => {
    const s = mk('a', T(0), null)
    const split = { boundaries: [T(0), T(1), T(5)], notes: ['a', 'b'] }
    expect(buildPayloads(s, split, T(1, MIN_SEGMENT_MS - 1))).toBeNull()
    expect(buildPayloads(s, split, T(1, MIN_SEGMENT_MS))).toHaveLength(2)
  })

  it('holds the closed segments of an open session to their boundaries', () => {
    const s = mk('a', T(0), null)
    const split = { boundaries: [T(0), T(0, 1000), T(1)], notes: ['a', 'b'] }
    expect(buildPayloads(s, split, T(4))).toBeNull()
  })
})

describe('singleSegmentTimesMatchSession', () => {
  const s = mk('a', T(0), T(2))

  it('is false for anything but one segment', () => {
    expect(singleSegmentTimesMatchSession(s, { boundaries: [T(0), T(1), T(2)], notes: ['a', 'b'] })).toBe(false)
    expect(singleSegmentTimesMatchSession(s, { boundaries: [T(0)], notes: [] })).toBe(false)
  })

  it('tolerates one second on either end, not more', () => {
    expect(singleSegmentTimesMatchSession(s, { boundaries: [T(0, 1000), T(2, -1000)], notes: ['a'] })).toBe(true)
    expect(singleSegmentTimesMatchSession(s, { boundaries: [T(0, 1001), T(2)], notes: ['a'] })).toBe(false)
    expect(singleSegmentTimesMatchSession(s, { boundaries: [T(0), T(2, 1001)], notes: ['a'] })).toBe(false)
  })

  it('compares only the start of an open session', () => {
    const open = mk('a', T(0), null)
    expect(singleSegmentTimesMatchSession(open, { boundaries: [T(0), T(7)], notes: ['a'] })).toBe(true)
    expect(singleSegmentTimesMatchSession(open, { boundaries: [T(1), T(7)], notes: ['a'] })).toBe(false)
  })
})

describe('stripJobBidForSegmentRpc', () => {
  it('keeps times and notes, drops job and bid', () => {
    const out = stripJobBidForSegmentRpc({
      clocked_in_at: iso(T(0)),
      clocked_out_at: null,
      notes: 'x',
      job_ledger_id: 'job-1',
      bid_id: 'bid-1',
    })
    expect(out).toEqual({ clocked_in_at: iso(T(0)), clocked_out_at: null, notes: 'x' })
    expect(Object.keys(out).sort()).toEqual(['clocked_in_at', 'clocked_out_at', 'notes'])
  })
})

describe('dayEditorClusterCanSave', () => {
  const punch = (id: string, a: number, b: number | null) => mk(id, a, b)
  const salary = (id: string, a: number, b: number | null, idx: number) =>
    mk(id, a, b, { origin: 'salary_schedule', salary_segment_index: idx })

  it('a single row saves when its payloads build', () => {
    const c = [punch('a', T(0), T(2))]
    expect(dayEditorClusterCanSave(c, { boundaries: [T(0), T(2)], notes: ['x'] }, T(9))).toBe(true)
    expect(dayEditorClusterCanSave(c, { boundaries: [T(0), T(2)], notes: [' '] }, T(9))).toBe(false)
  })

  it('rows that share origin and salary segment never need a partition', () => {
    const c = [punch('a', T(0), T(1)), punch('b', T(1), T(2))]
    // One segment squeezed to two minutes: a mixed cluster could not split this across its rows.
    const split = { boundaries: [T(0), T(0, 120_000)], notes: ['x'] }
    expect(dayEditorClusterCanSave(c, split, T(9))).toBe(true)
  })

  it('a mixed cluster merged to one segment saves only when every row keeps the minimum', () => {
    const c = [punch('a', T(0), T(1)), salary('b', T(1), T(2), 1)]
    expect(dayEditorClusterCanSave(c, { boundaries: [T(0), T(2)], notes: ['x'] }, T(9))).toBe(true)
    // Scaled onto 60 s, each row would get 30 s — under the 36 s minimum.
    expect(dayEditorClusterCanSave(c, { boundaries: [T(0), T(0, 60_000)], notes: ['x'] }, T(9))).toBe(false)
  })

  it('a mixed cluster left on its own row seams saves', () => {
    const c = [punch('a', T(0), T(1)), salary('b', T(1), T(2), 1)]
    expect(dayEditorClusterCanSave(c, { boundaries: [T(0), T(1), T(2)], notes: ['x', 'y'] }, T(9))).toBe(true)
  })

  it('a mixed cluster with fewer segments than rows saves when the boundaries sit on row seams', () => {
    const c = [punch('a', T(0), T(1)), punch('b', T(1), T(2)), salary('c', T(2), T(3), 2)]
    const onSeam = { boundaries: [T(0), T(2), T(3)], notes: ['x', 'y'] }
    const offSeam = { boundaries: [T(0), T(1.5), T(3)], notes: ['x', 'y'] }
    expect(dayEditorClusterCanSave(c, onSeam, T(9))).toBe(true)
    expect(dayEditorClusterCanSave(c, offSeam, T(9))).toBe(false)
  })
})
