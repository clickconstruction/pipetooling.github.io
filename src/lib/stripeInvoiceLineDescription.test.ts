import { describe, expect, it } from 'vitest'
import {
  buildFixtureStripeLineDescriptionForStripe,
  DEFAULT_STRIPE_INVOICE_LINE_DESCRIPTION,
  defaultStripeLineDescriptionFromJob,
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

describe('defaultStripeLineDescriptionFromJob', () => {
  const job = { id: 'job-1', master_user_id: 'u-1', hcp_number: '978', job_name: 'Penmoor demo', customer_id: 'cust-1', customer_name: 'Kestrin Contracting', customer_email: 'ap@kestrin.test' }

  it('is the fixed default line, whatever the job says (the legacy builder ignores its three arguments)', () => {
    expect(defaultStripeLineDescriptionFromJob(job)).toBe(DEFAULT_STRIPE_INVOICE_LINE_DESCRIPTION)
    expect(defaultStripeLineDescriptionFromJob(job)).toBe('Custom service.')
  })

  it('reads a job with no customer name, job name or number the same way', () => {
    expect(defaultStripeLineDescriptionFromJob({ ...job, customer_name: null, job_name: null, hcp_number: null })).toBe('Custom service.')
    expect(defaultStripeLineDescriptionFromJob({ ...job, customer_name: '   ' })).toBe('Custom service.')
  })
})
