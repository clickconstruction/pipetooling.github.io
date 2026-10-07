/**
 * The tests of `gcBuildingPay.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Building lane's U2). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { drawPayDays } from './buildingPay'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

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

describe('when we pay a draw', () => {
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
})
