import { describe, expect, it } from 'vitest'
import { COMPANY_EMAIL_FROM_LABEL, CUSTOMER_EMAIL_FROM_ADDRESS, estimateEmailFrom } from './customerEmailFrom'
import { EMAIL_FROM_FALLBACK_ADDRESS } from '../../supabase/functions/_shared/emailFromAddress'

describe('customerEmailFrom (what the client can say about the From line)', () => {
  it('mirrors the address the senders fall back to', () => {
    expect(CUSTOMER_EMAIL_FROM_ADDRESS).toBe(EMAIL_FROM_FALLBACK_ADDRESS)
  })
  it('the company label is the company name on that address', () => {
    expect(COMPANY_EMAIL_FROM_LABEL).toBe('Click Plumbing and Electrical <team@noreply.clicktooling.com>')
  })
  it('the estimate From follows the brand', () => {
    expect(estimateEmailFrom('plum')).toBe('Click Plumbing <team@noreply.clicktooling.com>')
    expect(estimateEmailFrom('elec')).toBe('Click Electrical <team@noreply.clicktooling.com>')
    expect(estimateEmailFrom(null)).toBe('Click Plumbing and Electrical <team@noreply.clicktooling.com>')
  })
})
