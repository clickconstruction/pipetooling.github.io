import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — dependency-free, tested here.
import {
  portalReturnFooterLine,
  stripeInvoiceFooter,
} from '../../../supabase/functions/_shared/stripeInvoiceFooterPortalLink'
import { STRIPE_INVOICE_FOOTER_MAX_CHARS } from '../../../supabase/functions/_shared/stripeInvoiceFooter'

const URL = 'https://my.clickplumbing.com/knight-contracting?paid=1'
const LINE = `See your updated statement any time at ${URL}`

describe('stripeInvoiceFooter (Stripe receipt → portal return line)', () => {
  it('no portal → the custom footer as typed, null when blank (Stripe account default)', () => {
    expect(stripeInvoiceFooter('Click Plumbing\nPh: 801', null)).toBe('Click Plumbing\nPh: 801')
    expect(stripeInvoiceFooter('  padded  ', undefined)).toBe('padded')
    expect(stripeInvoiceFooter('', null)).toBeNull()
    expect(stripeInvoiceFooter(undefined, '   ')).toBeNull()
  })

  it('portal, no custom footer → just the return line', () => {
    expect(stripeInvoiceFooter('', URL)).toBe(LINE)
    expect(stripeInvoiceFooter(null, URL)).toBe(LINE)
    expect(portalReturnFooterLine(URL)).toBe(LINE)
  })

  it('custom footer keeps priority; the return line is appended after a blank line', () => {
    expect(stripeInvoiceFooter('Click Plumbing and Electrical\nPh: 801-252-5155', URL)).toBe(
      `Click Plumbing and Electrical\nPh: 801-252-5155\n\n${LINE}`,
    )
  })

  it('cap: the line is appended only while the total fits Stripe’s footer cap; over it the custom footer wins untouched', () => {
    const roomy = 'x'.repeat(STRIPE_INVOICE_FOOTER_MAX_CHARS - LINE.length - 2)
    expect(stripeInvoiceFooter(roomy, URL)).toBe(`${roomy}\n\n${LINE}`)
    expect(stripeInvoiceFooter(roomy, URL)!.length).toBe(STRIPE_INVOICE_FOOTER_MAX_CHARS)
    const tight = 'x'.repeat(STRIPE_INVOICE_FOOTER_MAX_CHARS - LINE.length - 1)
    expect(stripeInvoiceFooter(tight, URL)).toBe(tight)
    const full = 'x'.repeat(STRIPE_INVOICE_FOOTER_MAX_CHARS)
    expect(stripeInvoiceFooter(full, URL)).toBe(full)
  })
})
