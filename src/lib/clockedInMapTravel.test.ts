import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  computeTravelForStops,
  estimateStopTravel,
  fetchRoutedTravel,
  formatTravelLine,
  formatTravelMiles,
  formatTravelMinutes,
  readTravelMemo,
  resetTravelMemoForTests,
  travelMemoKey,
  travelSummaryLine,
} from './clockedInMapTravel'
import { haversineMeters, straightLineDriveMinutes, TRAVEL_ROAD_WINDING_FACTOR } from './jobTravelEstimate'

const OFFICE = { lat: 29.653, lng: -97.797 }
const VECCHIO = { lat: 29.88, lng: -97.94 }

beforeEach(() => resetTravelMemoForTests())

describe('formatting', () => {
  it('miles: under a mile, one decimal under ten, whole above', () => {
    expect(formatTravelMiles(800)).toBe('< 1 mi')
    expect(formatTravelMiles(1609.344 * 4.46)).toBe('4.5 mi')
    expect(formatTravelMiles(1609.344 * 5)).toBe('5 mi')
    expect(formatTravelMiles(1609.344 * 20.4)).toBe('20 mi')
    expect(formatTravelMiles(NaN)).toBe('—')
  })
  it('minutes: under an hour, hours and minutes, whole hours', () => {
    expect(formatTravelMinutes(32 * 60 + 20)).toBe('32 min')
    expect(formatTravelMinutes(72 * 60)).toBe('1 h 12 min')
    expect(formatTravelMinutes(7200)).toBe('2 h')
  })
  it('the line: routed plain, estimate marked, distance-only without minutes', () => {
    expect(formatTravelLine({ meters: 1609.344 * 20, seconds: 32 * 60, source: 'routed' })).toBe('20 mi · 32 min to the office')
    expect(formatTravelLine({ meters: 1609.344 * 26, seconds: 40 * 60, source: 'estimate' })).toBe('≈ 26 mi · ≈ 40 min to the office')
    expect(formatTravelLine({ meters: 1609.344 * 20, seconds: null, source: 'routed' })).toBe('20 mi to the office')
  })
})

describe('estimateStopTravel', () => {
  it('is straight line × 1.3 at 35 mph, marked estimate', () => {
    const t = estimateStopTravel(VECCHIO, OFFICE)
    const straight = haversineMeters(VECCHIO, OFFICE)
    expect(t.source).toBe('estimate')
    expect(t.meters).toBeCloseTo(straight * TRAVEL_ROAD_WINDING_FACTOR, 6)
    expect(t.seconds).toBe(straightLineDriveMinutes(straight) * 60)
    expect(t.seconds).toBeGreaterThan(30 * 60)
  })
})

describe('fetchRoutedTravel', () => {
  it('reads meters and seconds; distance-only keeps seconds null; refusals and throws are null', async () => {
    expect(await fetchRoutedTravel(VECCHIO, OFFICE, async () => ({ ok: true, meters: 32000, seconds: 1900.4 }))).toEqual({ meters: 32000, seconds: 1900, source: 'routed' })
    expect(await fetchRoutedTravel(VECCHIO, OFFICE, async () => ({ ok: true, meters: 32000 }))).toEqual({ meters: 32000, seconds: null, source: 'routed' })
    expect(await fetchRoutedTravel(VECCHIO, OFFICE, async () => ({ ok: false, error: 'no_key' }))).toBeNull()
    expect(await fetchRoutedTravel(VECCHIO, OFFICE, async () => null)).toBeNull()
    expect(
      await fetchRoutedTravel(VECCHIO, OFFICE, async () => {
        throw new Error('403')
      }),
    ).toBeNull()
  })
})

describe('computeTravelForStops', () => {
  const stops = [
    { id: 'job:1', addressKey: 'a', coords: VECCHIO },
    { id: 'job:2', addressKey: 'b', coords: { lat: 29.7, lng: -97.6 } },
    { id: 'job:3', addressKey: 'c', coords: { lat: 30.1, lng: -98.2 } },
  ]

  it('routes each stop once, estimates the ones the router refuses, and remembers routed answers only', async () => {
    // The stop is the origin and the office the destination — the drive *to* the office.
    const invoke = vi.fn(async (b: { origin: { lat: number }; destination: { lat: number } }) => {
      expect(b.destination).toEqual(OFFICE)
      return b.origin.lat === 29.7 ? { ok: false as const, error: 'no_route' } : { ok: true as const, meters: 30000, seconds: 1800 }
    })
    const first = await computeTravelForStops(stops, OFFICE, invoke as never)
    expect(invoke).toHaveBeenCalledTimes(3)
    expect(first.get('job:1')).toEqual({ meters: 30000, seconds: 1800, source: 'routed' })
    expect(first.get('job:2')?.source).toBe('estimate')
    expect(readTravelMemo(travelMemoKey('a', OFFICE))).toBeTruthy()
    expect(readTravelMemo(travelMemoKey('b', OFFICE))).toBeUndefined()

    const second = await computeTravelForStops(stops, OFFICE, invoke as never)
    // Two memo hits; only the estimated one is asked again.
    expect(invoke).toHaveBeenCalledTimes(4)
    expect(second.get('job:3')).toEqual(first.get('job:3'))
  })

  it('a moved office is a fresh key', async () => {
    const invoke = vi.fn(async () => ({ ok: true as const, meters: 1000, seconds: 60 }))
    await computeTravelForStops([stops[0]!], OFFICE, invoke as never)
    await computeTravelForStops([stops[0]!], { lat: 30, lng: -98 }, invoke as never)
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('caps concurrency and handles an empty list', async () => {
    let inFlight = 0
    let peak = 0
    const invoke = vi.fn(async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight -= 1
      return { ok: true as const, meters: 1000, seconds: 60 }
    })
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, addressKey: `k${i}`, coords: VECCHIO }))
    const out = await computeTravelForStops(many, OFFICE, invoke as never, 3)
    expect(out.size).toBe(9)
    expect(peak).toBeLessThanOrEqual(3)
    expect((await computeTravelForStops([], OFFICE, invoke as never)).size).toBe(0)
  })
})

describe('travelSummaryLine', () => {
  it('counts routed and estimated, names the estimate rule, null when empty', () => {
    expect(travelSummaryLine(new Map())).toBeNull()
    const m = new Map([
      ['a', { meters: 1, seconds: 1, source: 'routed' as const }],
      ['b', { meters: 1, seconds: 1, source: 'routed' as const }],
      ['c', { meters: 1, seconds: 1, source: 'estimate' as const }],
    ])
    expect(travelSummaryLine(m)).toBe('Drive times: 2 routed · 1 estimated (≈ straight line × 1.3 at 35 mph)')
    expect(travelSummaryLine(new Map([['a', { meters: 1, seconds: 1, source: 'routed' as const }]]))).toBe('Drive times: 1 routed')
  })
})
