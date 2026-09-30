import { describe, expect, it } from 'vitest'
import { paidJobEmailSubject, paidJobEmailText, renderPaidJobEmailDetailed, renderPaidJobEmailSummary } from '../../supabase/functions/_shared/paidJobEmail'
import { samplePaidJobPayload } from './teamSampleEmails'

// The Paid job email's renderer (v2.4173 lift): the sample water heater job, billed and paid in full.
describe('paidJobEmail kernel', () => {
  const p = samplePaidJobPayload('2026-09-29')

  it('the subject names the job and the total', () => {
    expect(paidJobEmailSubject(p)).toBe('Paid in full — 1054 · Water heater replacement — $4,380.00')
  })

  it('the text opens with the job, the paid line and the customer', () => {
    const t = paidJobEmailText(p)
    expect(t.startsWith('1054 Water heater replacement\nPAID IN FULL\n')).toBe(true)
    expect(t).toContain('Paid $4,380.00 — Monday, Sep 28, 2026')
    expect(t).toContain('Customer: Sam Sample')
  })

  it('the detailed HTML carries the line items, the crew, the parts and the invoice', () => {
    const h = renderPaidJobEmailDetailed(p)
    expect(h).toContain('50-gal gas water heater')
    expect(h).toContain('Expansion tank')
    expect(h).toContain('Ana Lead')
    expect(h).toContain('Max Helper')
    expect(h).toContain('Ferguson')
    expect(h).toContain('$4,380.00')
  })

  it('the summary is the shorter body', () => {
    const detailed = renderPaidJobEmailDetailed(p)
    const summary = renderPaidJobEmailSummary(p)
    expect(summary.length).toBeLessThan(detailed.length)
    expect(summary).toContain('Water heater replacement')
  })

  it('a manual note lands in both bodies', () => {
    expect(renderPaidJobEmailDetailed(p, 'Sent by hand from Billing')).toContain('Sent by hand from Billing')
    expect(renderPaidJobEmailSummary(p, 'Sent by hand from Billing')).toContain('Sent by hand from Billing')
  })
})
