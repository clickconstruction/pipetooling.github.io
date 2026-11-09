/** The job's newest billed bill with its amount (v2.6771): the same pick as `{bill}`, the amount beside the link. */
import { describe, expect, it } from 'vitest'
import { billDollars, newestBill } from './newestBill'

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'

describe('newestBill', () => {
  it('picks the newest billed bill with a pay page and words its amount with two decimals', () => {
    const bills = [
      { id: ID_A, status: 'billed', stripe_invoice_id: 'in_a', billed_at: '2026-11-01', amount: 1850 },
      { id: ID_B, status: 'billed', stripe_invoice_id: 'in_b', billed_at: '2026-11-08', amount: 420.5 },
    ]
    expect(newestBill(bills)).toEqual({ id: ID_B, amount: '$420.50', link: `https://clicktooling.com/pay/${ID_B}` })
    expect(billDollars(1850)).toBe('$1,850.00')
  })
  it('passes over a bill with no Stripe invoice, and reads none as null', () => {
    expect(newestBill([{ id: ID_A, status: 'billed', stripe_invoice_id: null, billed_at: '2026-11-08', amount: 100 }])).toBeNull()
    expect(newestBill([])).toBeNull()
  })
})
