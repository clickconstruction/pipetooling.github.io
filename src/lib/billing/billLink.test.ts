import { describe, expect, it } from 'vitest'
import { billedNewestFirst, newestBillLink, type BillForLink } from './billLink'

const ID_A = 'a1b2c3d4-0000-4000-8000-000000000001'
const ID_B = 'a1b2c3d4-0000-4000-8000-000000000002'
const ID_C = 'a1b2c3d4-0000-4000-8000-000000000003'
const bill = (over: Partial<BillForLink>): BillForLink => ({ id: ID_A, status: 'billed', stripe_invoice_id: 'in_1', billed_at: '2026-10-01T15:00:00.000Z', created_at: '2026-10-01T14:00:00.000Z', ...over })

describe('newestBillLink', () => {
  it('takes the newest billed bill with a Stripe id and gives its pay page', () => {
    const bills = [bill({ id: ID_A, billed_at: '2026-09-01T15:00:00.000Z' }), bill({ id: ID_B, billed_at: '2026-10-11T15:00:00.000Z' }), bill({ id: ID_C, billed_at: '2026-10-05T15:00:00.000Z' })]
    expect(newestBillLink(bills)).toBe(`https://clicktooling.com/pay/${ID_B}`)
    expect(billedNewestFirst(bills).map((b) => b.id)).toEqual([ID_B, ID_C, ID_A])
  })

  it('skips a bill billed outside Stripe, a paid bill and a bill with no pay-page id, and answers null with none left', () => {
    expect(newestBillLink([bill({ id: ID_B, billed_at: '2026-10-11T15:00:00.000Z', stripe_invoice_id: null }), bill({ id: ID_A })])).toBe(`https://clicktooling.com/pay/${ID_A}`)
    expect(newestBillLink([bill({ status: 'paid' })])).toBeNull()
    expect(newestBillLink([bill({ id: 'not-an-id' })])).toBeNull()
    expect(newestBillLink([])).toBeNull()
  })

  it('sorts a bill with no billed day after the dated ones, by the day it was made', () => {
    const bills = [bill({ id: ID_A, billed_at: null, created_at: '2026-10-12T00:00:00.000Z' }), bill({ id: ID_B, billed_at: '2026-10-01T00:00:00.000Z' })]
    expect(billedNewestFirst(bills).map((b) => b.id)).toEqual([ID_B, ID_A])
  })
})
