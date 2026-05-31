import { describe, expect, it } from 'vitest'
import { shouldOfferManualHoursSession } from './shouldOfferManualHoursSession'

const base = {
  hoursDecimal: 8,
  canAccessHours: true,
  canAccessPay: false,
  canEditHours: true,
  dayIsMarkedCorrect: false,
}

describe('shouldOfferManualHoursSession', () => {
  it('offers when positive hours, access, editable, and day not locked', () => {
    expect(shouldOfferManualHoursSession(base)).toBe(true)
  })

  it('does not offer for zero or negative hours', () => {
    expect(shouldOfferManualHoursSession({ ...base, hoursDecimal: 0 })).toBe(false)
    expect(shouldOfferManualHoursSession({ ...base, hoursDecimal: -1 })).toBe(false)
  })

  it('accepts pay access alone when hours access is absent', () => {
    expect(
      shouldOfferManualHoursSession({ ...base, canAccessHours: false, canAccessPay: true }),
    ).toBe(true)
  })

  it('does not offer without any hours or pay access', () => {
    expect(
      shouldOfferManualHoursSession({ ...base, canAccessHours: false, canAccessPay: false }),
    ).toBe(false)
  })

  it('does not offer for salary-only (non-editable) people', () => {
    expect(shouldOfferManualHoursSession({ ...base, canEditHours: false })).toBe(false)
  })

  it('does not offer on a day locked as Correct', () => {
    expect(shouldOfferManualHoursSession({ ...base, dayIsMarkedCorrect: true })).toBe(false)
  })
})
