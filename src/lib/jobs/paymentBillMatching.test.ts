import { describe, expect, it } from 'vitest'
import { billChoicesForPayment, type MatchableInvoiceSlice, type MatchablePaymentSlice } from './paymentBillMatching'

const inv = (over: Partial<MatchableInvoiceSlice> = {}): MatchableInvoiceSlice => ({
  id: 'i1',
  status: 'billed',
  amount: 1000,
  sent_to_customer_at: '2026-07-06T12:00:00Z',
  ...over,
})

const pay = (over: Partial<MatchablePaymentSlice> = {}): MatchablePaymentSlice => ({
  id: 'p1',
  amount: 500,
  invoice_id: null,
  ...over,
})

describe('billChoicesForPayment', () => {
  it('only offers billed invoices', () => {
    const choices = billChoicesForPayment(pay(), [inv(), inv({ id: 'i2', status: 'paid' }), inv({ id: 'i3', status: 'draft' })], [])
    expect(choices.map((c) => c.id)).toEqual(['i1'])
  })

  it('computes remaining from payments already applied in the form', () => {
    const choices = billChoicesForPayment(
      pay(),
      [inv({ amount: 9440 })],
      [pay({ id: 'p2', amount: 4000, invoice_id: 'i1' }), pay({ id: 'p3', amount: 440, invoice_id: 'i1' })],
    )
    expect(choices[0]?.remaining).toBe(5000)
  })

  it('never counts the payment being placed toward its own bill balance', () => {
    const placed = pay({ id: 'p1', amount: 9440, invoice_id: 'i1' })
    const choices = billChoicesForPayment(placed, [inv({ amount: 9440 })], [placed])
    expect(choices[0]?.remaining).toBe(9440)
    expect(choices[0]?.matchesAmount).toBe(true)
  })

  it('flags the bill whose open balance matches the payment to the cent, including string amounts', () => {
    const choices = billChoicesForPayment(
      pay({ amount: '9440.00' }),
      [inv({ id: 'a', amount: 4720 }), inv({ id: 'b', amount: '9440' })],
      [],
    )
    const byId = Object.fromEntries(choices.map((c) => [c.id, c.matchesAmount]))
    expect(byId).toEqual({ a: false, b: true })
  })

  it('does not match on a zero-amount payment', () => {
    const choices = billChoicesForPayment(pay({ amount: 0 }), [inv({ amount: 0 })], [])
    expect(choices[0]?.matchesAmount).toBe(false)
  })

  it('sorts match first, then oldest sent date, dateless last', () => {
    const choices = billChoicesForPayment(
      pay({ amount: 200 }),
      [
        inv({ id: 'newer', amount: 500, sent_to_customer_at: '2026-08-27T00:00:00Z' }),
        inv({ id: 'dateless', amount: 500, sent_to_customer_at: null, billed_at: null }),
        inv({ id: 'match', amount: 200, sent_to_customer_at: '2026-08-30T00:00:00Z' }),
        inv({ id: 'older', amount: 500, sent_to_customer_at: '2026-07-06T00:00:00Z' }),
      ],
      [],
    )
    expect(choices.map((c) => c.id)).toEqual(['match', 'older', 'newer', 'dateless'])
  })

  it('falls back to billed_at then estimated_bill_date for the sent day', () => {
    const [a] = billChoicesForPayment(pay(), [inv({ sent_to_customer_at: null, billed_at: '2026-08-01T09:00:00Z' })], [])
    expect(a?.sentYmd).toBe('2026-08-01')
    const [b] = billChoicesForPayment(
      pay(),
      [inv({ sent_to_customer_at: null, billed_at: null, estimated_bill_date: '2026-08-15' })],
      [],
    )
    expect(b?.sentYmd).toBe('2026-08-15')
  })

  it('reports over-applied bills as negative remaining, not a match', () => {
    const choices = billChoicesForPayment(pay({ amount: 100 }), [inv({ amount: 1000 })], [pay({ id: 'p9', amount: 1100, invoice_id: 'i1' })])
    expect(choices[0]?.remaining).toBe(-100)
    expect(choices[0]?.matchesAmount).toBe(false)
  })
})
