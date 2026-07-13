import { describe, expect, it } from 'vitest'
import {
  CLOCK_OVERLAP_WARNING_EPS_MS,
  hasPairwiseClockIntervalOverlap,
} from './myTimeDayTimeline'

const NOW = new Date('2026-07-13T22:00:00Z').getTime()
const T0 = new Date('2026-07-13T14:00:00Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()
const MIN = 60_000

function session(startMs: number, endMs: number) {
  return { clocked_in_at: iso(startMs), clocked_out_at: iso(endMs) }
}

describe('hasPairwiseClockIntervalOverlap warning epsilon', () => {
  it('bordering sessions never warn', () => {
    const rows = [session(T0, T0 + 60 * MIN), session(T0 + 60 * MIN, T0 + 120 * MIN)]
    expect(hasPairwiseClockIntervalOverlap(rows, NOW)).toBe(false)
    expect(hasPairwiseClockIntervalOverlap(rows, NOW, CLOCK_OVERLAP_WARNING_EPS_MS)).toBe(false)
  })

  it('sub-minute edit artifact: default eps flags it, warning eps does not', () => {
    // First session's end edited to a clean minute; neighbor's raw clock-in keeps 29s of seconds.
    const rows = [session(T0, T0 + 60 * MIN + 29_000), session(T0 + 60 * MIN, T0 + 120 * MIN)]
    expect(hasPairwiseClockIntervalOverlap(rows, NOW)).toBe(true)
    expect(hasPairwiseClockIntervalOverlap(rows, NOW, CLOCK_OVERLAP_WARNING_EPS_MS)).toBe(false)
  })

  it('overlap beyond a minute still warns', () => {
    const rows = [session(T0, T0 + 62 * MIN), session(T0 + 60 * MIN, T0 + 120 * MIN)]
    expect(hasPairwiseClockIntervalOverlap(rows, NOW, CLOCK_OVERLAP_WARNING_EPS_MS)).toBe(true)
  })

  it('open session overlapping a closed one still warns', () => {
    const rows = [
      { clocked_in_at: iso(T0), clocked_out_at: null },
      session(T0 + 10 * MIN, T0 + 30 * MIN),
    ]
    expect(hasPairwiseClockIntervalOverlap(rows, NOW, CLOCK_OVERLAP_WARNING_EPS_MS)).toBe(true)
  })
})
