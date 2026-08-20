import { describe, expect, it } from 'vitest'
import { computeProfitSplit, parsePartnerSplitPreview } from './splitPreview'

describe('computeProfitSplit', () => {
  it('matches the contract worked example ($2,695 · 22% · 50%)', () => {
    const s = computeProfitSplit(2695, 22, 50)
    expect(s.companyFirst).toBe(592.9)
    expect(s.remainder).toBe(2102.1)
    expect(s.partnerShare).toBe(1051.05)
    expect(s.companyShare).toBe(1051.05)
  })

  it('rounds at each step and conserves the total', () => {
    const s = computeProfitSplit(1000.01, 22, 50)
    expect(s.companyFirst + s.partnerShare + s.companyShare).toBeCloseTo(1000.01, 2)
  })

  it('handles a losing job (negative profit)', () => {
    const s = computeProfitSplit(-500, 22, 50)
    expect(s.companyFirst).toBe(-110)
    expect(s.partnerShare).toBe(-195)
  })
})

describe('parsePartnerSplitPreview', () => {
  it('parses an existing preview with a posting', () => {
    const p = parsePartnerSplitPreview({
      exists: true,
      partnership_id: 'pp',
      partner_name: 'Bryan',
      profit_shares_on: true,
      confirmed_at: '2026-08-14',
      revenue: 8400,
      labor: 2100,
      materials: 2870,
      direct: 735,
      profit: 2695,
      company_first_pct: 22,
      partner_remainder_pct: 50,
      company_first: 592.9,
      remainder: 2102.1,
      partner_share: 1051.05,
      company_share: 1051.05,
      posted: { offset_id: 'o1', amount: 1051.05, posted_at: '2026-08-14', reversed: false },
    })
    expect(p?.exists).toBe(true)
    expect(p?.partner_share).toBe(1051.05)
    expect(p?.posted?.offset_id).toBe('o1')
  })

  it('carries the reason for non-flagged jobs and rejects garbage', () => {
    expect(parsePartnerSplitPreview({ exists: false, reason: 'no partner majority flag on this job' })?.reason).toContain('majority')
    expect(parsePartnerSplitPreview(null)).toBeNull()
    expect(parsePartnerSplitPreview([1])).toBeNull()
  })
})
