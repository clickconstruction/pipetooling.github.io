import { describe, expect, it } from 'vitest'
import type { PayReceipt } from './billedExpectedPay'
import type { CustomerPromiseRecord } from './paymentPromises'
import { buildReliabilityLine, formatPaysIn, paySpeedSpread, reliabilityBars, slipAdjustedYmd } from './paymentReliability'

function receipt(gapDays: number, paidYmd = '2026-09-01'): PayReceipt {
  return { billedYmd: '2026-08-01', paidYmd, gapDays, jobId: null, jobName: null, address: null }
}

describe('paySpeedSpread', () => {
  it('needs two measurable payments', () => {
    expect(paySpeedSpread([])).toBeNull()
    expect(paySpeedSpread([receipt(30)])).toBeNull()
    expect(paySpeedSpread(null)).toBeNull()
  })
  it('uses min–max under four samples and the interquartile range from four', () => {
    expect(paySpeedSpread([receipt(41), receipt(9)])).toMatchObject({ loDays: 9, hiDays: 41, medianDays: 25, samples: 2 })
    // 5, 10, 20, 30, 40, 90 → p25 = 12.5, p75 = 37.5, median 25
    const s = paySpeedSpread([5, 10, 20, 30, 40, 90].map((g) => receipt(g)))!
    expect(s).toMatchObject({ loDays: 13, hiDays: 38, medianDays: 25, samples: 6 })
  })
  it('ignores negative or non-finite gaps', () => {
    expect(paySpeedSpread([receipt(-3), receipt(NaN), receipt(10), receipt(20)])).toMatchObject({ loDays: 10, hiDays: 20 })
  })
})

describe('formatPaysIn', () => {
  it('reads as a range, or ~N when the range collapses', () => {
    expect(formatPaysIn(paySpeedSpread([receipt(9), receipt(41)]))).toBe('Pays in 9–41d')
    expect(formatPaysIn(paySpeedSpread([receipt(30), receipt(30)]))).toBe('Pays in ~30d')
    expect(formatPaysIn(null)).toBeNull()
  })
})

describe('reliabilityBars', () => {
  it('shows the last six, oldest first, scaled to the tallest, toned against the median', () => {
    const receipts = [8, 60, 30, 12, 20, 25, 99].map((g, i) => receipt(g, `2026-09-0${i + 1}`)) // newest first
    const spread = paySpeedSpread(receipts)! // median of 7 = 25
    const bars = reliabilityBars(receipts, spread)
    expect(bars).toHaveLength(6)
    expect(bars.map((b) => b.gapDays)).toEqual([25, 20, 12, 30, 60, 8]) // the 99 is the 7th newest → dropped
    expect(bars[4]!.height).toBe(1)
    expect(bars.map((b) => b.tone)).toEqual(['fast', 'fast', 'fast', 'slow', 'late', 'fast'])
    expect(reliabilityBars([], null)).toEqual([])
  })
})

describe('buildReliabilityLine', () => {
  const record: CustomerPromiseRecord = { customerId: 'c', decided: 7, kept: 3, late: 2, broken: 2, open: 1, keptRate: 3 / 7, usualSlipDays: 9, rePromised: 1, openBroken: 1, lastPromisedYmd: '2026-09-12' }
  it('joins the spread and the record', () => {
    const line = buildReliabilityLine([receipt(9), receipt(41)], record)
    expect(line.text).toBe('Pays in 9–41d · keeps 3 of 7 · slips ~9d')
    expect(line.title).toMatch(/last 2 measurable payments/)
    expect(line.title).toMatch(/3 kept, 2 late, 2 broken, 1 open/)
  })
  it('spread only for a viewer who may not see the record, and empty when nothing is known', () => {
    expect(buildReliabilityLine([receipt(9), receipt(41)], null).text).toBe('Pays in 9–41d')
    const nothing = buildReliabilityLine([], null)
    expect(nothing.text).toBe('')
    expect(nothing.bars).toEqual([])
  })
  it('a record with only open promises says so without a kept line', () => {
    const open: CustomerPromiseRecord = { ...record, decided: 0, kept: 0, late: 0, broken: 0, open: 1, keptRate: null, usualSlipDays: null }
    const line = buildReliabilityLine([receipt(20), receipt(22)], open)
    expect(line.text).toBe('Pays in 20–22d')
    expect(line.title).toMatch(/1 promise open, none decided yet/)
  })
})

describe('slipAdjustedYmd', () => {
  it('moves a promise by the usual slip, never backwards', () => {
    expect(slipAdjustedYmd('2026-09-12', 9)).toBe('2026-09-21')
    expect(slipAdjustedYmd('2026-09-12', 8.6)).toBe('2026-09-21')
    expect(slipAdjustedYmd('2026-09-12', 0)).toBe('2026-09-12')
    expect(slipAdjustedYmd('2026-09-12', null)).toBe('2026-09-12')
    expect(slipAdjustedYmd('2026-09-12', -4)).toBe('2026-09-12')
    expect(slipAdjustedYmd('bad', 3)).toBe('bad')
  })
})
