import { describe, expect, it } from 'vitest'
import type { FleetOdometerEntry } from './vehicleFleet'
import { formatSpanDays, odometerHistoryRows, odometerPace, odometerRowCaption } from './vehicleOdometerHistory'

const e = (id: string, read_date: string, odometer_value: number, created_by: string | null = null, created_at: string | null = null): FleetOdometerEntry => ({ id, vehicle_id: 'v', read_date, odometer_value, created_by, created_at })
const names: Record<string, string> = { a: 'Abraham', m: 'Malachi' }
const nameById = (id: string | null | undefined) => (id ? names[id] ?? null : null)

describe('odometerHistoryRows', () => {
  it('newest first, deltas vs the previous reading, dips flagged, first marked', () => {
    const rows = odometerHistoryRows([e('1', '2026-05-10', 222450, 'a'), e('3', '2026-08-14', 229950, 'a'), e('2', '2026-05-18', 222330, 'm'), e('0', '2025-12-03', 211530)], nameById)
    expect(rows.map((r) => [r.readDate, r.kind, r.deltaMiles, r.deltaDays, r.byName])).toEqual([
      ['2026-08-14', 'gain', 7620, 88, 'Abraham'],
      ['2026-05-18', 'dip', -120, 8, 'Malachi'],
      ['2026-05-10', 'gain', 10920, 158, 'Abraham'],
      ['2025-12-03', 'first', null, null, null],
    ])
    expect(odometerRowCaption(rows[0]!)).toBe('+7,620 mi in 88 days')
    expect(odometerRowCaption(rows[1]!)).toBe('↓ 120 below the previous reading')
    expect(odometerRowCaption(rows[3]!)).toBe('first reading')
  })
  it('same-day ties order by created_at and read "same day"', () => {
    const rows = odometerHistoryRows([e('b', '2026-08-01', 100, null, '2026-08-01T10:00:00Z'), e('a', '2026-08-01', 90, null, '2026-08-01T09:00:00Z')], nameById)
    expect(rows[0]!.id).toBe('b')
    expect(odometerRowCaption(rows[0]!)).toBe('+10 mi same day')
  })
})

describe('odometerPace', () => {
  it('averages over the full span; recent window pace + trend', () => {
    const p = odometerPace([e('0', '2025-12-03', 211530), e('1', '2026-05-10', 222450), e('2', '2026-07-04', 226310), e('3', '2026-08-14', 229950)], '2026-08-23')
    expect(p.readings).toBe(4)
    expect(p.spanDays).toBe(254)
    expect(p.spanMiles).toBe(18420)
    expect(Math.round(p.perMonth!)).toBe(2207)
    expect(Math.round(p.perYear!)).toBe(26488)
    // window from 2026-05-25: Jul 4 → Aug 14 = 3,640 mi in 41 days
    expect(p.recentReadings).toBe(2)
    expect(Math.round(p.recentPerMonth!)).toBe(2702)
    expect(p.trend).toBe('faster')
  })
  it('needs two readings on different days with a non-negative span', () => {
    expect(odometerPace([e('0', '2026-08-01', 100)], '2026-08-23').perMonth).toBeNull()
    expect(odometerPace([e('0', '2026-08-01', 100), e('1', '2026-08-01', 120)], '2026-08-23').perMonth).toBeNull()
    expect(odometerPace([e('0', '2026-08-01', 100), e('1', '2026-08-10', 90)], '2026-08-23').perMonth).toBeNull()
    expect(odometerPace([], '2026-08-23')).toMatchObject({ readings: 0, perMonth: null, recentPerMonth: null, trend: null })
  })
  it('formatSpanDays picks days / months / years', () => {
    expect(formatSpanDays(12)).toBe('12 days')
    expect(formatSpanDays(254)).toBe('8.3 months')
    expect(formatSpanDays(800)).toBe('2.2 years')
  })
})
