/**
 * GC mode — design spike: when we pay a trade's draw (gcBuildingPay.ts). An approved draw is paid
 * within PAY_WITHIN_DAYS of approval; late is counted against the day it was paid, or today.
 */
import { describe, expect, it } from 'vitest'
import { drawPayDays, drawsToPay, gcReducer, initialGcState, PAY_WITHIN_DAYS, stageProgress, type GcState } from './gcModel'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}
const steel = (s: GcState) => {
  const pkg = fairOaks(s).packages.find((k) => k.id === 'fsteel')
  const draw = pkg?.sow?.draws.find((d) => d.number === 2)
  if (!pkg || !draw) throw new Error('no steel draw 2')
  return { pkg, draw }
}
const approved = gcReducer(initialGcState(), { type: 'approveDraw', projectId: 'fairoaksd', packageId: 'fsteel', drawId: steel(initialGcState()).draw.id })

describe('when we pay a draw', () => {
  it('pays within 10 days of approval', () => {
    expect(PAY_WITHIN_DAYS).toBe(10)
    const { pkg, draw } = steel(approved)
    expect(drawPayDays(fairOaks(approved), pkg, draw, approved.today)).toEqual({ approvedOn: '2026-10-02', payBy: '2026-10-12', paidOn: null, daysLate: 0 })
  })

  it('has no pay-by day while it waits on us', () => {
    const s = initialGcState()
    const { pkg, draw } = steel(s)
    expect(drawPayDays(fairOaks(s), pkg, draw, s.today)).toEqual({ approvedOn: null, payBy: null, paidOn: null, daysLate: 0 })
  })

  it('reads a paid draw against its pay-by day', () => {
    const s = initialGcState()
    const pkg = fairOaks(s).packages.find((k) => k.id === 'fsteel')
    const first = pkg?.sow?.draws.find((d) => d.number === 1)
    if (!pkg || !first) throw new Error('no steel draw 1')
    expect(drawPayDays(fairOaks(s), pkg, first, s.today)).toEqual({ approvedOn: '2026-08-23', payBy: '2026-09-02', paidOn: '2026-08-30', daysLate: 0 })
  })

  it('lists what to pay, late first, and counts the days late until it is paid', () => {
    expect(drawsToPay(approved, fairOaks(approved)).map((d) => [d.company, d.payBy, d.daysLate])).toEqual([['Iron Horse Fabrication', '2026-10-12', 0]])
    const later: GcState = { ...approved, today: '2026-10-15' }
    expect(drawsToPay(later, fairOaks(later))[0]?.daysLate).toBe(3)
    const paid = gcReducer(later, { type: 'payDraw', projectId: 'fairoaksd', packageId: 'fsteel', drawId: steel(later).draw.id })
    expect(drawsToPay(paid, fairOaks(paid))).toEqual([])
    const { pkg, draw } = steel(paid)
    expect(drawPayDays(fairOaks(paid), pkg, draw, '2026-10-30')).toMatchObject({ paidOn: '2026-10-15', daysLate: 3 })
  })

  it("says when to pay on the board's ring card, and puts a late one first after the schedule", () => {
    expect(stageProgress(approved, fairOaks(approved)).also).toContain('Draw 2 for Iron Horse Fabrication is approved. Pay it by Oct 12.')
    const later: GcState = { ...approved, today: '2026-10-15' }
    const also = stageProgress(later, fairOaks(later)).also
    expect(also[0]).toMatch(/^The schedule:/)
    // After the schedule and the inspection that failed, before the rest.
    expect(also[1]).toMatch(/^The electrical service inspection failed/)
    expect(also[2]).toBe('Draw 2 for Iron Horse Fabrication is 3 days late to pay. It was due Oct 12.')
  })
})
