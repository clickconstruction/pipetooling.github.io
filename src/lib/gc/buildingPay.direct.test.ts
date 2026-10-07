/**
 * Main's own tests for the draws to pay (the Building lane's U2), run on the test data. Fair Oaks D
 * has no approved draw unpaid on today Fri Oct 2, so each case approves its own: a draw is paid
 * within 10 days of its approval (PAY_WITHIN_DAYS).
 */
import { describe, expect, it } from 'vitest'
import { drawsToPay } from './buildingPay'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const ID = 'fairoaksd'
const fairOaks = (s: GcState) => s.projects.find((p) => p.id === ID)!

describe('the draws to pay', () => {
  it('lists every approved draw not paid yet, the late one first', () => {
    const s = initialGcState()
    expect(drawsToPay(s, fairOaks(s))).toEqual([])
    const approved: GcState = {
      ...s,
      projects: s.projects.map((p) =>
        p.id !== ID
          ? p
          : {
              ...p,
              packages: p.packages.map((k) => {
                if (!k.sow) return k
                const when = k.id === 'fsteel' ? '2026-10-01' : k.id === 'felec' ? '2026-09-20' : null
                return when ? { ...k, sow: { ...k.sow, draws: k.sow.draws.map((d) => (d.number === 2 ? { ...d, status: 'approved' as const, approvedOn: when } : d)) } } : k
              }),
            },
      ),
    }
    expect(drawsToPay(approved, fairOaks(approved)).map((d) => [d.company, d.draw.id, d.payBy, d.daysLate])).toEqual([
      ['Pecan Valley Electric', 'felec-draw-2', '2026-09-30', 2],
      ['Iron Horse Fabrication', 'fsteel-draw-2', '2026-10-11', 0],
    ])
  })
})
