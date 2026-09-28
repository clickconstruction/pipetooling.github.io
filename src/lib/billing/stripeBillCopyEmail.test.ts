import { describe, expect, it } from 'vitest'
import { buildStripeBillCopyEmail, formatCentsUsd, formatDueDate, stripeBillCopyTestLine } from '../../../supabase/functions/_shared/stripeBillCopyEmail'

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
  it('adds the recipient statement link only when given', () => {
    const with_ = buildStripeBillCopyEmail({ ...base, portalUrl: 'https://my.clickplumbing.com/done-right-x7kq' })
    expect(with_.text).toContain('See your statement any time: https://my.clickplumbing.com/done-right-x7kq')
    expect(with_.html).toContain('href="https://my.clickplumbing.com/done-right-x7kq"')
    expect(buildStripeBillCopyEmail(base).text).not.toContain('See your statement')
  })
  it('a live copy carries no test mark', () => {
    for (const out of [buildStripeBillCopyEmail(base), buildStripeBillCopyEmail({ ...base, testHeldBack: null })]) {
      expect(out.subject.startsWith('Copy of invoice')).toBe(true)
      expect(out.text.startsWith('This is a copy of the bill')).toBe(true)
      expect(`${out.text}${out.html}`).not.toContain('Test bill')
    }
  })
  it('a test copy is marked in the subject and names the addresses it did not go to', () => {
    const out = buildStripeBillCopyEmail({ ...base, testHeldBack: ['pm@hartwell.example', 'ap@drf.example'] })
    const line = 'Test bill. This copy came to you instead of pm@hartwell.example, ap@drf.example; nothing was sent to the copy list.'
    expect(out.subject).toBe('[Test] Copy of invoice #1013-2609121030 — J1013 · Peterson Pretest')
    expect(out.text.startsWith(`${line}\n\nThis is a copy of the bill`)).toBe(true)
    expect(out.html).toContain(line)
    expect(out.html.indexOf(line)).toBeLessThan(out.html.indexOf('Copy of a bill'))
  })
  it('a test copy with nobody held back still says it is a test', () => {
    expect(stripeBillCopyTestLine([])).toBe('Test bill. This copy came to you; nobody else is on the copy list.')
    expect(stripeBillCopyTestLine([' ', ''])).toBe('Test bill. This copy came to you; nobody else is on the copy list.')
    expect(stripeBillCopyTestLine(null)).toBe('')
    expect(stripeBillCopyTestLine(undefined)).toBe('')
    expect(buildStripeBillCopyEmail({ ...base, testHeldBack: [] }).subject.startsWith('[Test] ')).toBe(true)
  })
  it('escapes a held-back address in the HTML', () => {
    expect(buildStripeBillCopyEmail({ ...base, testHeldBack: ['a<b>@x.example'] }).html).toContain('a&lt;b&gt;@x.example')
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
