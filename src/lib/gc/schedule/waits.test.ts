/**
 * The tests of `gcScheduleWaits.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './testState'
import { customerDecisions, waitHolds, waitRows, waitWhoDefault } from './waits'
import type { GcState } from '../types'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026. The rooftop units (fhvac-1) start Oct 12; the roof curbs (froof-4) Oct 5. */
const ID = 'fairoaksd'

const job = (state: GcState) => state.projects.find((p) => p.id === ID)!

describe('what the work waits on (G-73 to G-75)', () => {
  it('the made-up job has three: a delivery coming late, a decision the customer owes, the utility', () => {
    const state = initialGcState()
    const rows = waitRows(state, job(state))
    expect(rows.map((r) => [r.wait.kind, r.wait.title, r.state, r.late])).toEqual([
      ['delivery', 'Rooftop units', 'asked', true],
      ['utility', 'The transformer', 'asked', false],
      ['decision', 'the restroom tile', 'asked', false],
    ])
    expect(waitHolds(state, job(state)).get('fhvac-1')?.words).toBe('Rooftop units, expected Oct 20, 8 days after this starts')
    expect(customerDecisions(job(state))[0]?.words).toBe('Your decision on the restroom tile, needed by Mon Nov 30: Trim waits on it.')
  })

  it('knows who we usually wait on', () => {
    const state = initialGcState()
    expect(waitWhoDefault(state, job(state), 'delivery', 'fhvac')).toBe("Cool Breeze Mechanical's supplier")
    expect(waitWhoDefault(state, job(state), 'decision', null)).toBe('Cibolo Creek Partners')
    expect(waitWhoDefault(state, job(state), 'permit', null)).toBe('City of Boerne')
  })
})
