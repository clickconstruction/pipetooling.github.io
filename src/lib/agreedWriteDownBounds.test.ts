import { describe, expect, it } from 'vitest'
import {
  agreedWriteDownNewTotalBounds,
  agreedWriteDownDiscountBounds,
  agreedWriteDownDisplayMaxNewTotal,
  resolveWriteDownNewTotalFromInputs,
  parseNewTotalInput,
  roundUsd2,
  WRITE_DOWN_NEW_TOTAL_EPS,
} from './agreedWriteDownBounds'

describe('agreedWriteDownNewTotalBounds', () => {
  it('returns min = paid, max = current when paid < current', () => {
    expect(agreedWriteDownNewTotalBounds(1650, 1505)).toEqual({ min: 1505, max: 1650 })
  })

  it('handles cents rounding', () => {
    expect(agreedWriteDownNewTotalBounds(10.005, 5)).toEqual({ min: 5, max: 10.01 })
  })

  it('swaps when paid > current (edge)', () => {
    expect(agreedWriteDownNewTotalBounds(100, 1000)).toEqual({ min: 100, max: 1000 })
  })
})

describe('agreedWriteDownDiscountBounds', () => {
  it('1650 / 1505: discount max matches max headroom (145)', () => {
    expect(agreedWriteDownDiscountBounds(1650, 1505)).toEqual({ min: 0.01, max: 145 })
  })

  it('min discount matches WRITE_DOWN_NEW_TOTAL_EPS rounding (half-cent to cent)', () => {
    const d = agreedWriteDownDiscountBounds(100, 0)
    expect(d.max).toBe(100)
    expect(d.min).toBe(roundUsd2(WRITE_DOWN_NEW_TOTAL_EPS))
  })

  it('returns zero range when no headroom between paid and billed', () => {
    expect(agreedWriteDownDiscountBounds(100, 100)).toEqual({ min: 0, max: 0 })
  })
})

describe('agreedWriteDownDisplayMaxNewTotal', () => {
  it('caps one cent below billed when room allows', () => {
    const b = agreedWriteDownNewTotalBounds(1650, 1505)
    expect(agreedWriteDownDisplayMaxNewTotal(b)).toBe(1649.99)
  })
})

describe('resolveWriteDownNewTotalFromInputs', () => {
  it('derives new total from discount', () => {
    const r = resolveWriteDownNewTotalFromInputs(1650, '145', '')
    expect(r).toEqual({ ok: true, newTotal: 1505, source: 'discount' })
  })

  it('passes through new total path', () => {
    const r = resolveWriteDownNewTotalFromInputs(1650, '', '1505')
    expect(r).toEqual({ ok: true, newTotal: 1505, source: 'total' })
  })

  it('rejects both filled', () => {
    const r = resolveWriteDownNewTotalFromInputs(1650, '1', '1505')
    expect(r.ok).toBe(false)
  })

  it('rejects neither filled', () => {
    const r = resolveWriteDownNewTotalFromInputs(1650, '', '')
    expect(r.ok).toBe(false)
  })
})

describe('parseNewTotalInput', () => {
  it('parses valid numbers', () => {
    expect(parseNewTotalInput('1505.5')).toBe(1505.5)
    expect(parseNewTotalInput(' 0.01 ')).toBe(0.01)
  })

  it('returns null for empty or invalid', () => {
    expect(parseNewTotalInput('')).toBeNull()
    expect(parseNewTotalInput('x')).toBeNull()
  })
})

describe('roundUsd2', () => {
  it('rounds to cents', () => {
    expect(roundUsd2(10.126)).toBe(10.13)
    expect(roundUsd2(10.124)).toBe(10.12)
  })
})
