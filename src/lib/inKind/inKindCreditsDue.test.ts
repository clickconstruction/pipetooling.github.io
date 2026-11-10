import { describe, expect, it } from 'vitest'
import { inKindCreditsDue, type InKindDealForDue } from './inKindCreditsDue'

const deal = (o: Partial<InKindDealForDue['arrangement']> = {}, rest: Partial<InKindDealForDue> = {}): InKindDealForDue => ({
  arrangement: { id: 'a1', customer_id: 'c1', partner_name: 'Calloway Holdings', what_given: 'Rent credit', note: '', monthly_amount: 1500, monthly_due: 3000, bank_payee: 'Calloway', starts_on: '2026-10-01', ended_at: null, ...o },
  lines: [],
  jobs: [{ id: 'j1', status: 'billed', revenue: 9375.4, payments_made: 0 }],
  ...rest,
})
const nov = { id: 't1', day: '2026-11-03', amount: 1500, name: 'Calloway Holdings LLC' }

describe('inKindCreditsDue', () => {
  it('finds a month that is over and a month whose rent has left the bank, oldest first, with the credit each will suggest', () => {
    expect(inKindCreditsDue([deal({}, { bank: [nov] })], '2026-11-10')).toEqual({
      due: [
        { arrangementId: 'a1', customerId: 'c1', partner: 'Calloway Holdings', month: '2026-10-01', amount: 3000 }, // nothing left the bank in October
        { arrangementId: 'a1', customerId: 'c1', partner: 'Calloway Holdings', month: '2026-11-01', amount: 1500 },
      ],
      total: 4500,
    })
  })
  it('asks nothing of this month while its rent has not left the bank', () => {
    expect(inKindCreditsDue([deal({ starts_on: '2026-11-01' }, { bank: [] })], '2026-11-10').due).toEqual([])
  })
  it('still finds a month that is over when the bank was not read, at the usual credit', () => {
    expect(inKindCreditsDue([deal({}, { bank: null })], '2026-11-10').due).toEqual([{ arrangementId: 'a1', customerId: 'c1', partner: 'Calloway Holdings', month: '2026-10-01', amount: 1500 }])
  })
  it('leaves a month with its line alone, a line of zero included', () => {
    const lines = [
      { id: 'l1', arrangement_id: 'a1', given_on: '2026-10-31', amount: 0, memo: 'No credit', cost_job_id: null, for_month: '2026-10-01', removed_at: null },
      { id: 'l2', arrangement_id: 'a1', given_on: '2026-11-03', amount: 1500, memo: 'Rent credit', cost_job_id: null, for_month: '2026-11-01', removed_at: null },
    ]
    expect(inKindCreditsDue([deal({}, { lines, bank: [nov] })], '2026-11-10').due).toEqual([])
  })
  it('never suggests more across the months than is left on the bills', () => {
    const d = deal({}, { jobs: [{ id: 'j1', status: 'billed', revenue: 3200, payments_made: 0 }], bank: [nov] })
    expect(inKindCreditsDue([d], '2026-11-10').due.map((x) => x.amount)).toEqual([3000, 200])
  })
  it('skips an ended deal and a deal with no schedule', () => {
    expect(inKindCreditsDue([deal({ ended_at: '2026-11-01T00:00:00Z' }), deal({ id: 'a2', monthly_amount: null, monthly_due: null, starts_on: null })], '2026-11-10').due).toEqual([])
  })
  it('orders two customers by month, then by name', () => {
    const out = inKindCreditsDue([deal({ id: 'b', partner_name: 'Zed Yard' }, { bank: null }), deal({ id: 'a', partner_name: 'Able Shop' }, { bank: null })], '2026-11-10')
    expect(out.due.map((x) => x.partner)).toEqual(['Able Shop', 'Zed Yard'])
  })
})
