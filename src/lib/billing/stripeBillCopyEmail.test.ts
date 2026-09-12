import { describe, expect, it } from 'vitest'
import { buildStripeBillCopyEmail, formatCentsUsd, formatDueDate } from '../../../supabase/functions/_shared/stripeBillCopyEmail'

const base = {
  payerName: 'Josh Peterson',
  jobLabel: 'J1013 · Peterson Pretest',
  jobAddress: '390 Pecan Meadows, New Braunfels, TX',
  invoiceNumber: '1013-2609121030',
  amountDueCents: 25000,
  dueDateUnix: Date.UTC(2026, 8, 25, 12) / 1000,
  hostedInvoiceUrl: 'https://invoice.stripe.com/i/acct_x/test_abc',
  invoicePdfUrl: 'https://pay.stripe.com/invoice/acct_x/test_abc/pdf',
  companyName: 'Click Plumbing and Electrical',
}

describe('buildStripeBillCopyEmail', () => {
  it('names the payer, the job, the amount, the due date and the pay link', () => {
    const out = buildStripeBillCopyEmail(base)
    expect(out.subject).toBe('Copy of invoice #1013-2609121030 — J1013 · Peterson Pretest')
    expect(out.text).toContain('sent to Josh Peterson for 390 Pecan Meadows')
    expect(out.text).toContain('Amount due: $250.00 · Due Sep 25, 2026')
    expect(out.text).toContain(base.hostedInvoiceUrl)
    expect(out.text).toContain(base.invoicePdfUrl)
    expect(out.html).toContain('Pay or view the bill')
    expect(out.html).toContain('billed directly by Stripe')
  })
  it('survives a missing due date, PDF and address', () => {
    const out = buildStripeBillCopyEmail({ ...base, dueDateUnix: null, invoicePdfUrl: null, jobAddress: '' })
    expect(out.text).toContain('Amount due: $250.00\n')
    expect(out.text).not.toContain('PDF:')
    expect(out.text).toContain('sent to Josh Peterson.')
    expect(out.html).not.toContain('Download the PDF')
  })
  it('escapes HTML in names', () => {
    const out = buildStripeBillCopyEmail({ ...base, payerName: 'A <b>&</b> Sons' })
    expect(out.html).toContain('A &lt;b&gt;&amp;&lt;/b&gt; Sons')
  })
})

describe('formatters', () => {
  it('formats cents and dates', () => {
    expect(formatCentsUsd(123456)).toBe('$1,234.56')
    expect(formatDueDate(null)).toBeNull()
    expect(formatDueDate(Date.UTC(2026, 0, 2, 12) / 1000)).toBe('Jan 2, 2026')
  })
})
