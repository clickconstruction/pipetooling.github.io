import { describe, expect, it } from 'vitest'
import { billShortUrl } from '../portal/portalShortOrigin'
import { billTextLink } from './billTextLink'

const ID = '8f3c2a1e-6b7d-4c9a-9e21-5d0f7a3b1c44'
const STRIPE = 'https://invoice.stripe.com/i/acct_x/test_abcdefghijklmnopqrstuvwxyz0123456789?s=ap'

describe('billTextLink — the customer’s link for a bill', () => {
  it('is the short pay page on my.clickplumbing.com when the bill’s id is at hand', () => {
    expect(billTextLink({ invoiceId: ID, hostedInvoiceUrl: STRIPE })).toBe(`https://my.clickplumbing.com/pay/${ID}`)
  })

  it('lower-cases the id and trims it, as the Worker forwards it', () => {
    expect(billTextLink({ invoiceId: ` ${ID.toUpperCase()} `, hostedInvoiceUrl: STRIPE })).toBe(`https://my.clickplumbing.com/pay/${ID}`)
  })

  it('falls back to Stripe’s own link when no bill id is at hand or it is not a UUID', () => {
    expect(billTextLink({ hostedInvoiceUrl: ` ${STRIPE} ` })).toBe(STRIPE)
    expect(billTextLink({ invoiceId: null, hostedInvoiceUrl: STRIPE })).toBe(STRIPE)
    expect(billTextLink({ invoiceId: 'inv-1', hostedInvoiceUrl: STRIPE })).toBe(STRIPE)
  })

  it('is 69 characters against Stripe’s 160-odd', () => {
    expect(billTextLink({ invoiceId: ID, hostedInvoiceUrl: STRIPE })).toHaveLength(69)
  })
})

describe('billShortUrl', () => {
  it('builds /pay/ on the short host, or on an origin handed in, with no double slash', () => {
    expect(billShortUrl(ID)).toBe(`https://my.clickplumbing.com/pay/${ID}`)
    expect(billShortUrl('abc2def3gh', 'https://clicktooling.com/')).toBe('https://clicktooling.com/pay/abc2def3gh')
  })
})
