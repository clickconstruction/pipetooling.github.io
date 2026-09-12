import { describe, expect, it } from 'vitest'
import { BASELINE_MIN_SAMPLE, baselineReading, baselineReadingWords, usableBaselineRates, type BaselineRate } from './bidBaselineRates'

const rate = (o: Partial<BaselineRate> & { job_id: string }): BaselineRate => ({ bid_id: null, kept_at: '2026-09-12T00:00:00Z', kept_on: 'billed', price_usd: 100_000, team_hours: 800, hours_per_thousand: 8, people_count: 3, grade: 'per_thousand', ...o })

describe('baselineReading', () => {
  it('reads the median hours per $1k over usable baselines and implies this bid’s hours', () => {
    const rates = [
      rate({ job_id: 'a', hours_per_thousand: '7.76', team_hours: 959, price_usd: '123600' }),
      rate({ job_id: 'b', hours_per_thousand: 6.5, team_hours: 19, price_usd: 2918 }),
      rate({ job_id: 'c', hours_per_thousand: 10.2, team_hours: 341, price_usd: 33500 }),
      rate({ job_id: 'd', hours_per_thousand: 1.2, team_hours: 6, price_usd: 5000 }), // under 8 h — a visit, not a job
      rate({ job_id: 'e', hours_per_thousand: null, team_hours: 100, price_usd: null }), // no price
      rate({ job_id: 'f', hours_per_thousand: 4.0, team_hours: 60, price_usd: 15000, kept_on: 'kept' }),
    ]
    expect(usableBaselineRates(rates)).toEqual([4, 6.5, 7.76, 10.2])
    const b = baselineReading(rates, 50_000) // similar = $12.5k–$200k: a ($123.6k), c ($33.5k), f ($15k) — three, enough
    expect(b).toMatchObject({ n: 3, billed: 2, scope: 'similar' })
    expect(b.medianHoursPerThousand).toBeCloseTo(7.76, 6)
    expect(baselineReadingWords(b, (h) => `${Math.round(h)} h`)).toBe('7.8 h per $1k (4.0–10.2 middle half) · 3 jobs of similar size · this bid ≈ 388 h')
    const wide = baselineReading(rates, 1_000) // similar = $250–$4k: only b — too few, so every usable job speaks
    expect(wide).toMatchObject({ n: 4, billed: 3, scope: 'all' })
    expect(wide.medianHoursPerThousand).toBeCloseTo((6.5 + 7.76) / 2, 6)
    expect(wide.impliedHours).toBeCloseTo(1 * 7.13, 6)
    expect(wide.p25).toBe(6.5)
    expect(wide.p75).toBe(10.2)
    expect(baselineReadingWords(wide, (h) => `${Math.round(h)} h`)).toBe('7.1 h per $1k (6.5–10.2 middle half) · 4 jobs, all sizes · this bid ≈ 7 h')
  })
  it('says so with none or too few', () => {
    expect(baselineReadingWords(baselineReading([], 1000), (h) => `${h}`)).toBe('no baselines yet — they are kept when jobs bill')
    const two = baselineReading([rate({ job_id: 'a' }), rate({ job_id: 'b', hours_per_thousand: 9 })], null)
    expect(two.n).toBe(2)
    expect(two.impliedHours).toBeNull()
    expect(baselineReadingWords(two, (h) => `${h}`)).toBe(`2 baselines so far · needs ${BASELINE_MIN_SAMPLE}`)
  })
})
