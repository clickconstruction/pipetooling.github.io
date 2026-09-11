import { describe, expect, it } from 'vitest'
import { BID_ESTIMATE_STATUS_WORDS, bidEstimateStatus, bidMatchValue, isWonOutcome, valueMatchForBid } from './bidBoardBudgetChips'

const row = (count: number, hrs: number, extra: Record<string, unknown> = {}) => ({ count, is_fixed: false, rough_in_hrs_per_unit: hrs, top_out_hrs_per_unit: 0, trim_set_hrs_per_unit: 0, ...extra })

describe('bidEstimateStatus', () => {
  it('costed with hours and a rate, hours only without a rate, none otherwise', () => {
    expect(bidEstimateStatus({ labor_rate: 35, rows: [row(10, 1), row(729.5, 4, { unit: 'per_100ft' })] })).toEqual({ kind: 'costed', hours: 10 + 29.18, rateSet: true })
    expect(bidEstimateStatus({ labor_rate: null, rows: [row(10, 1)] })).toEqual({ kind: 'hours_only', hours: 10, rateSet: false })
    expect(bidEstimateStatus({ labor_rate: 35, rows: [row(10, 0)] })).toEqual({ kind: 'none', hours: 0, rateSet: true })
    expect(bidEstimateStatus(null)).toEqual({ kind: 'none', hours: 0, rateSet: false })
  })
  it('has words for each', () => {
    expect(BID_ESTIMATE_STATUS_WORDS.costed(47.4)).toBe('costed · 47 h')
    expect(BID_ESTIMATE_STATUS_WORDS.hours_only(36)).toBe('hours only · 36 h')
    expect(BID_ESTIMATE_STATUS_WORDS.none(0)).toBe('no cost estimate')
  })
})

describe('the value match', () => {
  const jobs = [
    { jobId: 'j1007', hcpNumber: '1007', revenue: 249_715.66 },
    { jobId: 'j523', hcpNumber: '523', revenue: 123_600 },
  ]
  it('agreed value wins over bid value; a job within a dollar matches; nothing else does', () => {
    expect(bidMatchValue({ bid_value: 249_715.66, agreed_value: null })).toBe(249_715.66)
    expect(bidMatchValue({ bid_value: 30_000, agreed_value: 31_400 })).toBe(31_400)
    expect(bidMatchValue({ bid_value: null, agreed_value: null })).toBeNull()
    expect(valueMatchForBid({ bid_value: '249715.66', agreed_value: null }, jobs)?.jobId).toBe('j1007')
    expect(valueMatchForBid({ bid_value: 123_600.4, agreed_value: null }, jobs)?.jobId).toBe('j523')
    expect(valueMatchForBid({ bid_value: 32_600, agreed_value: null }, jobs)).toBeNull()
  })
  it('won and started_or_complete are the won outcomes', () => {
    expect(isWonOutcome('won')).toBe(true)
    expect(isWonOutcome('started_or_complete')).toBe(true)
    expect(isWonOutcome('lost')).toBe(false)
    expect(isWonOutcome(null)).toBe(false)
  })
})
