import { describe, expect, it } from 'vitest'

import {
  dollarsInputToCents,
  formatCentsAsDollars,
  splitBillIssuedAtMs,
  splitBillPartMemo,
  splitBillRemainderCents,
  validateSplitBillParts,
} from './splitBillParts'

describe('dollarsInputToCents', () => {
  it('parses plain, comma, and dollar-sign inputs', () => {
    expect(dollarsInputToCents('2500')).toBe(250000)
    expect(dollarsInputToCents('2,500.00')).toBe(250000)
    expect(dollarsInputToCents('$2,500.50')).toBe(250050)
    expect(dollarsInputToCents(' 0.50 ')).toBe(50)
  })
  it('returns null on blank or junk', () => {
    expect(dollarsInputToCents('')).toBeNull()
    expect(dollarsInputToCents('abc')).toBeNull()
    expect(dollarsInputToCents('.')).toBeNull()
  })
})

describe('splitBillRemainderCents', () => {
  it('fills the last part from the total', () => {
    expect(splitBillRemainderCents(500000, [250000])).toBe(250000)
    expect(splitBillRemainderCents(500000, [100000, 150000])).toBe(250000)
  })
  it('treats blank inputs as zero and can go negative on overshoot', () => {
    expect(splitBillRemainderCents(500000, [null])).toBe(500000)
    expect(splitBillRemainderCents(500000, [600000])).toBe(-100000)
  })
})

describe('validateSplitBillParts', () => {
  it('accepts a clean 2-way split and returns full parts', () => {
    const v = validateSplitBillParts(500000, [200000])
    expect(v).toEqual({ ok: true, partsCents: [200000, 300000] })
  })
  it('accepts up to 4 parts', () => {
    const v = validateSplitBillParts(500000, [100000, 100000, 100000])
    expect(v).toEqual({ ok: true, partsCents: [100000, 100000, 100000, 200000] })
  })
  it('rejects blank, sub-minimum, and overshooting parts', () => {
    expect(validateSplitBillParts(500000, [null])).toMatchObject({ ok: false })
    expect(validateSplitBillParts(500000, [10])).toMatchObject({ ok: false })
    expect(validateSplitBillParts(500000, [499990])).toMatchObject({ ok: false })
    expect(validateSplitBillParts(500000, [500000])).toMatchObject({ ok: false })
  })
  it('rejects too many parts and too-small totals', () => {
    expect(validateSplitBillParts(500000, [1, 1, 1, 1])).toMatchObject({ ok: false })
    expect(validateSplitBillParts(80, [50])).toMatchObject({ ok: false })
  })
})

describe('splitBillPartMemo', () => {
  it('suffixes an existing memo and stands alone without one', () => {
    expect(splitBillPartMemo('Septic install', 1, 2)).toBe('Septic install — part 1 of 2')
    expect(splitBillPartMemo(null, 2, 2)).toBe('Part 2 of 2')
    expect(splitBillPartMemo('  ', 1, 3)).toBe('Part 1 of 3')
  })
})

describe('splitBillIssuedAtMs', () => {
  it('staggers each part by one minute so Stripe numbers never collide', () => {
    const base = 1_700_000_000_000
    expect(splitBillIssuedAtMs(base, 0)).toBe(base)
    expect(splitBillIssuedAtMs(base, 1)).toBe(base + 60_000)
    expect(splitBillIssuedAtMs(base, 3)).toBe(base + 180_000)
  })
})

describe('formatCentsAsDollars', () => {
  it('renders with grouping and two decimals', () => {
    expect(formatCentsAsDollars(250050)).toBe('2,500.50')
    expect(formatCentsAsDollars(50)).toBe('0.50')
  })
})
