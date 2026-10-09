import { describe, expect, it } from 'vitest'
import { crewRateFromLedgerDays, crewRateWords, effectiveLaborRate, fleetTruckRateWords, parseFleetTruckRate } from './crewRate'

const day = (ymd: string, fieldHours: number, fieldLaborUsd: number, poolUsd: number) => ({ ymd, fieldHours, fieldLaborUsd, poolUsd })
const days = [
  day('2026-06-01', 40, 1_100, 500), // before the window — ignored
  day('2026-06-14', 40, 1_200, 460),
  day('2026-07-20', 60, 1_740, 690),
  day('2026-09-10', 0, 0, 410), // office-only day: pool counts, no field hours
  day('2026-09-11', 20, 640, 0),
  day('2026-09-12', 8, 300, 0), // after the window — ignored
]

describe('crewRateFromLedgerDays', () => {
  it('averages the wage-priced field hours in the window and applies the burden; lens A is the pool over the same hours', () => {
    const r = crewRateFromLedgerDays(days, { fromYmd: '2026-06-13', toYmd: '2026-09-11', burden: 1.2 })
    expect(r.fieldHours).toBe(120)
    expect(r.avgFieldWage).toBeCloseTo(3_580 / 120, 6) // 29.83
    expect(r.companyRate).toBeCloseTo((3_580 / 120) * 1.2, 6) // 35.80
    expect(r.overheadPerFieldHour).toBeCloseTo(1_560 / 120, 6) // 13.00
    expect(r.burden).toBe(1.2)
  })
  it('is null (not zero) without field hours, and a burden under 1 reads as 1', () => {
    const r = crewRateFromLedgerDays(days, { fromYmd: '2026-09-10', toYmd: '2026-09-10', burden: 0.5 })
    expect(r.avgFieldWage).toBeNull()
    expect(r.companyRate).toBeNull()
    expect(r.overheadPerFieldHour).toBeNull()
    expect(r.burden).toBe(1)
  })
})

describe('effectiveLaborRate', () => {
  it('the bid\'s own box wins, then the company rate, then nothing', () => {
    expect(effectiveLaborRate({ override: 35, companyRate: 35.8 })).toEqual({ rate: 35, source: 'override' })
    expect(effectiveLaborRate({ override: null, companyRate: 35.8 })).toEqual({ rate: 35.8, source: 'company' })
    expect(effectiveLaborRate({ override: 0, companyRate: 35.8 })).toEqual({ rate: 35.8, source: 'company' })
    expect(effectiveLaborRate({ override: null, companyRate: null })).toEqual({ rate: null, source: 'none' })
  })
})

describe('crewRateWords', () => {
  const fmt = (n: number) => n.toFixed(2)
  it('spells the arithmetic', () => {
    const r = crewRateFromLedgerDays(days, { fromYmd: '2026-06-13', toYmd: '2026-09-11', burden: 1.2 })
    expect(crewRateWords(r, fmt)).toBe('$29.83 avg recorded field wage (90 d, 120 h) × 1.20 burden')
  })
  it('says when there is nothing to average', () => {
    expect(crewRateWords(crewRateFromLedgerDays([], { fromYmd: 'a', toYmd: 'b', burden: 1.2 }), fmt)).toBe('no recorded field hours in the last 90 days')
  })
})

describe('the trucks per field hour (Wheels PR 3, v2.5039)', () => {
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  it('reads the server\'s jsonb, numeric strings included', () => {
    expect(parseFleetTruckRate({ rate: 235.09, fixed_usd: 4231.6, field_hours: 18, trucks: 4, days: 90 })).toEqual({ rate: 235.09, fixedUsd: 4231.6, fieldHours: 18, trucks: 4, days: 90 })
    expect(parseFleetTruckRate({ rate: '2.50', fixed_usd: '2996.28', field_hours: '1200.0', trucks: 13, days: 90 })).toEqual({ rate: 2.5, fixedUsd: 2996.28, fieldHours: 1200, trucks: 13, days: 90 })
  })
  it('no field hours: no rate, the totals kept', () => {
    expect(parseFleetTruckRate({ rate: null, fixed_usd: 109.29, field_hours: 0, trucks: 4, days: 90 })).toEqual({ rate: null, fixedUsd: 109.29, fieldHours: 0, trucks: 4, days: 90 })
  })
  it('anything malformed reads as nothing, so the card shows no truck line', () => {
    expect(parseFleetTruckRate(null)).toBeNull()
    expect(parseFleetTruckRate([1])).toBeNull()
    expect(parseFleetTruckRate('235.09')).toBeNull()
    expect(parseFleetTruckRate({ rate: 2.5, fixed_usd: 'lots', field_hours: 10, trucks: 1, days: 90 })).toBeNull()
    expect(parseFleetTruckRate({ rate: 2.5, fixed_usd: 25, field_hours: 10, days: 90 })).toBeNull()
    expect(parseFleetTruckRate({ rate: -1, fixed_usd: 25, field_hours: 10, trucks: 1, days: 90 })!.rate).toBeNull()
  })
  it('spells the arithmetic, one truck or many', () => {
    expect(fleetTruckRateWords({ rate: 235.09, fixedUsd: 4231.6, fieldHours: 18, trucks: 4, days: 90 }, fmt)).toBe('$4,231.60 insurance, registration, service and wear on 4 trucks ÷ 18 field h (90 d)')
    expect(fleetTruckRateWords({ rate: 2.5, fixedUsd: 2996.28, fieldHours: 1199.6, trucks: 1, days: 90 }, fmt)).toBe('$2,996.28 insurance, registration, service and wear on 1 truck ÷ 1,200 field h (90 d)')
    expect(fleetTruckRateWords({ rate: null, fixedUsd: 109.29, fieldHours: 0, trucks: 4, days: 90 }, fmt)).toBe('no recorded field hours in the last 90 days')
  })
})
