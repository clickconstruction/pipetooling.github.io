import { describe, expect, it } from 'vitest'
import { signedCurrency, stripAddressZipState } from './reviewFormat'

describe('signedCurrency', () => {
  it('puts the sign before the dollar sign, with cents', () => {
    expect(signedCurrency(-244.16)).toBe('-$244.16')
    expect(signedCurrency(1234.5)).toBe('$1,234.50')
    expect(signedCurrency(0)).toBe('$0.00')
  })
})

describe('stripAddressZipState', () => {
  it('drops a trailing state and ZIP, and nothing else', () => {
    expect(stripAddressZipState('105 Dover Rd San Antonio, TX 78209')).toBe('105 Dover Rd San Antonio')
    expect(stripAddressZipState('105 Dover Rd, tx 78209-1234')).toBe('105 Dover Rd')
    expect(stripAddressZipState('105 Dover Rd San Antonio')).toBe('105 Dover Rd San Antonio')
    expect(stripAddressZipState('')).toBe('')
  })
})
