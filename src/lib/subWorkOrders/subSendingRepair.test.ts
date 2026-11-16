import { describe, expect, it } from 'vitest'
import { overToCreditPlan, type OverPayment } from './subSendingRepair'

// Made-up money.
const pay = (id: string, amount: number, day: string, o: Partial<OverPayment> = {}): OverPayment => ({ id, amount, dayWords: day, fromCredit: false, carriesCredit: false, at: `2026-10-${id}`, ...o })

describe('overToCreditPlan — a sheet paid past its total becomes a credit', () => {
  const sheet = { label: '2033 Alder Court Remodel', total: 300, paid: 350, over: 50 }
  const sub = { personId: 'harlan', name: 'Harlan Mechanical' }
  it('the newest payment carries it, and what left the bank does not change', () => {
    const p = overToCreditPlan(sheet, [pay('01', 100, 'Oct 1'), pay('03', 250, 'Oct 3')], sub)
    expect(p).toMatchObject({ ok: true, over: 50, paymentId: '03', before: 250, after: 200, confirmLabel: 'Keep $50.00 as their credit' })
    expect(p.ok && p.words).toEqual([
      '2033 Alder Court Remodel comes to $300.00 and $350.00 was paid on it: $50.00 over.',
      "The payment of Oct 3 reads $200.00 on this sheet and $50.00 kept as Harlan Mechanical's credit.",
      '$250.00 left the bank, as before. The sheet reads paid in full, and the next payment to Harlan Mechanical offers the credit first.',
    ])
    expect(p.ok && p.after + p.over).toBe(250)
  })
  it('skips a payment made from a credit, one that already carries a credit, and one too small to carry it', () => {
    const p = overToCreditPlan(sheet, [pay('01', 200, 'Oct 1'), pay('02', 100, 'Oct 2', { carriesCredit: true }), pay('03', 30, 'Oct 3'), pay('04', 80, 'Oct 4', { fromCredit: true })], sub)
    expect(p).toMatchObject({ ok: true, paymentId: '01', after: 150 })
  })
  it('refuses with the reason', () => {
    expect(overToCreditPlan({ ...sheet, over: 0 }, [], sub)).toMatchObject({ ok: false, reason: 'not_over' })
    expect(overToCreditPlan(sheet, [pay('01', 350, 'Oct 1')], { personId: null, name: 'Harlan Mechanical' })).toMatchObject({ ok: false, reason: 'no_person', error: 'A credit needs the sub on the roster as one person. Link the sheet to one sub first.' })
    expect(overToCreditPlan(sheet, [pay('01', 50, 'Oct 1')], sub)).toMatchObject({ ok: false, reason: 'no_payment' })
  })
})
