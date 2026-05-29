import { describe, expect, it } from 'vitest'
import {
  buildLienReleaseHtml,
  buildLienReleaseText,
  LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER,
  LIEN_RELEASE_DEFAULT_PAYMENT_TERMS,
  LIEN_RELEASE_DEFAULT_LIEN_PHONE,
  type LienReleaseFormData,
} from './lienRelease'

function form(p: Partial<LienReleaseFormData> = {}): LienReleaseFormData {
  return {
    invoiceAmount: p.invoiceAmount ?? '10000',
    bidAmount: p.bidAmount ?? '50000',
    invoicesToDate: p.invoicesToDate ?? '40000',
    cc: p.cc ?? '',
    companyName: p.companyName ?? 'Click Plumbing and Electrical',
    companyAddress: p.companyAddress ?? '5501 Balcones Dr Ste A141, Austin, Texas 78731',
    companyPhone: p.companyPhone ?? '',
    companyEmail: p.companyEmail ?? '',
    invoiceDate: p.invoiceDate ?? '2026-02-15',
    invoiceNumber: p.invoiceNumber ?? 'INV-001',
    descriptionOfWork: p.descriptionOfWork ?? '',
    conditionalWaiver: p.conditionalWaiver ?? LIEN_RELEASE_DEFAULT_CONDITIONAL_WAIVER,
    paymentTerms: p.paymentTerms ?? LIEN_RELEASE_DEFAULT_PAYMENT_TERMS,
    lienStatusPhone: p.lienStatusPhone ?? '',
  }
}

describe('buildLienReleaseHtml', () => {
  it('substitutes the bolded invoice amount into the conditional waiver and payment terms', () => {
    const html = buildLienReleaseHtml('Owner LLC', '', 'Acme Tower', '456 Job Rd, Austin, TX', form(), 'Owner LLC')
    expect(html).toContain('<strong>$10,000.00</strong>')
    expect(html).not.toContain('{{finalInvoice}}')
    expect(html).not.toContain('${{finalInvoice}}')
    expect(html).not.toContain('{{invoicesToDate}}')
  })

  it('substitutes ownerName into the payment terms', () => {
    const html = buildLienReleaseHtml('Owner LLC', '', 'Acme Tower', 'addr', form(), 'Globex Properties')
    expect(html).toContain('Globex Properties')
    expect(html).not.toContain('{{ownerName}}')
  })

  it('renders the summary lines for invoice amount and invoices-to-date', () => {
    const html = buildLienReleaseHtml('Owner LLC', '', 'P', 'addr', form(), 'Owner LLC')
    expect(html).toContain('10,000.00 - FINAL INVOICE')
    expect(html).toContain('40,000.00 - Invoices to date')
  })

  it('falls back to the default lien-status phone and includes the statutory header', () => {
    const html = buildLienReleaseHtml('Owner LLC', '', 'P', 'addr', form({ lienStatusPhone: '' }), 'Owner LLC')
    expect(html).toContain(LIEN_RELEASE_DEFAULT_LIEN_PHONE)
    expect(html).toContain('CONDITIONAL WAIVER AND RELEASE ON PROGRESS PAYMENT')
  })

  it('escapes HTML in the customer / project names', () => {
    const html = buildLienReleaseHtml('A & B <Owner>', '', 'P & Q', 'addr', form(), 'A & B')
    expect(html).toContain('A &amp; B &lt;Owner&gt;')
    expect(html).toContain('P &amp; Q')
  })
})

describe('buildLienReleaseText', () => {
  it('substitutes amounts and ownerName without HTML', () => {
    const text = buildLienReleaseText('Owner LLC', '', 'Acme Tower', '456 Job Rd, Austin, TX', form(), 'Globex Properties')
    expect(text).toContain('10,000.00 - FINAL INVOICE')
    expect(text).toContain('Globex Properties')
    expect(text).not.toContain('{{finalInvoice}}')
    expect(text).not.toContain('{{ownerName}}')
    expect(text).not.toContain('<strong>')
  })
})
