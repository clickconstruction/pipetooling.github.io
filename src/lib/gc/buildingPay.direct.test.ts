/**
 * Main's own tests for the draws to pay (the Building lane's U2), run on the test data. Fair Oaks D
 * has no approved draw unpaid on today Fri Oct 2, so each case approves its own: a draw is due
 * 10 days after the customer pays the bill it rode on (PAY_WITHIN_DAYS, `drawPayClock.ts`). Its bills
 * went Jul 25 (paid Sep 1), Aug 25 (paid Oct 1) and Sep 25 (not paid).
 */
import { describe, expect, it } from 'vitest'
import { drawsToPay } from './buildingPay'
import { cashMoves } from './ownerBillingAhead'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const ID = 'fairoaksd'
const fairOaks = (s: GcState) => s.projects.find((p) => p.id === ID)!

describe('the draws to pay', () => {
  const approve = (s: GcState, days: Record<string, string>): GcState => ({
    ...s,
    projects: s.projects.map((p) =>
      p.id !== ID
        ? p
        : {
            ...p,
            packages: p.packages.map((k) => {
              const when = k.sow ? days[k.id] : undefined
              return k.sow && when ? { ...k, sow: { ...k.sow, draws: k.sow.draws.map((d) => (d.number === 2 ? { ...d, status: 'approved' as const, approvedOn: when } : d)) } } : k
            }),
          },
    ),
  })
  const rows = (s: GcState) => drawsToPay(s, fairOaks(s)).map((d) => [d.company, d.draw.id, d.payBy, d.waitsOn, d.daysLate])

  it('lists every approved draw not paid yet, the late one first', () => {
    const s = initialGcState()
    expect(drawsToPay(s, fairOaks(s))).toEqual([])
    // Electric's rode on the Jul 25 bill, paid Sep 1: due Sep 11, 21 days ago. Steel's has no bill behind it yet.
    expect(rows(approve(s, { fsteel: '2026-10-01', felec: '2026-07-20' }))).toEqual([
      ['Pecan Valley Electric', 'felec-draw-2', '2026-09-11', null, 21],
      ['Iron Horse Fabrication', 'fsteel-draw-2', null, 'ourBill', 0],
    ])
  })

  it('has no day, and is never late, while the customer has not paid the bill it rode on', () => {
    const s = initialGcState()
    // Approved Sep 20, it rode on the Sep 25 bill, which the customer has not paid. The old rule made it 2 days late.
    expect(rows(approve(s, { felec: '2026-09-20' }))).toEqual([['Pecan Valley Electric', 'felec-draw-2', null, 'customer', 0]])
  })
})

describe('an approved draw in the weeks of money', () => {
  it('counts ten days after the day the customer should pay the bill it rode on', () => {
    const s = initialGcState()
    const approved: GcState = {
      ...s,
      projects: s.projects.map((p) =>
        p.id !== ID ? p : { ...p, packages: p.packages.map((k) => (k.id === 'felec' && k.sow ? { ...k, sow: { ...k.sow, draws: k.sow.draws.map((d) => (d.number === 2 ? { ...d, status: 'approved' as const, approvedOn: '2026-09-20' } : d)) } } : k)) },
      ),
    }
    const move = cashMoves(approved).find((m) => m.who === 'Pecan Valley Electric' && m.number === 2)
    // It rode on the Sep 25 bill, which the customer has not paid. That bill's day is Sep 30, so the draw counts Oct 10.
    expect([move?.why, move?.on, move?.dir]).toEqual(['afterCustomer', '2026-10-10', 'out'])
  })
})
