import { describe, expect, it } from 'vitest'
import { buildStripeInvoiceEmailBody, buildStripeInvoiceEmailSubject, buildStripeInvoiceSmsText } from './stripeInvoiceShareCopy'

const input = { customerName: ' Pat ', payUrl: ' https://pay.example/inv_1 ', amountLabel: '$1,250.00', jobName: ' Smith residence ', hcpNumber: ' 878 ' }

describe('stripeInvoiceShareCopy', () => {
  it('subject names the job or falls back', () => {
    expect(buildStripeInvoiceEmailSubject(' Smith residence ')).toBe('Invoice — Smith residence')
    expect(buildStripeInvoiceEmailSubject('')).toBe('Invoice — Your invoice')
    expect(buildStripeInvoiceEmailSubject(null)).toBe('Invoice — Your invoice')
  })
  it('email body greets by name with the trimmed link, amount, job and HCP number', () => {
    expect(buildStripeInvoiceEmailBody(input)).toBe(`Hi Pat,

Please view and pay your invoice here:
https://pay.example/inv_1

Amount: $1,250.00
Job: Smith residence (HCP 878)

Thank you!`)
  })
  it('email body falls back to "there" and dashes', () => {
    const body = buildStripeInvoiceEmailBody({ ...input, customerName: null, jobName: null, hcpNumber: '' })
    expect(body.startsWith('Hi there,')).toBe(true)
    expect(body).toContain('Job: — (HCP —)')
  })
  it('SMS text is the Billed line without its opening, the link last, with the job or a generic fallback (v2.6771)', () => {
    expect(buildStripeInvoiceSmsText(input)).toBe('Your bill for Smith residence is ready, $1,250.00. Pay it here: https://pay.example/inv_1')
    expect(buildStripeInvoiceSmsText({ ...input, jobName: '  ' })).toBe('Your bill for your job is ready, $1,250.00. Pay it here: https://pay.example/inv_1')
  })
})
