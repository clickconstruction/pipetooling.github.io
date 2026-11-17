import { describe, expect, it } from 'vitest'
import {
  SUPPLY_PAY_CHIPS,
  billPaidBy,
  houseOnAccount,
  isPressPayment,
  lastMethodUsed,
  paymentView,
  needsHowPaid,
  openAmount,
  partPaidWords,
  paidByBill,
  paidByWords,
  paymentOnAccount,
  supplyBillOpen,
  supplyPayMethodRefField,
  supplyPayMethodWords,
  supplyPayMethodWrite,
  type SupplyPayment,
  type SupplyPaymentLine,
} from './supplyPayment'

const pay = (over: Partial<SupplyPayment> & { id: string }): SupplyPayment => ({ supply_house_id: 'h1', paid_on: '2026-11-12', amount: 0, method: null, method_ref: null, receipt_link: null, source: 'recorded', removed_at: null, ...over })
const line = (payment_id: string, invoice_id: string, amount: number): SupplyPaymentLine => ({ id: `${payment_id}-${invoice_id}`, payment_id, invoice_id, amount })

describe('how it was sent', () => {
  it('draws the chips in the owner’s order, Say later last', () => {
    expect(SUPPLY_PAY_CHIPS.map((c) => c.label)).toEqual(['Card', 'ACH', 'Check', 'Cash', 'Other', 'Say later'])
  })

  it('opens a number box for the methods that have one', () => {
    expect(supplyPayMethodRefField('ach')?.label).toBe('Confirmation number (optional)')
    expect(supplyPayMethodRefField('check')?.label).toBe('Check number (optional)')
    expect(supplyPayMethodRefField('cash')).toBeNull()
    expect(supplyPayMethodRefField('later')).toBeNull()
    expect(supplyPayMethodRefField(null)).toBeNull()
  })

  it('stores the method and its number trimmed, and nothing for Say later', () => {
    expect(supplyPayMethodWrite('ach', ' 88213 ')).toEqual({ method: 'ach', method_ref: '88213' })
    expect(supplyPayMethodWrite('cash', '12')).toEqual({ method: 'cash', method_ref: null })
    expect(supplyPayMethodWrite('later', '88213')).toEqual({ method: null, method_ref: null })
    expect(supplyPayMethodWrite(null, '88213')).toEqual({ method: null, method_ref: null })
  })

  it('says a method on a row', () => {
    expect(supplyPayMethodWords({ method: 'ach', method_ref: '88213' })).toBe('ACH 88213')
    expect(supplyPayMethodWords({ method: 'card', method_ref: ' ' })).toBe('Card')
    expect(supplyPayMethodWords({ method: null })).toBe('')
    expect(supplyPayMethodWords({ method: 'zelle' })).toBe('')
  })
})

describe('what is open on a bill', () => {
  const payments = [pay({ id: 'p1', amount: 450 }), pay({ id: 'p2', amount: 80, removed_at: '2026-11-13T00:00:00Z' })]
  const lines = [line('p1', 'x', 300), line('p1', 'y', 150), line('p2', 'y', 50), line('p1', 'c', -20)]

  it('sums the lines of live payments by bill, and skips a removed payment', () => {
    const paid = paidByBill(payments, lines)
    expect(paid.get('x')).toBe(300)
    expect(paid.get('y')).toBe(150)
    expect(paid.get('c')).toBe(-20)
  })

  it('reads a bill’s open amount, never past zero', () => {
    expect(supplyBillOpen({ amount: 200, is_paid: false }, 150)).toBe(50)
    expect(supplyBillOpen({ amount: 200, is_paid: false }, 0)).toBe(200)
    expect(supplyBillOpen({ amount: 200, is_paid: false }, 200.004)).toBe(0)
    expect(supplyBillOpen({ amount: 200, is_paid: false }, 260)).toBe(0)
    expect(supplyBillOpen({ amount: 0.3, is_paid: false }, 0.1)).toBe(0.2)
  })

  it('reads a credit memo below zero, and a bill marked paid as closed', () => {
    expect(supplyBillOpen({ amount: -50, is_paid: false }, -20)).toBe(-30)
    expect(supplyBillOpen({ amount: -50, is_paid: false }, 0)).toBe(-50)
    expect(supplyBillOpen({ amount: -50, is_paid: true }, 0)).toBe(0)
    expect(supplyBillOpen({ amount: 0, is_paid: false }, 0)).toBe(0)
  })
})

describe('what is open, from the row alone', () => {
  it('takes amount_paid off an unpaid bill, and counts a row read without it whole', () => {
    expect(openAmount({ amount: 812.4, is_paid: false, amount_paid: 300 })).toBe(512.4)
    expect(openAmount({ amount: 812.4, is_paid: false })).toBe(812.4)
    expect(openAmount({ amount: 812.4, is_paid: true, amount_paid: 812.4 })).toBe(0)
    expect(openAmount({ amount: -212.4, is_paid: false, amount_paid: -100 })).toBe(-112.4)
    expect(openAmount({ amount: null })).toBe(0)
  })

  it('words a bill paid in part', () => {
    expect(partPaidWords({ amount: 812.4, is_paid: false }, 300)).toBe('$300.00 paid · $512.40 left of $812.40')
    expect(partPaidWords({ amount: 812.4, is_paid: false }, 0)).toBe('')
    expect(partPaidWords({ amount: 812.4, is_paid: true }, 812.4)).toBe('')
    expect(partPaidWords({ amount: -212.4, is_paid: false }, -100)).toBe('$100.00 used · $112.40 left of $212.40')
  })
})

describe('money on account', () => {
  const payments = [pay({ id: 'new', amount: 500, paid_on: '2026-11-10' }), pay({ id: 'old', amount: 100, paid_on: '2026-10-01' }), pay({ id: 'full', amount: 75 }), pay({ id: 'gone', amount: 900, removed_at: '2026-11-13T00:00:00Z' })]
  const lines = [line('new', 'a', 312.6), line('old', 'b', 40), line('full', 'c', 75)]

  it('is what a payment sent past its lines', () => {
    expect(paymentOnAccount(payments[0] as SupplyPayment, lines)).toBe(187.4)
    expect(paymentOnAccount(payments[2] as SupplyPayment, lines)).toBe(0)
    expect(paymentOnAccount(payments[3] as SupplyPayment, lines)).toBe(0)
  })

  it('lists a house’s money on account oldest first', () => {
    expect(houseOnAccount(payments, lines).map((x) => [x.payment.id, x.amount])).toEqual([['old', 60], ['new', 187.4]])
  })
})

describe('naming a payment', () => {
  it('opens the chips on how the house was paid last', () => {
    expect(lastMethodUsed([pay({ id: 'a', method: 'check', paid_on: '2026-10-01' }), pay({ id: 'b', method: 'ach', paid_on: '2026-11-01' }), pay({ id: 'c', method: null, paid_on: '2026-11-10' }), pay({ id: 'd', method: 'card', paid_on: '2026-11-12', removed_at: 'x' })])).toBe('ach')
    expect(lastMethodUsed([pay({ id: 'a' })])).toBeNull()
  })

  it('waits on the finish-later list only when it sent money, has no method and is not from before', () => {
    expect(needsHowPaid(pay({ id: 'a', amount: 50, source: 'mark_paid' }))).toBe(true)
    expect(needsHowPaid(pay({ id: 'a', amount: 50, source: 'recorded' }))).toBe(true)
    expect(needsHowPaid(pay({ id: 'a', amount: 50, source: 'before' }))).toBe(false)
    expect(needsHowPaid(pay({ id: 'a', amount: 50, method: 'ach' }))).toBe(false)
    expect(needsHowPaid(pay({ id: 'a', amount: 0 }))).toBe(false)
    expect(needsHowPaid(pay({ id: 'a', amount: 50, removed_at: 'x' }))).toBe(false)
  })

  it('says how a paid bill was paid', () => {
    expect(paidByWords(pay({ id: 'a', amount: 5000, method: 'ach', method_ref: '88213' }), 4)).toBe('ACH 88213 · one of 4 bills on $5,000.00')
    expect(paidByWords(pay({ id: 'a', amount: 612.6, method: 'card' }), 1, { onThisBill: 612.6 })).toBe('Card')
    expect(paidByWords(pay({ id: 'a', amount: 800, method: 'check', method_ref: '1187' }), 1, { onThisBill: 612.6 })).toBe('Check 1187 · $612.60 of $800.00')
    expect(paidByWords(pay({ id: 'a', amount: 412.8, source: 'mark_paid' }), 1, { onThisBill: 412.8, sayMissing: true })).toBe('how it was paid is missing')
    expect(paidByWords(pay({ id: 'a', amount: 412.8, source: 'mark_paid' }), 1, { onThisBill: 412.8 })).toBe('')
    expect(paidByWords(pay({ id: 'a', amount: 100, source: 'before' }), 1, { onThisBill: 100 })).toBe('')
  })
})

describe('what paid a bill', () => {
  const ach = pay({ id: 'ach', amount: 5000, method: 'ach', method_ref: '88213', receipt_link: ' https://example.test/r ', paid_on: '2026-11-12' })
  const press = pay({ id: 'press', amount: 40, source: 'mark_paid', paid_on: '2026-11-14' })
  const gone = pay({ id: 'gone', amount: 10, method: 'card', removed_at: 'x' })
  const lines = [line('ach', 'x', 612.6), line('ach', 'y', 2900), line('ach', 'z', 300), line('ach', 'w', 1000), line('press', 'z', 40), line('gone', 'x', 10)]
  const all = [ach, press, gone]

  it('names the one payment behind a bill, with its receipt', () => {
    const by = billPaidBy('x', all, lines)
    expect(by.words).toBe('ACH 88213 · one of 4 bills on $5,000.00')
    expect(by.receiptLink).toBe('https://example.test/r')
    expect(by.typed.map((t) => [t.payment.id, t.onThisBill, t.bills])).toEqual([['ach', 612.6, 4]])
  })

  it('counts the payments when a bill took more than one, and tells a press from a typed payment', () => {
    const by = billPaidBy('z', all, lines)
    expect(by.words).toBe('2 payments')
    expect(by.typed.map((t) => t.payment.id)).toEqual(['ach'])
    expect(isPressPayment(press, lines)).toBe(true)
    expect(isPressPayment(ach, lines)).toBe(false)
    expect(isPressPayment(pay({ id: 'done', source: 'mark_paid', method: 'check' }), [line('done', 'q', 5)])).toBe(false)
  })

  it('names the payment that still needs how it was paid, for the row’s Finish press', () => {
    const by = billPaidBy('p', [press], [line('press', 'p', 40)], { sayMissing: true })
    expect(by.words).toBe('how it was paid is missing')
    expect(by.needsHowId).toBe('press')
    expect(billPaidBy('x', all, lines, { sayMissing: true }).needsHowId).toBeUndefined()
  })

  it('says nothing for a bill with no line read', () => {
    expect(billPaidBy('nobody', all, lines)).toEqual({ words: '', receiptLink: null, typed: [] })
  })

  it('opens a payment with every bill it touched', () => {
    const day = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
    const bills = [
      { id: 'x', invoice_number: 'S4390044', title: '214 · Hollis Street Clinic', amount: 612.6, is_paid: true },
      { id: 'y', invoice_number: 'S4391877', title: '201 · Maple Lofts', amount: 2900, is_paid: true },
      { id: 'z', invoice_number: 'S4402277', title: '201 · Maple Lofts', amount: 812.4, is_paid: false },
      { id: 'w', invoice_number: 'S4393015', title: '188 · Juniper Ridge Bldg C', amount: 1000, is_paid: true },
    ]
    const view = paymentView({ ...ach, created_by_name: 'Dana Whitfield' }, lines, bills, { house: 'Pecan Supply', dayWords: day, paidOnBill: (id) => (id === 'z' ? 340 : 0) })
    expect(view.title).toBe('$5,000.00 to Pecan Supply')
    expect(view.sub).toBe('11/12 · ACH 88213 · recorded by Dana Whitfield')
    expect(view.rows).toEqual([
      { billId: 'y', label: 'S4391877 · 201 · Maple Lofts', state: 'paid in full', amount: 2900 },
      { billId: 'w', label: 'S4393015 · 188 · Juniper Ridge Bldg C', state: 'paid in full', amount: 1000 },
      { billId: 'x', label: 'S4390044 · 214 · Hollis Street Clinic', state: 'paid in full', amount: 612.6 },
      { billId: 'z', label: 'S4402277 · 201 · Maple Lofts', state: 'part payment · $472.40 left on the bill', amount: 300 },
    ])
    expect(view.onAccount).toBe(187.4)
    expect(view.foot).toBe('$4,812.60 is on bills and $187.40 is on account.')
    expect(view.removeConfirm.message).toBe('The $5,000.00 ACH 88213 payment of 11/12 comes off the books. Its 4 bills read unpaid again, and the $187.40 on account goes with it. Record it again if it was sent after all.')
    expect(view.removeConfirm.confirmLabel).toBe('Remove payment')
  })

  it('words a payment that is all on its one bill', () => {
    const solo = pay({ id: 'c', amount: 75, method: 'check', method_ref: '1187', paid_on: '2026-11-03' })
    const view = paymentView(solo, [line('c', 'q', 75)], [{ id: 'q', invoice_number: 'S1', title: '', amount: 75, is_paid: true }], { house: 'Pecan Supply', dayWords: (d) => d, paidOnBill: () => 75 })
    expect(view.foot).toBe('Every line adds up to $75.00.')
    expect(view.rows[0]?.label).toBe('S1')
    expect(view.removeConfirm.message).toBe('The $75.00 Check 1187 payment of 2026-11-03 comes off the books. Its bill reads unpaid again. Record it again if it was sent after all.')
  })
})
