import { describe, expect, it } from 'vitest'

import {
  dollarsInputToCents,
  formatCentsAsDollars,
  placeSplitBillFeeLines,
  splitBillCardFeeRefusal,
  splitBillReturnedCheckFeeRefusal,
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
    expect(v).toEqual({ ok: true, partsCents: [200000, 300000], feeLinesByPart: [null, null] })
  })
  it('accepts up to 4 parts', () => {
    const v = validateSplitBillParts(500000, [100000, 100000, 100000])
    expect(v).toEqual({ ok: true, partsCents: [100000, 100000, 100000, 200000], feeLinesByPart: [null, null, null, null] })
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

describe('the bill’s fee lines on a split (punch list #105)', () => {
  const trip = { trip_charge: 'client_not_home', amount: 150 }
  const small = { description: 'Permit pull', amount: 30 }
  const card = { card_bill: 'cb-1', amount: 30, description: 'Credit card fee (3%)' }

  it('puts every fee line on the first part when it has room', () => {
    expect(placeSplitBillFeeLines([trip, small], [20000, 30000])).toEqual({ ok: true, byPart: [[trip, small], null] })
  })

  it('hands a fee larger than the first part to the next part with room', () => {
    expect(placeSplitBillFeeLines([trip], [10000, 5000, 20000])).toEqual({ ok: true, byPart: [null, null, [trip]] })
    expect(placeSplitBillFeeLines([trip, small], [15000, 5000])).toEqual({ ok: true, byPart: [[trip], [small]] })
  })

  it('refuses, in words, a fee no part has room for: no part holds more than its own amount', () => {
    const r = placeSplitBillFeeLines([{ trip_charge: 'site_not_ready', amount: 99 }], [5000, 5000])
    expect(r).toEqual({ ok: false, error: 'The $99.00 trip charge on this bill needs a part of at least $99.00.' })
  })

  it('carries nothing when the bill has no fee lines', () => {
    expect(placeSplitBillFeeLines(null, [100, 200])).toEqual({ ok: true, byPart: [null, null] })
    expect(placeSplitBillFeeLines([], [100, 200])).toEqual({ ok: true, byPart: [null, null] })
  })

  it('refuses a bill that carries a GC card fee, and nothing else', () => {
    expect(splitBillCardFeeRefusal([trip, card])).toMatch(/GC’s card fee, so it cannot be split/)
    expect(splitBillCardFeeRefusal([trip, small])).toBeNull()
    expect(splitBillCardFeeRefusal(null)).toBeNull()
  })

  it('refuses a bill that carries a returned check fee, which its case would take back on the delete (v2.5144)', () => {
    const fee = { case_id: 'cd000000-0000-0000-0000-00000000000d', amount: 30, description: 'Returned check fee' }
    expect(splitBillReturnedCheckFeeRefusal([trip, fee])).toBe('This bill carries a returned check fee, so it cannot be split. Splitting it would count the fee twice.')
    expect(splitBillReturnedCheckFeeRefusal([trip, small, card])).toBeNull()
    expect(splitBillReturnedCheckFeeRefusal([{ case_id: ' ', amount: 30 }])).toBeNull()
    expect(validateSplitBillParts(25000, [10000], [fee])).toMatchObject({ ok: false, fees: true, error: expect.stringMatching(/returned check fee/) })
  })

  it('validateSplitBillParts says both refusals as fee refusals, and hands back where each fee goes', () => {
    expect(validateSplitBillParts(25000, [10000], [card])).toMatchObject({ ok: false, fees: true })
    expect(validateSplitBillParts(14900, [6000], [{ trip_charge: 'site_not_ready', amount: 99 }])).toMatchObject({ ok: false, fees: true, error: expect.stringMatching(/\$99\.00 trip charge/) })
    expect(validateSplitBillParts(25000, [10000], [trip])).toEqual({ ok: true, partsCents: [10000, 15000], feeLinesByPart: [null, [trip]] })
  })
})
