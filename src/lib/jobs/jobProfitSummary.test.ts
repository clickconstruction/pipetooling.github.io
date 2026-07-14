import { describe, expect, it } from 'vitest'
import { buildJobProfitSummary, laborJobMatchesHcp } from './jobProfitSummary'

describe('laborJobMatchesHcp', () => {
  it('matches ignoring case and surrounding whitespace', () => {
    expect(laborJobMatchesHcp(' 880 ', '880')).toBe(true)
    expect(laborJobMatchesHcp('HCP-42', ' hcp-42 ')).toBe(true)
  })

  it('rejects different numbers', () => {
    expect(laborJobMatchesHcp('880', '881')).toBe(false)
  })

  it('never matches a blank HCP', () => {
    expect(laborJobMatchesHcp('', '')).toBe(false)
    expect(laborJobMatchesHcp(null, null)).toBe(false)
    expect(laborJobMatchesHcp('880', '   ')).toBe(false)
  })

  it('rejects a blank book number against a real HCP', () => {
    expect(laborJobMatchesHcp(null, '880')).toBe(false)
    expect(laborJobMatchesHcp('  ', '880')).toBe(false)
  })
})

describe('buildJobProfitSummary', () => {
  it('computes profit as revenue minus parts minus labor', () => {
    const s = buildJobProfitSummary({
      revenue: 1000,
      tallyPartsTotal: 250,
      laborJobs: [{ labor_rate: 50, items: [{ count: 2, hrs_per_unit: 1 }] }],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(s.totalBill).toBe(1000)
    expect(s.partsCost).toBe(250)
    expect(s.laborCost).toBe(100)
    expect(s.profit).toBe(650)
  })

  it('sums labor across multiple books including drive cost', () => {
    const s = buildJobProfitSummary({
      revenue: 0,
      tallyPartsTotal: 0,
      laborJobs: [
        { labor_rate: 50, items: [{ is_fixed: true, hrs_per_unit: 2 }] },
        // 10 mi drive: 10 × 0.7 + 10 × 0.02 × 100 = 27
        { labor_rate: 100, distance_miles: 10 },
      ],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(s.laborCost).toBe(100 + 27)
    expect(s.profit).toBe(-127)
  })

  it('treats null revenue as $0 and can go negative', () => {
    const s = buildJobProfitSummary({
      revenue: null,
      tallyPartsTotal: 40,
      laborJobs: [],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(s.totalBill).toBe(0)
    expect(s.profit).toBe(-40)
  })
})
