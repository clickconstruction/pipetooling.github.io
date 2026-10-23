import { describe, expect, it } from 'vitest'
import { paysInTitle, paysInWords } from './customerRowPaysIn'
import { paySpeedSpread } from '../jobs/paymentReliability'

const receipts = (...gaps: number[]) => gaps.map((gapDays, i) => ({ billedYmd: '2026-01-01', paidYmd: '2026-02-01', gapDays, jobId: `j${i}`, jobName: null, address: null }))

describe('paysInWords', () => {
  it('reads lowercase, as a range or a single figure', () => {
    // Four samples read as the 25th–75th percentiles: 17 and 35 here.
    expect(paysInWords(paySpeedSpread(receipts(9, 20, 33, 41)))).toBe('pays in 17–35d')
    expect(paysInWords(paySpeedSpread(receipts(30)))).toBe('pays in ~30d')
  })
  it('says nothing with no history', () => {
    expect(paysInWords(paySpeedSpread([]))).toBeNull()
    expect(paysInWords(null)).toBeNull()
  })
})

describe('paysInTitle', () => {
  it('says where the number comes from, with the count', () => {
    expect(paysInTitle(paySpeedSpread(receipts(30)))).toBe("Typical days from a bill to its payment, from 1 payment in the last 12 months. The Pipeline's expected pay dates use the same figure.")
    expect(paysInTitle(paySpeedSpread(receipts(9, 41)))).toContain('from 2 payments')
    expect(paysInTitle(null)).toBeNull()
  })
})
