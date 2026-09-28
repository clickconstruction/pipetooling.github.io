import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — the pure builder, tested here.
import { buildStripeBillEmail, stripeBillEmailSubject, type StripeBillEmailInput } from '../../../supabase/functions/_shared/stripeBillEmail'
import { PORTAL_QR_CONTENT_ID } from '../../../supabase/functions/_shared/portalAccountCard'

const SHORT = 'https://my.clickplumbing.com/hartwell-homes-k7x2'
const TOKEN = `https://clicktooling.com/portal?t=${'7c1e09ab34f25d60'.repeat(4)}`

const base: StripeBillEmailInput = {
  companyName: 'Click Plumbing and Electrical',
  companyPhone: '(512) 360-0599',
  payerName: 'Hartwell Homes',
  jobAddress: '412 Pecan Grove Ln',
  invoiceNumber: '1013-2609121030',
  amountDueCents: 184000,
  dueDateUnix: Date.UTC(2026, 9, 12, 12) / 1000,
  payUrl: 'https://clicktooling.com/pay/0b9c2f4e-1a2b-4c3d-8e9f-001122334455',
  invoicePdfUrl: 'https://pay.stripe.com/invoice/acct_x/live_abc/pdf',
  pdfAttached: true,
  portalUrl: SHORT,
  qrImgSrc: `cid:${PORTAL_QR_CONTENT_ID}`,
  canReply: true,
}

describe('buildStripeBillEmail (the bill email the payer reads)', () => {
  it('names the company, the invoice, the amount and the due date', () => {
    const out = buildStripeBillEmail(base)
    expect(out.subject).toBe('Invoice #1013-2609121030 from Click Plumbing and Electrical')
    expect(out.text).toContain('Hello Hartwell Homes,')
    expect(out.text).toContain('Here is your invoice from Click Plumbing and Electrical for 412 Pecan Grove Ln.')
    expect(out.text).toContain('Amount due: $1,840.00 · Due Oct 12, 2026')
    expect(out.html).toContain('$1,840.00')
    expect(out.html).toContain('Due Oct 12, 2026')
    expect(out.html).toContain('>Invoice #1013-2609121030</div>')
    expect(out.html.split('412 Pecan Grove Ln').length - 1).toBe(1)
  })

  it('pays through the bill’s own address, never Stripe’s expiring link', () => {
    const out = buildStripeBillEmail(base)
    expect(out.html).toContain(`href="${base.payUrl}"`)
    expect(out.html).toContain('>Pay now</a>')
    expect(out.text).toContain(`Pay online: ${base.payUrl}`)
    expect(out.html).not.toContain('invoice.stripe.com')
  })

  it('carries the code and the short address in words, both linked to the statement', () => {
    const out = buildStripeBillEmail(base)
    expect(out.html).toContain('<img src="cid:portal-qr" width="120" height="120" alt="QR code for my.clickplumbing.com/hartwell-homes-k7x2"')
    expect(out.html).toContain('>my.clickplumbing.com/hartwell-homes-k7x2</a>')
    expect(out.html.split(`href="${SHORT}"`).length - 1).toBe(2)
    expect(out.html).toContain('Scan the code with your phone camera.')
    expect(out.text).toContain(`Your account, any time: ${SHORT}`)
  })

  it('keeps the address in words when the image is missing — a mail client may drop it', () => {
    const out = buildStripeBillEmail({ ...base, qrImgSrc: null })
    expect(out.html).not.toContain('<img')
    expect(out.html).not.toContain('Scan the code')
    expect(out.html).toContain('>my.clickplumbing.com/hartwell-homes-k7x2</a>')
  })

  it('says "Open your statement" for a token address, which nobody reads aloud', () => {
    const out = buildStripeBillEmail({ ...base, portalUrl: TOKEN })
    expect(out.html).toContain('>Open your statement</a>')
    expect(out.html).toContain('alt="QR code for your statement"')
    expect(out.html).not.toContain('>clicktooling.com/portal')
    expect(out.text).toContain(`Your account, any time: ${TOKEN}`)
  })

  it('has no account card without a portal — and never draws a code for nothing', () => {
    const out = buildStripeBillEmail({ ...base, portalUrl: null })
    expect(out.html).not.toContain('Your account, any time')
    expect(out.html).not.toContain('<img')
    expect(out.text).not.toContain('Your account')
  })

  it('says the PDF is attached, or links it when it could not be', () => {
    expect(buildStripeBillEmail(base).html).toContain('The invoice is attached as a PDF.')
    expect(buildStripeBillEmail(base).html).not.toContain('Download the invoice PDF')
    const linked = buildStripeBillEmail({ ...base, pdfAttached: false })
    expect(linked.html).toContain(`<a href="${base.invoicePdfUrl}"`)
    expect(linked.text).toContain(`Invoice PDF: ${base.invoicePdfUrl}`)
    const neither = buildStripeBillEmail({ ...base, pdfAttached: false, invoicePdfUrl: null })
    expect(neither.html).not.toContain('PDF')
    expect(neither.text).not.toContain('PDF')
  })

  it('offers a reply only when a reply reaches someone', () => {
    expect(buildStripeBillEmail(base).text).toContain('Questions? Call (512) 360-0599 or reply to this email.')
    expect(buildStripeBillEmail({ ...base, canReply: false }).text).toContain('Questions? Call (512) 360-0599.')
    expect(buildStripeBillEmail({ ...base, canReply: false, companyPhone: '' }).text).not.toContain('Questions?')
  })

  it('marks a test bill and names the address it did not go to', () => {
    const out = buildStripeBillEmail({ ...base, testIntendedFor: 'ap@hartwell.example' })
    expect(out.subject).toBe('[Test] Invoice #1013-2609121030 from Click Plumbing and Electrical')
    expect(out.text.startsWith('Test bill. This email came to you instead of ap@hartwell.example; nothing was sent to the customer.')).toBe(true)
    expect(out.html).toContain('instead of ap@hartwell.example')
    expect(buildStripeBillEmail(base).html).not.toContain('Test bill')
  })

  it('survives a missing name, address, number and due date', () => {
    const out = buildStripeBillEmail({ ...base, payerName: ' ', jobAddress: '', invoiceNumber: '', dueDateUnix: null })
    expect(out.subject).toBe('Invoice from Click Plumbing and Electrical')
    expect(out.text).toContain('Hello,\n\nHere is your invoice from Click Plumbing and Electrical.\n\nAmount due: $1,840.00\n')
    expect(out.html).not.toContain('Due ')
    expect(out.text).not.toMatch(/\n\n\n/)
  })

  it('escapes HTML in everything the office typed', () => {
    const out = buildStripeBillEmail({ ...base, payerName: 'A <b>& Sons', jobAddress: '1 "Main" St' })
    expect(out.html).toContain('Hello A &lt;b&gt;&amp; Sons,')
    expect(out.html).toContain('1 &quot;Main&quot; St')
    expect(out.html).not.toContain('<b>&')
  })
})

describe('stripeBillEmailSubject', () => {
  it('is the same subject the builder uses', () => {
    expect(stripeBillEmailSubject(base)).toBe(buildStripeBillEmail(base).subject)
  })
})
