import { describe, expect, it } from 'vitest'
import { arAllocationProgress, parseAllocationDollars } from './arAllocationProgress'

describe('parseAllocationDollars', () => {
  it('reads "1,855.70", ignores junk, and treats blanks as nothing', () => {
    expect(parseAllocationDollars('1,855.70')).toBe(1855.7)
    expect(parseAllocationDollars('$250')).toBe(250)
    expect(parseAllocationDollars('')).toBe(0)
    expect(parseAllocationDollars('abc')).toBe(0)
  })
})

describe('arAllocationProgress', () => {
  it('an untouched deposit: nothing allocated, everything remaining, the bar empty', () => {
    const p = arAllocationProgress({ amount: 1855.7, consumed: 0, remainingAvailable: 1855.7, lines: [{ amountStr: '' }] })
    expect(p).toEqual({ allocatedNow: 0, remainingAfter: 1855.7, pctFilled: 0, over: false })
  })
  it('lines on screen fill the bar and shrink what is left', () => {
    const p = arAllocationProgress({ amount: 4091.5, consumed: 0, remainingAvailable: 4091.5, lines: [{ amountStr: '2,711.50' }, { amountStr: '1,380.00' }] })
    expect(p.allocatedNow).toBe(4091.5)
    expect(p.remainingAfter).toBe(0)
    expect(p.pctFilled).toBe(1)
    expect(p.over).toBe(false)
  })
  it('money already applied to jobs counts toward the fill but not toward the lines', () => {
    const p = arAllocationProgress({ amount: 2918.22, consumed: 1518.22, remainingAvailable: 1400, lines: [{ amountStr: '400' }] })
    expect(p.allocatedNow).toBe(400)
    expect(p.remainingAfter).toBe(1000)
    expect(p.pctFilled).toBeCloseTo((1518.22 + 400) / 2918.22, 6)
  })
  it('over-allocation is flagged and the bar clamps at full', () => {
    const p = arAllocationProgress({ amount: 100, consumed: 0, remainingAvailable: 100, lines: [{ amountStr: '120' }] })
    expect(p.over).toBe(true)
    expect(p.remainingAfter).toBe(-20)
    expect(p.pctFilled).toBe(1)
  })
})
