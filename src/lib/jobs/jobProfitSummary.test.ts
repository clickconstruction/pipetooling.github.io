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
      supplyInvoiceTotal: 0,
      cardChargesTotal: 0,
      tallyPartsTotal: 250,
      otherChargesTotal: 0,
      laborJobs: [{ labor_rate: 50, items: [{ count: 2, hrs_per_unit: 1 }] }],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(s.totalBill).toBe(1000)
    expect(s.partsCost).toBe(250)
    expect(s.laborCost).toBe(100)
    expect(s.profit).toBe(650)
  })

  it('parts cost sums all four buckets, not just the tally (v2.1801)', () => {
    // The screenshot bug: $677.55 of supply house invoices, $0 tally — the
    // old tally-only math reported profit $1,638 while the Cost Timeline an
    // inch above showed the real cost.
    const s = buildJobProfitSummary({
      revenue: 1638,
      supplyInvoiceTotal: 677.55,
      cardChargesTotal: 0,
      tallyPartsTotal: 0,
      otherChargesTotal: 0,
      laborJobs: [],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(s.partsCost).toBe(677.55)
    expect(s.profit).toBeCloseTo(960.45, 2)
    const all = buildJobProfitSummary({
      revenue: 1000,
      supplyInvoiceTotal: 100,
      cardChargesTotal: 50,
      tallyPartsTotal: 25,
      otherChargesTotal: 10,
      laborJobs: [],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(all.partsCost).toBe(185)
    expect(all.profit).toBe(815)
  })

  it('sums labor across multiple books including drive cost', () => {
    const s = buildJobProfitSummary({
      revenue: 0,
      supplyInvoiceTotal: 0,
      cardChargesTotal: 0,
      tallyPartsTotal: 0,
      otherChargesTotal: 0,
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
      supplyInvoiceTotal: 0,
      cardChargesTotal: 0,
      tallyPartsTotal: 40,
      otherChargesTotal: 0,
      laborJobs: [],
      mileageCost: 0.7,
      timePerMile: 0.02,
    })
    expect(s.totalBill).toBe(0)
    expect(s.profit).toBe(-40)
  })
})
