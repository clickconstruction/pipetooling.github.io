import { describe, expect, it } from 'vitest'
import { ON_ACCOUNT, billMoveTrace, moveTargets, paymentHistory, paymentOnBill, planMove, removedLately, standingMoves, type MoveBill, type SupplyPaymentEvent } from './supplyPaymentMove'
import type { SupplyPayment, SupplyPaymentLine } from './supplyPayment'

// Pecan Supply's Nov 12 ACH, as the drawing has it. Made-up numbers.
const ach: SupplyPayment = { id: 'p1', supply_house_id: 'h1', paid_on: '2026-11-12', amount: 5000, method: 'ach', method_ref: '88213', receipt_link: null, source: 'recorded', removed_at: null }
const lines: SupplyPaymentLine[] = [
  { id: 'l1', payment_id: 'p1', invoice_id: 'a', amount: 612.6 },
  { id: 'l2', payment_id: 'p1', invoice_id: 'b', amount: 2900 },
  { id: 'l3', payment_id: 'p1', invoice_id: 'c', amount: 300 },
  { id: 'l4', payment_id: 'p1', invoice_id: 'd', amount: 1000 },
]
const bills: MoveBill[] = [
  { id: 'a', invoice_number: 'S4390044', title: '214 · Hollis Street Clinic', amount: 612.6, is_paid: true, due_date: '2026-10-20' },
  { id: 'b', invoice_number: 'S4391877', title: '201 · Maple Lofts', amount: 2900, is_paid: true, due_date: '2026-10-25' },
  { id: 'c', invoice_number: 'S4402277', title: '201 · Maple Lofts', amount: 812.4, is_paid: false, due_date: '2026-10-31' },
  { id: 'd', invoice_number: 'S4393015', title: '188 · Juniper Ridge Bldg C', amount: 1000, is_paid: true, due_date: '2026-10-28' },
  { id: 'e', invoice_number: 'S4398120', title: '188 · Juniper Ridge Bldg C', amount: 1240, is_paid: false, due_date: '2026-10-15' },
  { id: 'cm', invoice_number: 'CM-1', title: '', amount: -50, is_paid: false, due_date: null },
]
const paidOnBill = (id: string): number => ({ a: 612.6, b: 2900, c: 300, d: 1000 })[id] ?? 0
const base = { payment: ach, lines, bills, paidOnBill, house: 'Pecan Supply' }
const ev = (over: Partial<SupplyPaymentEvent> & { id: string }): SupplyPaymentEvent => ({ payment_id: 'p1', kind: 'moved', from_invoice_id: 'd', to_invoice_id: 'e', from_invoice_number: 'S4393015', to_invoice_number: 'S4398120', amount: 1000, reason: 'house_applied', undoes_event_id: null, undone_by_event_id: null, actor_name: 'Dana Whitfield', created_at: '2026-11-16T15:00:00Z', ...over })

describe('where an amount can go', () => {
  it('lists the bills with something open, oldest due first, then on account', () => {
    expect(moveTargets(ach, lines, bills, paidOnBill, 'd')).toEqual([
      { id: 'e', label: 'S4398120 · 188 · Juniper Ridge Bldg C · $1,240.00 open', open: 1240 },
      { id: 'c', label: 'S4402277 · 201 · Maple Lofts · $512.40 open', open: 512.4 },
      { id: ON_ACCOUNT, label: 'On account, no bill', open: Number.POSITIVE_INFINITY },
    ])
  })

  it('offers no on account for money already there, or for a press payment', () => {
    expect(moveTargets(ach, lines, bills, paidOnBill, ON_ACCOUNT).map((t) => t.id)).toEqual(['e', 'c'])
    const press: SupplyPayment = { ...ach, id: 'pp', amount: 1000, method: null, method_ref: null, source: 'mark_paid' }
    expect(moveTargets(press, [{ id: 'x', payment_id: 'pp', invoice_id: 'd', amount: 1000 }], bills, paidOnBill, 'd').map((t) => t.id)).toEqual(['e', 'c'])
  })

  it('reads what a payment has on a bill', () => {
    expect(paymentOnBill('p1', 'd', lines)).toBe(1000)
    expect(paymentOnBill('p1', 'e', lines)).toBe(0)
  })
})

describe('the Move window', () => {
  it('says what changes on both bills, and names the press', () => {
    const p = planMove({ ...base, fromId: 'd', toId: 'e', amountText: '1000', reason: 'house_applied' })
    expect(p.max).toBe(1000)
    expect(p.reason).toBe('')
    expect(p.changes).toEqual([
      'S4393015 · paid $1,000.00 → $0.00 · open $0.00 → $1,000.00 · reads unpaid again',
      'S4398120 · paid $0.00 → $1,000.00 · open $1,240.00 → $240.00',
      'The payment still totals $5,000.00. Its day and how it was sent stay as they are.',
    ])
    expect(p.pressLabel).toBe('Move $1,000.00 to S4398120')
    expect(p.move).toEqual({ paymentId: 'p1', fromInvoiceId: 'd', toInvoiceId: 'e', amount: 1000, reason: 'house_applied' })
  })

  it('moves part of a line, and says when the bill it reaches reads paid', () => {
    const p = planMove({ ...base, fromId: 'b', toId: 'c', amountText: '512.40', reason: 'wrong_bill' })
    expect(p.changes[0]).toBe('S4391877 · paid $2,900.00 → $2,387.60 · open $0.00 → $512.40 · reads unpaid again')
    expect(p.changes[1]).toBe('S4402277 · paid $300.00 → $812.40 · open $512.40 → $0.00 · reads paid')
    expect(p.move?.amount).toBe(512.4)
  })

  it('takes money on account, and puts it on a bill from there', () => {
    const off = planMove({ ...base, fromId: 'a', toId: ON_ACCOUNT, amountText: '100', reason: 'other' })
    expect(off.changes[1]).toBe('On account with Pecan Supply · $187.40 → $287.40')
    expect(off.pressLabel).toBe('Move $100.00 on account')
    expect(off.move).toEqual({ paymentId: 'p1', fromInvoiceId: 'a', toInvoiceId: null, amount: 100, reason: 'other' })
    const on = planMove({ ...base, fromId: ON_ACCOUNT, toId: 'e', amountText: '187.40', reason: 'other' })
    expect(on.max).toBe(187.4)
    expect(on.changes[0]).toBe('On account with Pecan Supply · $187.40 → $0.00')
    expect(on.move).toEqual({ paymentId: 'p1', fromInvoiceId: null, toInvoiceId: 'e', amount: 187.4, reason: 'other' })
  })

  it('keeps the press dead with its reason', () => {
    const reasonOf = (over: Partial<Parameters<typeof planMove>[0]>) => planMove({ ...base, fromId: 'd', toId: 'e', amountText: '1000', reason: 'house_applied', ...over }).reason
    expect(reasonOf({ amountText: '' })).toBe('Type how much to move.')
    expect(reasonOf({ amountText: 'abc' })).toBe('Type an amount above zero, in dollars and cents.')
    expect(reasonOf({ amountText: '1000.01' })).toBe('Only $1,000.00 of this payment is there to move.')
    expect(reasonOf({ toId: null })).toBe('Pick the bill it goes to.')
    expect(reasonOf({ toId: 'c' })).toBe('S4402277 has $512.40 open. Move that much, or pick another bill.')
    expect(reasonOf({ reason: null })).toBe('Say why it is moving.')
    expect(reasonOf({ fromId: 'e' })).toBe('Nothing of this payment is there to move.')
    expect(planMove({ ...base, fromId: 'd', toId: null, amountText: '10', reason: null }).move).toBeNull()
  })
})

describe('what a bill reads afterwards', () => {
  const moved = ev({ id: 'e1' })
  const takenBack = ev({ id: 'e2', undone_by_event_id: 'e3' })
  const back = ev({ id: 'e3', from_invoice_id: 'e', to_invoice_id: 'd', from_invoice_number: 'S4398120', to_invoice_number: 'S4393015', reason: 'undo', undoes_event_id: 'e2' })
  const toAccount = ev({ id: 'e4', from_invoice_id: 'a', to_invoice_id: null, from_invoice_number: 'S4390044', to_invoice_number: null, amount: 100, reason: 'other' })

  it('says where the money went on one bill, and where it came from on the other', () => {
    expect(billMoveTrace('d', [moved])).toEqual(['$1,000.00 moved to S4398120 · Dana · the house applied it differently'])
    expect(billMoveTrace('e', [moved])).toEqual(['$1,000.00 moved here from S4393015 · Dana'])
    expect(billMoveTrace('a', [toAccount])).toEqual(['$100.00 moved on account · Dana'])
    expect(billMoveTrace('b', [moved, toAccount])).toEqual([])
  })

  it('says nothing about a move that was taken back', () => {
    expect(standingMoves([moved, takenBack, back]).map((e) => e.id)).toEqual(['e1'])
    expect(billMoveTrace('d', [takenBack, back])).toEqual([])
  })

  it('lists a payment’s history newest first, with what can still be taken back', () => {
    const removed = ev({ id: 'e5', kind: 'removed', from_invoice_id: null, to_invoice_id: null, from_invoice_number: null, to_invoice_number: null, amount: 5000, reason: 'typed twice', created_at: '2026-11-17T15:00:00Z' })
    const restored = ev({ id: 'e6', kind: 'restored', from_invoice_id: null, to_invoice_id: null, from_invoice_number: null, to_invoice_number: null, amount: 5000, reason: 'typed twice', created_at: '2026-11-18T15:00:00Z' })
    const day = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
    const dayOf = (iso: string) => iso.slice(0, 10)
    expect(paymentHistory('p1', [moved, { ...takenBack, created_at: '2026-11-15T15:00:00Z' }, { ...back, created_at: '2026-11-15T16:00:00Z' }, removed, restored, ev({ id: 'other', payment_id: 'p2' })], day, dayOf)).toEqual([
      { id: 'e6', words: 'Put back 11/18 · Dana', canUndo: false },
      { id: 'e5', words: 'Removed 11/17 · Dana · typed twice', canUndo: false },
      { id: 'e1', words: 'Moved $1,000.00 from S4393015 to S4398120 · 11/16 · Dana · the house applied it differently', canUndo: true },
      { id: 'e3', words: 'Moved back $1,000.00 from S4398120 to S4393015 · 11/15 · Dana', canUndo: false },
      { id: 'e2', words: 'Moved $1,000.00 from S4393015 to S4398120 · 11/15 · Dana · the house applied it differently · taken back', canUndo: false },
    ])
  })
})

describe('payments removed lately', () => {
  it('lists the ones removed in the last 30 days, newest first, with who and why', () => {
    const now = Date.parse('2026-11-20T12:00:00Z')
    const day = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
    const dayOf = (iso: string) => iso.slice(0, 10)
    const rows = removedLately(
      [
        { ...ach, removed_at: '2026-11-16T15:00:00Z', removed_by_name: 'Dana Whitfield', removed_reason: 'typed twice' },
        { ...ach, id: 'old', removed_at: '2026-10-01T15:00:00Z' },
        { ...ach, id: 'live' },
        { ...ach, id: 'press', amount: 75, method: null, method_ref: null, removed_at: '2026-11-19T15:00:00Z' },
      ],
      now,
      day,
      dayOf,
    )
    expect(rows.map((r) => [r.payment.id, r.words])).toEqual([
      ['press', '$75.00 payment of 11/12 · removed 11/19'],
      ['p1', '$5,000.00 ACH 88213 payment of 11/12 · removed 11/16 · Dana · typed twice'],
    ])
  })
})
