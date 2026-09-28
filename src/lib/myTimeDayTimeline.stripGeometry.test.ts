import { describe, expect, it } from 'vitest'
import {
  clampStripY,
  clusterStripRangeMs,
  stripDragYToMs,
  stripYToMs,
  type DayEditorSession,
} from './myTimeDayTimeline'

const H = 3_600_000
const T0 = Date.UTC(2026, 0, 5, 14, 0, 0)

function mk(id: string, inMs: number, outMs: number | null): DayEditorSession {
  return {
    id,
    clocked_in_at: new Date(inMs).toISOString(),
    clocked_out_at: outMs != null ? new Date(outMs).toISOString() : null,
    work_date: '2026-01-05',
    notes: 'n',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    origin: 'user_punch',
    salary_segment_index: null,
  }
}

describe('clusterStripRangeMs', () => {
  it('runs from the first clock-in to the last clock-out', () => {
    const c = [mk('a', T0, T0 + H), mk('b', T0 + H, T0 + 3 * H)]
    expect(clusterStripRangeMs(c, T0 + 9 * H)).toEqual({ t0: T0, t1: T0 + 3 * H })
  })

  it('runs to now while the last row is open', () => {
    const c = [mk('a', T0, T0 + H), mk('b', T0 + H, null)]
    expect(clusterStripRangeMs(c, T0 + 5 * H)).toEqual({ t0: T0, t1: T0 + 5 * H })
  })
})

describe('clampStripY', () => {
  it('holds Y inside the strip', () => {
    expect(clampStripY(-12, 200)).toBe(0)
    expect(clampStripY(80, 200)).toBe(80)
    expect(clampStripY(260, 200)).toBe(200)
  })

  it('a strip with no height holds every Y at 0', () => {
    expect(clampStripY(40, 0)).toBe(0)
  })
})

describe('stripYToMs', () => {
  const strip = { height: 200, t0: T0, t1: T0 + 4 * H }

  it('is linear from the top of the strip to the bottom', () => {
    expect(stripYToMs({ ...strip, y: 0 })).toBe(T0)
    expect(stripYToMs({ ...strip, y: 50 })).toBe(T0 + H)
    expect(stripYToMs({ ...strip, y: 200 })).toBe(T0 + 4 * H)
  })

  it('a pointer above or below the strip lands on its ends', () => {
    expect(stripYToMs({ ...strip, y: -30 })).toBe(T0)
    expect(stripYToMs({ ...strip, y: 900 })).toBe(T0 + 4 * H)
  })

  it('a strip with no height maps every Y to the start', () => {
    expect(stripYToMs({ ...strip, height: 0, y: 75 })).toBe(T0)
  })
})

describe('stripDragYToMs', () => {
  const strip = { height: 200, t0: T0, t1: T0 + 4 * H }
  // The boundary sits at 1 h = 50 px down the strip.
  const originMs = T0 + H

  it('a handle grabbed off-center does not jump: no travel, no move', () => {
    expect(stripDragYToMs({ ...strip, originMs, grabY: 57, y: 57 })).toBe(originMs)
  })

  it('moves the boundary by the pointer travel since the grab', () => {
    // 50 px of travel on a 200 px / 4 h strip is one hour.
    expect(stripDragYToMs({ ...strip, originMs, grabY: 57, y: 107 })).toBe(T0 + 2 * H)
    expect(stripDragYToMs({ ...strip, originMs, grabY: 57, y: 32 })).toBe(T0 + H / 2)
  })

  it('stops at the start of the strip', () => {
    expect(stripDragYToMs({ ...strip, originMs, grabY: 57, y: -400 })).toBe(T0)
  })

  it('the pointer is held to the strip before the travel is measured, so a handle grabbed 7 px low stops 7 px short of the end', () => {
    // Pointer far below a 200 px strip counts as 200: travel 143 from the boundary's 50 px is 193.
    expect(stripDragYToMs({ ...strip, originMs, grabY: 57, y: 900 })).toBe(T0 + (193 / 200) * 4 * H)
    // Grabbed 7 px high, the travel would carry it past the end; the result is held to the strip.
    expect(stripDragYToMs({ ...strip, originMs, grabY: 43, y: 900 })).toBe(T0 + 4 * H)
  })

  it('a strip with no height or no span maps to the start', () => {
    expect(stripDragYToMs({ ...strip, height: 0, originMs, grabY: 0, y: 40 })).toBe(T0)
    expect(stripDragYToMs({ ...strip, t1: T0, originMs: T0, grabY: 10, y: 90 })).toBe(T0)
  })
})
