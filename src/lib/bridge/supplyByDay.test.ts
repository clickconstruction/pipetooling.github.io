import { describe, expect, it } from 'vitest'
import { buildNetPositionHistory } from './netPosition'
import { supplyDueByDay, supplyPaidByDayFromLines } from './supplyByDay'

// Every amount here is made up.

describe('supplyDueByDay', () => {
  it('counts what is left on a bill paid in part, not its whole amount', () => {
    const due = supplyDueByDay([{ amount: 812.4, amount_paid: 300, is_paid: false, due_date: '2026-11-20' }])
    expect(due.get('2026-11-20')).toBeCloseTo(512.4)
  })

  it('adds the bills due on one day and keeps the days apart', () => {
    const due = supplyDueByDay([
      { amount: 812.4, amount_paid: 300, due_date: '2026-11-20' },
      { amount: 100, amount_paid: 0, due_date: '2026-11-20' },
      { amount: 40, due_date: '2026-11-25' },
    ])
    expect(due.get('2026-11-20')).toBeCloseTo(612.4)
    expect(due.get('2026-11-25')).toBeCloseTo(40)
    expect(due.size).toBe(2)
  })

  it('counts a row read without amount_paid whole, as it always did', () => {
    expect(supplyDueByDay([{ amount: 250, due_date: '2026-11-20' }]).get('2026-11-20')).toBe(250)
  })

  it('takes what is left of a credit memo, below zero, off the day', () => {
    const due = supplyDueByDay([
      { amount: 200, amount_paid: 0, due_date: '2026-11-20' },
      { amount: -90, amount_paid: -40, due_date: '2026-11-20' },
    ])
    expect(due.get('2026-11-20')).toBeCloseTo(150)
  })

  it('adds no day for a bill with nothing left, a paid one, or one with no due day', () => {
    const due = supplyDueByDay([
      { amount: 120, amount_paid: 120, is_paid: false, due_date: '2026-11-20' },
      { amount: 75, amount_paid: 0, is_paid: true, due_date: '2026-11-21' },
      { amount: 0, due_date: '2026-11-22' },
      { amount: 60, due_date: null },
    ])
    expect(due.size).toBe(0)
  })
})

describe('supplyPaidByDayFromLines', () => {
  const win = { windowStart: '2026-11-01', todayYmd: '2026-11-17' }

  it('lands a bill paid in two parts on its two days', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [
        { amount: 300, paid_on: '2026-11-05' },
        { amount: 512.4, paid_on: '2026-11-12' },
      ],
    })
    expect(paid.get('2026-11-05')).toBeCloseTo(300)
    expect(paid.get('2026-11-12')).toBeCloseTo(512.4)
    expect(paid.size).toBe(2)
  })

  it('counts a removed payment nowhere', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [
        { amount: 300, paid_on: '2026-11-05', removed_at: '2026-11-06T15:00:00Z' },
        { amount: 80, paid_on: '2026-11-05', removed_at: null },
      ],
    })
    expect(paid.get('2026-11-05')).toBeCloseTo(80)
  })

  it('adds the lines of one day, a credit memo used on a payment below zero', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [
        { amount: 500, paid_on: '2026-11-10' },
        { amount: -90, paid_on: '2026-11-10' },
        { amount: 25.5, paid_on: '2026-11-10' },
      ],
    })
    expect(paid.get('2026-11-10')).toBeCloseTo(435.5)
  })

  it('keeps to the window, both ends counted', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [
        { amount: 10, paid_on: '2026-10-31' },
        { amount: 20, paid_on: '2026-11-01' },
        { amount: 30, paid_on: '2026-11-17' },
        { amount: 40, paid_on: '2026-11-18' },
        { amount: 50, paid_on: null },
      ],
    })
    expect([...paid]).toEqual([
      ['2026-11-01', 20],
      ['2026-11-17', 30],
    ])
  })

  it('takes a credit memo marked used by hand on its paid day: it has no line', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [{ amount: 200, paid_on: '2026-11-10' }],
      // Noon Central on the 10th.
      byHand: [{ amount: -90, amount_paid: 0, paid_at: '2026-11-10T18:00:00Z' }],
    })
    expect(paid.get('2026-11-10')).toBeCloseTo(110)
  })

  it('takes only what the lines do not cover from a paid bill, so a bill its payments paid adds nothing twice', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [{ amount: 812.4, paid_on: '2026-11-12' }],
      byHand: [
        { amount: 812.4, amount_paid: 812.4, paid_at: '2026-11-12T18:00:00Z' },
        // A credit memo a payment used for part, then marked used by hand for the rest.
        { amount: -90, amount_paid: -40, paid_at: '2026-11-14T18:00:00Z' },
        { amount: -15, amount_paid: 0, paid_at: null },
      ],
    })
    expect(paid.get('2026-11-12')).toBeCloseTo(812.4)
    expect(paid.get('2026-11-14')).toBeCloseTo(-50)
    expect(paid.size).toBe(2)
  })

  it('reads a paid stamp by the company day, not the UTC day', () => {
    const paid = supplyPaidByDayFromLines({
      ...win,
      lines: [],
      // 03:30 UTC on the 11th is still the evening of the 10th in Texas.
      byHand: [{ amount: -60, amount_paid: 0, paid_at: '2026-11-11T03:30:00Z' }],
    })
    expect(paid.get('2026-11-10')).toBeCloseTo(-60)
  })
})

describe('the net position, over a bill paid in part', () => {
  it('lowers what is owed on each payment day, where the bill’s own paid day showed nothing until the last', () => {
    // An $812.40 bill dated the 3rd, $300.00 paid on the 5th, still $512.40 open today.
    const supplyPaidByDay = supplyPaidByDayFromLines({ windowStart: '2026-11-01', todayYmd: '2026-11-06', lines: [{ amount: 300, paid_on: '2026-11-05' }] })
    const h = buildNetPositionHistory({
      todayYmd: '2026-11-06',
      daysBack: 4,
      cashTodayUsd: 0,
      arTodayUsd: 0,
      apTodayUsd: 512.4,
      bankFlowByDay: new Map(),
      invoicesSentByDay: new Map(),
      paymentsReceivedByDay: new Map(),
      supplyDatedByDay: new Map([['2026-11-03', 812.4]]),
      supplyPaidByDay,
    })
    const ap = Object.fromEntries(h.map((d) => [d.ymd, Math.round(d.apUsd * 100) / 100]))
    expect(ap).toEqual({ '2026-11-02': 0, '2026-11-03': 812.4, '2026-11-04': 812.4, '2026-11-05': 512.4, '2026-11-06': 512.4 })
  })
})
