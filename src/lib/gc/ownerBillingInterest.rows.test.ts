/**
 * The interest bill as its rows (v2.6158, punch list #217 outside-5): each late bill, its days late and its interest,
 * from the kernel's own reading, so the email's sum is one a stranger can check row by row.
 */
import { describe, expect, it } from 'vitest'
import { ownerPayAppsSent } from './ownerBilling'
import {
  INTEREST_MONTH_DAYS,
  INTEREST_TABLE_HEAD,
  interestRowCells,
  interestRowNotes,
  interestRowOf,
  interestRows,
  interestRowsTotal,
  interestSumCells,
  ownerInterestOnBill,
  straightInterestRow,
} from './ownerBillingInterest'
import { initialGcState } from './schedule/testState'

const cents = (n: number) => Math.round(n * 100) / 100

describe('interestRows · the late bills as rows', () => {
  it('reads one row per late bill off the job: the day it fell due, open, the days, what was open and the interest', () => {
    const s = initialGcState()
    // Pay application 3 went Sep 25 with 5 days to pay: due Sep 30, two days late on Oct 2, still open.
    const p = { ...s.projects.find((x) => x.id === 'fairoaksd')!, ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: 5 }
    // Pay applications 1 and 2 were paid 33 and 32 days past their contract day too: three rows, oldest first.
    const rows = interestRows(s, p)
    expect(rows.map((r) => [r.number, r.bill, r.dueOn, r.paidOn, r.days, r.straight])).toEqual([
      [1, 'Pay application 1', '2026-07-30', '2026-09-01', 33, true],
      [2, 'Pay application 2', '2026-08-30', '2026-10-01', 32, true],
      [3, 'Pay application 3', '2026-09-30', null, 2, true],
    ])
    const r = rows[2]!
    expect(cents(r.amount)).toBe(284.92)
    expect(cents(r.monthly)).toBe(cents((r.open * 1.5) / 100))
    // The row's sum is the kernel's figure: a month's interest × the days ÷ a twelfth of a year.
    expect(cents((r.monthly * r.days) / INTEREST_MONTH_DAYS)).toBe(284.92)
    expect(cents(interestRowsTotal(rows))).toBe(cents(rows[0]!.amount + rows[1]!.amount + 284.92))
  })

  it('is empty on a job that charges no interest, and on one whose days to pay are not typed', () => {
    const s = initialGcState()
    const p = s.projects.find((x) => x.id === 'fairoaksd')!
    expect(interestRows(s, p)).toEqual([])
    expect(interestRows(s, { ...p, ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: null })).toEqual([])
  })

  it('marks a bill paid in parts, whose interest ran on what stayed open, and names it under the table', () => {
    const s = initialGcState()
    const p = { ...s.projects.find((x) => x.id === 'fairoaksd')!, ownerLateInterest: { pctPerMonth: 1.5 }, ownerPayDays: 5 }
    const app = ownerPayAppsSent(p)[2]!
    const half = Math.round(app.due / 2)
    const parted = { ...app, payments: [{ on: '2026-10-01', amount: half }] }
    const bill = ownerInterestOnBill(s, p, parted, 1.5)!
    const row = interestRowOf(bill, 1.5)
    expect([row.straight, row.open]).toEqual([false, app.due])
    expect(interestRowCells(row)[5]).toBe(`$${Math.round(row.amount).toLocaleString('en-US')}`)
    expect(interestRowNotes([row])).toEqual(['Pay application 3 was paid in parts. Its interest ran on what stayed open each day.'])
    expect(interestRowNotes([interestRowOf(ownerInterestOnBill(s, p, app, 1.5)!, 1.5)])).toEqual([])
  })

  it('writes a made-up row with the same arithmetic as a real one: $45,000 at 1.5% is $675 a month, 32 days late is $710', () => {
    const row = straightInterestRow({ number: 2, dueOn: '2026-09-01', paidOn: '2026-10-03', open: 45_000, pctPerMonth: 1.5, today: '2026-10-30' })
    expect([row.bill, row.days, row.monthly, cents(row.amount), row.straight]).toEqual(['Pay application 2', 32, 675, 710.14, true])
    const open = straightInterestRow({ number: 3, dueOn: '2026-10-02', paidOn: null, open: 39_400, pctPerMonth: 1.5, today: '2026-10-30' })
    expect([open.days, open.paidOn, cents(open.amount)]).toEqual([28, null, 544.04])
    expect(straightInterestRow({ number: 4, final: true, dueOn: '2026-10-02', paidOn: null, open: 10, pctPerMonth: 1.5, today: '2026-10-02' })).toMatchObject({ bill: 'The final pay application', days: 0, amount: 0 })
  })

  it('reads each row as cells under one head, the sum to redo in the last cell, and the total under a rule', () => {
    const rows = [
      straightInterestRow({ number: 2, dueOn: '2026-09-01', paidOn: '2026-10-03', open: 45_000, pctPerMonth: 1.5, today: '2026-10-30' }),
      straightInterestRow({ number: 3, dueOn: '2026-10-02', paidOn: null, open: 39_400, pctPerMonth: 1.5, today: '2026-10-30' }),
    ]
    expect(INTEREST_TABLE_HEAD).toEqual(['Bill', 'Due', 'Paid', 'Days late', 'Open', 'Interest'])
    expect(interestRowCells(rows[0]!)).toEqual(['Pay application 2', 'Sep 1', 'Oct 3', '32', '$45,000', '$675 × 32⁄30.4 = $710'])
    expect(interestRowCells(rows[1]!)).toEqual(['Pay application 3', 'Oct 2', 'open', '28', '$39,400', '$591 × 28⁄30.4 = $544'])
    expect(interestSumCells(rows)).toEqual(['Interest to today', '', '', '', '', '$1,254'])
  })
})
