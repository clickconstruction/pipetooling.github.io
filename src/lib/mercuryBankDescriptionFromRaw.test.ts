import { describe, expect, it } from 'vitest'
import { mercuryBankDescriptionFromRaw } from './mercuryBankDescriptionFromRaw'

describe('mercuryBankDescriptionFromRaw', () => {
  it('returns trimmed string when present', () => {
    expect(mercuryBankDescriptionFromRaw({ bankDescription: '  ACH Debit VENDOR ABC  ' })).toBe('ACH Debit VENDOR ABC')
  })

  it('returns null for empty trim', () => {
    expect(mercuryBankDescriptionFromRaw({ bankDescription: '   ' })).toBe(null)
    expect(mercuryBankDescriptionFromRaw({ bankDescription: '' })).toBe(null)
  })

  it('returns null when missing or wrong type', () => {
    expect(mercuryBankDescriptionFromRaw({})).toBe(null)
    expect(mercuryBankDescriptionFromRaw({ bankDescription: null })).toBe(null)
    expect(mercuryBankDescriptionFromRaw({ bankDescription: 1 })).toBe(null)
  })

  it('returns null for non-object raw', () => {
    expect(mercuryBankDescriptionFromRaw(null)).toBe(null)
    expect(mercuryBankDescriptionFromRaw([])).toBe(null)
    expect(mercuryBankDescriptionFromRaw('x')).toBe(null)
  })
})
