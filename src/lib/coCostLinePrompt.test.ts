import { describe, expect, it } from 'vitest'
import { CO_CREDIT_LABEL_PREFIX, isCoCreditLine } from './coCostLinePrompt'

describe('isCoCreditLine', () => {
  it('negative stored price is always a credit line', () => {
    expect(isCoCreditLine('Delete hall lav', -39000)).toBe(true)
    expect(isCoCreditLine('', -1)).toBe(true)
  })

  it('the standing credit-label convention marks a credit line before a price is typed', () => {
    expect(isCoCreditLine(CO_CREDIT_LABEL_PREFIX, 0)).toBe(true)
    expect(isCoCreditLine('Credit — delete hall lav', 0)).toBe(true)
    expect(isCoCreditLine('credit for unused fixtures', 0)).toBe(true)
    expect(isCoCreditLine('  Credit — trim ', 0)).toBe(true)
  })

  it('added-work lines are not credit lines', () => {
    expect(isCoCreditLine('Deep cleaning of AC units', 0)).toBe(false)
    expect(isCoCreditLine('Deep cleaning of AC units', 198000)).toBe(false)
    expect(isCoCreditLine('', 0)).toBe(false)
    // "Credit" must be a whole leading word, not a substring elsewhere.
    expect(isCoCreditLine('Accredited backflow test', 0)).toBe(false)
    expect(isCoCreditLine('Apply credit application fee', 0)).toBe(false)
  })
})
