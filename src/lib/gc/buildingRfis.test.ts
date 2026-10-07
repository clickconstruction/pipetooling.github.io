/**
 * The tests of `gcBuildingRfis.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Building lane's U2). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { rfiCounts, rfiNeededBy, rfiRows } from './buildingRfis'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fair = (state: GcState) => {
  const p = state.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('questions about the plans while we build (RFIs; the owner, 2026-10-05)', () => {
  it('lists the open ones first, the most urgent first, then the answered ones, newest first', () => {
    const state = initialGcState()
    expect(rfiRows(state, fair(state)).map((r) => [r.label, r.stateWords, r.needed, r.neededTone, r.askedBy, r.holds.map((h) => h.name)])).toEqual([
      ['RFI-004', 'waiting on us', 'needed today', 'red', 'Summit Roofing', ['Roofing · Roof curbs']],
      ['RFI-003', 'with the architect', 'needed by Fri Oct 9', 'grey', 'Cool Breeze Mechanical', ['HVAC · Rooftop units']],
      ['RFI-002', 'answered', null, 'grey', 'Summit Roofing', ['Roofing · TPO membrane']],
      ['RFI-001', 'answered', null, 'grey', 'Our superintendent', ['Concrete · Sidewalks and curbs']],
    ])
    expect(rfiCounts(state, fair(state))).toEqual({ us: 1, architect: 1, answered: 2, dueNow: 1 })
    // Needed 3 days before the first work it holds starts: the curbs on Mon Oct 5.
    const curb = fair(state).rfis?.find((r) => r.number === 4)
    if (!curb) throw new Error('no RFI-004')
    expect(rfiNeededBy(state, fair(state), curb)).toBe('2026-10-02')
  })

  it('reads late once its day passes', () => {
    const state = { ...initialGcState(), today: '2026-10-05' }
    expect(rfiRows(state, fair(state))[0]).toMatchObject({ label: 'RFI-004', needed: '3 days late', late: true })
  })
})
