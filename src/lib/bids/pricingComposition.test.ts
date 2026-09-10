import { describe, expect, it } from 'vitest'
import { buildPricingComposition, compositionHeadline, compositionKind } from './pricingComposition'

describe('compositionKind — the names on a real priced bid (b385 Galloway Park)', () => {
  it('fixtures', () => {
    for (const n of ['WC - 2 / Water Closet', 'LAV - 1 / Sink', 'GT -1 / Grease Interceptor', 'UR - 1 / Urinal', 'WS - 1 / Resin Tank & Brine Tank', 'SK - 1 / Sink', 'Toilets', 'Floor Drain', 'Water Heater 50 gal']) {
      expect(compositionKind(n), n).toBe('fixture')
    }
  })
  it('pipe needs a length unit', () => {
    for (const n of ['ft of 4" Sanitary Vent/Line', 'ft of 3/4" Water Line', 'ft of 1-1/2" Sanitary Vent/Line', 'ft of 3" PIPE WASTE', '2" Vent (LF)']) {
      expect(compositionKind(n), n).toBe('pipe')
    }
  })
  it('fittings: elbows, wyes with a size, valves, cleanouts', () => {
    for (const n of ['2" 90 (Water)', '4" 90 (Waste)', '3/4" 90 (Water)', '4" Y (Waste)', 'Ball Valve', 'BALL VALVE', 'SHUT OFF VALVE', 'WCO', '1" X 1/2" X 1/2" T WATER', '4" Waste · Tee/Wye', '2" coupling']) {
      expect(compositionKind(n), n).toBe('fitting')
    }
  })
  it('allowances and blanks are other', () => {
    for (const n of ['Material/Labor/Travel', 'Travel & Rentals (64 mi from office)', 'Permit allowance', 'Equipment rental', '']) {
      expect(compositionKind(n), n).toBe('other')
    }
  })
})

describe('buildPricingComposition', () => {
  const rows = [
    { id: 'a', name: 'WC - 2 / Water Closet', count: 8, cost: 15000, revenue: 26800 },
    { id: 'b', name: 'LAV - 1 / Sink', count: 6, cost: 11000, revenue: 20100 },
    { id: 'c', name: 'ft of 4" Sanitary Vent/Line', count: 549.67, cost: 9900, revenue: 13742 },
    { id: 'd', name: 'ft of 3/4" Water Line', count: 558.89, cost: 4800, revenue: 6707 },
    { id: 'e', name: '4" Y (Waste)', count: 46, cost: 1100, revenue: 2298 },
    { id: 'f', name: 'Ball Valve', count: 59, cost: 2900, revenue: 5900 },
    { id: 'g', name: 'Material/Labor/Travel', count: 1, cost: 0, revenue: 10000 },
    { id: 'h', name: 'ft of 2" Vent', count: 0, cost: 0, revenue: 0 }, // zero count: ignored
    { id: 'i', name: 'Floor Drain', count: 3, cost: 900, revenue: 0 }, // unpriced: counts, no revenue
  ]
  it('sums each bucket and its shares, ranks the top rows, keeps unpriced rows in the count', () => {
    const c = buildPricingComposition(rows)
    expect(c.totalRevenue).toBe(85547)
    expect(c.totalCost).toBe(45600)
    const by = Object.fromEntries(c.buckets.map((b) => [b.kind, b]))
    expect(by.fixture).toMatchObject({ rows: 3, count: 17, revenue: 46900, cost: 26900, profit: 20000 })
    expect(by.fixture?.margin).toBeCloseTo(20000 / 46900, 6)
    expect(by.fixture?.top.map((t) => t.id)).toEqual(['a', 'b', 'i'])
    expect(by.pipe).toMatchObject({ rows: 2, count: 1108.56, revenue: 20449 })
    expect(by.fitting).toMatchObject({ rows: 2, count: 105, revenue: 8198, cost: 4000 })
    // Revenue with no cost is not a 100% margin — it is an uncosted bucket.
    expect(by.other).toMatchObject({ rows: 1, revenue: 10000, cost: 0, margin: null })
    expect(by.fixture?.revenueShare).toBeCloseTo(46900 / 85547, 6)
    expect(by.pipe?.costShare).toBeCloseTo(14700 / 45600, 6)
    expect(c.buckets.map((b) => b.kind)).toEqual(['fixture', 'pipe', 'fitting', 'other'])
  })
  it('drops empty buckets and reads a headline in the estimator\'s units', () => {
    const c = buildPricingComposition(rows.slice(0, 4))
    expect(c.buckets.map((b) => b.kind)).toEqual(['fixture', 'pipe'])
    expect(compositionHeadline(c)).toBe('14 fixtures · 1,109 ft of pipe')
    expect(compositionHeadline(buildPricingComposition(rows))).toBe('17 fixtures · 1,109 ft of pipe · 105 fittings')
  })
  it('an unpriced bid has shares of zero and no margin', () => {
    const c = buildPricingComposition([{ name: 'WC - 1 / Water Closet', count: 2, cost: 0, revenue: 0 }])
    expect(c.buckets[0]).toMatchObject({ revenueShare: 0, costShare: 0, margin: null })
  })
})
