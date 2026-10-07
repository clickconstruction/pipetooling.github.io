import { describe, expect, it } from 'vitest'
import { markedPaidRemoveMenu, markedPaidRemovedNoteBody } from './markedPaidInvoiceRemoval'

describe('markedPaidRemoveMenu (v2.4839)', () => {
  it('a paid row with nothing paid on it and no Stripe invoice gets a live Remove bill', () => {
    expect(markedPaidRemoveMenu({ paid: 0, stripeInvoiceId: null })).toMatchObject({ enabled: true })
    expect(markedPaidRemoveMenu({ paid: 0, stripeInvoiceId: '  ' })?.enabled).toBe(true)
  })

  it('a paid row with a payment behind it is not a stub and gets no item', () => {
    expect(markedPaidRemoveMenu({ paid: 8000, stripeInvoiceId: null })).toBeNull()
    expect(markedPaidRemoveMenu({ paid: 0.01, stripeInvoiceId: null })).toBeNull()
  })

  it('a Stripe-backed stamp is dead with the door to use instead', () => {
    const m = markedPaidRemoveMenu({ paid: 0, stripeInvoiceId: 'in_123' })
    expect(m?.enabled).toBe(false)
    expect(m?.title).toMatch(/Undo it under the bill first/)
  })

  it('the thread note names the amount and says the money did not move', () => {
    expect(markedPaidRemovedNoteBody(8900)).toBe('Removed a $8,900 bill that was marked paid with no payment on record. No payment or balance changed.')
  })
})
