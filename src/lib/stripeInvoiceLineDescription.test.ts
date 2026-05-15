import { describe, expect, it } from 'vitest'
import {
  buildFixtureStripeLineDescriptionForStripe,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
} from './stripeInvoiceLineDescription'

describe('buildFixtureStripeLineDescriptionForStripe', () => {
  it('returns name only when scope is empty', () => {
    expect(buildFixtureStripeLineDescriptionForStripe('Water heater', null)).toBe('Water heater')
    expect(buildFixtureStripeLineDescriptionForStripe('Water heater', '   ')).toBe('Water heater')
  })

  it('joins trimmed name and scope with em dash', () => {
    expect(buildFixtureStripeLineDescriptionForStripe('HW', 'Including labor')).toBe('HW — Including labor')
  })

  it('returns Line item when both empty after trim', () => {
    expect(buildFixtureStripeLineDescriptionForStripe('', null)).toBe('Line item')
    expect(buildFixtureStripeLineDescriptionForStripe(' \n ', '')).toBe('Line item')
  })

  it('matches Edge when name empty but scope present (trim applies before clamp)', () => {
    expect(buildFixtureStripeLineDescriptionForStripe('', 'Scope only')).toBe('— Scope only')
  })

  it('truncates at STRIPE_INVOICE_LINE_DESCRIPTION_MAX', () => {
    const pad = 'a'.repeat(STRIPE_INVOICE_LINE_DESCRIPTION_MAX + 20)
    const out = buildFixtureStripeLineDescriptionForStripe(pad, null)
    expect(out.length).toBe(STRIPE_INVOICE_LINE_DESCRIPTION_MAX)
  })
})
