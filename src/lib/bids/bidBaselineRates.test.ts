import { describe, expect, it } from 'vitest'
import { BASELINE_MIN_SAMPLE, BASELINE_SIZE_BANDS, baselineReading, baselineReadingWords, baselineSizeBandOf, usableBaselineRates, type BaselineRate } from './bidBaselineRates'

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
    expect(b).toMatchObject({ n: 3, billed: 2, scope: 'similar', band: '$10k–$100k', total: 4 })
    expect(b.medianHoursPerThousand).toBeCloseTo(7.76, 6)
    expect(baselineReadingWords(b, (h) => `${Math.round(h)} h`)).toBe('7.8 h per $1k (4.0–10.2 middle half) · 3 jobs of similar size · this bid ≈ 388 h')
    // similar = $250–$4k: only b. The book never reads every size (the owner's call of 2026-11-09): the window widens to
    // the under-$10k band, which still holds only b, so the book says so instead of pricing a $1k job off a $124k build.
    const thin = baselineReading(rates, 1_000)
    expect(thin).toMatchObject({ n: 1, billed: 1, scope: 'band', band: 'under $10k', total: 4 })
    expect(baselineReadingWords(thin, (h) => `${Math.round(h)} h`)).toBe('1 baseline in the under $10k band so far · needs 3 · 4 in the book, none read across sizes')
  })
  it('widens to the whole size band when fewer than three similar jobs exist, and names the band', () => {
    // A $500k bid: similar = $125k–$2M holds g alone. Its band, $100k–$1M, adds a ($123.6k) and h ($110k) — three.
    const rates = [
      rate({ job_id: 'a', hours_per_thousand: 7.76, team_hours: 959, price_usd: 123_600 }),
      rate({ job_id: 'g', hours_per_thousand: 5.0, team_hours: 2_500, price_usd: 500_000 }),
      rate({ job_id: 'h', hours_per_thousand: 6.0, team_hours: 660, price_usd: 110_000 }),
      rate({ job_id: 'c', hours_per_thousand: 10.2, team_hours: 341, price_usd: 33_500 }), // $10k–$100k: another band, not read
      rate({ job_id: 'b', hours_per_thousand: 6.5, team_hours: 19, price_usd: 2_918 }),
    ]
    const band = baselineReading(rates, 500_000)
    expect(band).toMatchObject({ n: 3, scope: 'band', band: '$100k–$1M', total: 5 })
    expect(band.medianHoursPerThousand).toBe(6.0)
    expect(band.impliedHours).toBeCloseTo(3_000, 6)
    expect(baselineReadingWords(band, (h) => `${Math.round(h).toLocaleString('en-US')} h`)).toBe('6.0 h per $1k (5.0–7.8 middle half) · 3 jobs in the $100k–$1M band · this bid ≈ 3,000 h')
    // The window still comes first: at $120k, a, h and c ($30k–$480k) are three similar jobs.
    expect(baselineReading(rates, 120_000)).toMatchObject({ n: 3, scope: 'similar', band: '$100k–$1M' })
    // Over $1M has no ceiling; a $2M job in an empty band reads nothing, never every size.
    expect(baselineReading(rates, 2_000_000)).toMatchObject({ n: 1, scope: 'band', band: 'over $1M' })
    expect(BASELINE_SIZE_BANDS.map((b) => b.label)).toEqual(['under $10k', '$10k–$100k', '$100k–$1M', 'over $1M'])
    expect(baselineSizeBandOf(9_999).label).toBe('under $10k')
    expect(baselineSizeBandOf(10_000).label).toBe('$10k–$100k')
    expect(baselineSizeBandOf(1_000_000).label).toBe('over $1M')
  })
  it('says so with none or too few', () => {
    expect(baselineReadingWords(baselineReading([], 1000), (h) => `${h}`)).toBe('no baselines yet — they are kept when jobs bill')
    const two = baselineReading([rate({ job_id: 'a' }), rate({ job_id: 'b', hours_per_thousand: 9 })], null)
    expect(two.n).toBe(2)
    expect(two.impliedHours).toBeNull()
    expect(baselineReadingWords(two, (h) => `${h}`)).toBe(`2 baselines so far · needs ${BASELINE_MIN_SAMPLE}`)
  })
})
