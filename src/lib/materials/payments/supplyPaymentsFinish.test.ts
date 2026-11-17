import { describe, expect, it } from 'vitest'
import { billNumbersOf, finishHeading, finishRows, planHowSent, type PaymentToFinish } from './supplyPaymentsFinish'

// Made-up houses, bills and payments.
const pay = (over: Partial<PaymentToFinish> & { id: string }): PaymentToFinish => ({ supply_house_id: 'h1', paid_on: '2026-11-14', amount: 412.8, method: null, method_ref: null, receipt_link: null, source: 'mark_paid', removed_at: null, houseName: 'Pecan Supply', billNumbers: ['S4388310'], ...over })
const day = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`

describe('the finish-later list', () => {
  it('lists the payments with no method, the one that has waited longest first', () => {
    const rows = finishRows(
      [
        pay({ id: 'a' }),
        pay({ id: 'b', houseName: 'Cedar Fork Supply', billNumbers: ['77120', '77264'], amount: 1906.22, paid_on: '2026-11-10', source: 'recorded' }),
        pay({ id: 'c', billNumbers: [], amount: 250, paid_on: '2026-11-12', source: 'recorded' }),
      ],
      day,
    )
    expect(rows).toEqual([
      { id: 'b', title: 'Cedar Fork Supply · 2 bills', sub: 'recorded 11/10', amount: 1906.22 },
      { id: 'c', title: 'Pecan Supply · on account', sub: 'recorded 11/12', amount: 250 },
      { id: 'a', title: 'Pecan Supply · S4388310', sub: 'marked paid 11/14', amount: 412.8 },
    ])
  })

  it('leaves out a payment from before, one with its method, one removed and one that sent nothing', () => {
    expect(finishRows([pay({ id: 'a', source: 'before' }), pay({ id: 'b', method: 'ach' }), pay({ id: 'c', removed_at: '2026-11-15T00:00:00Z' }), pay({ id: 'd', amount: 0 })], day)).toEqual([])
  })

  it('words its heading by the count', () => {
    expect(finishHeading(3)).toBe('3 payments need how they were paid')
    expect(finishHeading(1)).toBe('1 payment needs how it was paid')
    expect(finishHeading(0)).toBe('')
  })

  it('reads a payment’s bill numbers from its lines, each once', () => {
    const lines = [
      { id: 'l1', payment_id: 'p', invoice_id: 'x', amount: 10, invoice_number: 'S1' },
      { id: 'l2', payment_id: 'p', invoice_id: 'x', amount: 5, invoice_number: 'S1' },
      { id: 'l3', payment_id: 'p', invoice_id: 'y', amount: 5, invoice_number: 'S2' },
      { id: 'l4', payment_id: 'q', invoice_id: 'z', amount: 5, invoice_number: 'S3' },
    ]
    expect(billNumbersOf('p', lines)).toEqual(['S1', 'S2'])
  })
})

describe('saying how it was sent', () => {
  it('writes the method, its number trimmed, the day and the receipt link', () => {
    expect(planHowSent({ chip: 'ach', ref: ' 88213 ', paidOn: '2026-11-13', receiptLink: ' https://example.test/r ' }, { amount: 412.8 })).toEqual({
      ok: true,
      patch: { method: 'ach', method_ref: '88213', paid_on: '2026-11-13', receipt_link: 'https://example.test/r' },
      words: 'How the $412.80 was sent is saved.',
    })
    expect(planHowSent({ chip: 'cash', ref: 'x', paidOn: '2026-11-13', receiptLink: '' }, { amount: 5 })).toMatchObject({ ok: true, patch: { method: 'cash', method_ref: null, receipt_link: null } })
  })

  it('needs a method and a day', () => {
    expect(planHowSent({ chip: null, ref: '', paidOn: '2026-11-13', receiptLink: '' }, { amount: 5 })).toEqual({ ok: false, reason: 'Pick how it was sent.' })
    expect(planHowSent({ chip: 'later', ref: '', paidOn: '2026-11-13', receiptLink: '' }, { amount: 5 })).toEqual({ ok: false, reason: 'Pick how it was sent.' })
    expect(planHowSent({ chip: 'card', ref: '', paidOn: '', receiptLink: '' }, { amount: 5 })).toEqual({ ok: false, reason: 'Pick the day it was sent.' })
  })
})
