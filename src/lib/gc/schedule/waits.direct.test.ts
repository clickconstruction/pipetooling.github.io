/**
 * Main's own tests for what the work waits on from outside the trades (G-73 to G-75; the schedule's
 * PR 1b): where a wait stands, its next step in its kind's words, the next one's id, and the open
 * and late ones counted, run through the kernels on the test data. The spike's own cases: on Fair
 * Oaks D, today Fri Oct 2, the rooftop units (fhvac-1) start Oct 12. A wait is kept as the office
 * adds it; the spike's reducer tests add it.
 */
import { describe, expect, it } from 'vitest'
import type { GcState } from '../types'
import { initialGcState } from './testState'
import type { ScheduleWait } from './types'
import { nextWaitId, waitCounts, waitNextStep, waitState } from './waits'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
/** The job with only these waits. */
function withWaits(...waits: ScheduleWait[]): GcState {
  const s = initialGcState()
  return { ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, waits } : p)) }
}
/** The rooftop units from Carrier, ordered Sep 1 and expected Oct 20, 8 days after the work needs them. */
const UNITS: ScheduleWait = { id: 'fairoaksd-wait-1', kind: 'delivery', title: 'Rooftop units', packageId: 'fhvac', who: 'Carrier', lineIds: ['fhvac-1'], askedOn: '2026-09-01', expectedOn: '2026-10-20', shippedOn: null, doneOn: null }
/** CPS Energy's transformer, the job's own, expected Oct 15. */
const TRANSFORMER: ScheduleWait = { id: 'fairoaksd-wait-2', kind: 'utility', title: 'The transformer', packageId: null, who: 'CPS Energy', lineIds: ['felec-5'], askedOn: null, expectedOn: '2026-10-15', doneOn: null }

describe('where a wait stands, and its next step in its kind’s words', () => {
  it('walks a delivery from ordered to shipped to on site', () => {
    expect([waitState({ ...UNITS, askedOn: null }), waitNextStep({ ...UNITS, askedOn: null })]).toEqual(['notAsked', { step: 'asked', label: 'Ordered' }])
    expect([waitState(UNITS), waitNextStep(UNITS)]).toEqual(['asked', { step: 'shipped', label: 'Shipped' }])
    const shipped = { ...UNITS, shippedOn: '2026-10-02' }
    expect([waitState(shipped), waitNextStep(shipped)]).toEqual(['shipped', { step: 'done', label: 'On site' }])
    const done = { ...shipped, doneOn: '2026-10-02' }
    expect([waitState(done), waitNextStep(done)]).toEqual(['done', null])
  })

  it('takes a permit from applied for to issued, and a decision and the utility to theirs', () => {
    const permit: ScheduleWait = { id: 'fairoaksd-wait-1', kind: 'permit', title: 'Electrical service permit', packageId: 'felec', who: 'the city', lineIds: ['felec-4'], askedOn: null, expectedOn: '2026-10-30', doneOn: null }
    expect(waitNextStep(permit)).toEqual({ step: 'asked', label: 'Applied for' })
    expect(waitNextStep({ ...permit, askedOn: '2026-10-02' })).toEqual({ step: 'done', label: 'Issued' })
    expect(waitNextStep({ ...permit, kind: 'decision', askedOn: '2026-10-02' })).toEqual({ step: 'done', label: 'Decided' })
    expect(waitNextStep({ ...TRANSFORMER, askedOn: '2026-10-02' })).toEqual({ step: 'done', label: 'Done' })
  })
})

describe('the job’s waits counted, and the next one’s id', () => {
  it('counts the open ones and the late ones, and numbers the next one', () => {
    const s = withWaits(UNITS, TRANSFORMER)
    expect(nextWaitId(job(s))).toBe('fairoaksd-wait-3')
    expect(waitCounts(s, job(s))).toEqual({ open: 2, late: 1 })
    const unitsIn = withWaits({ ...UNITS, shippedOn: '2026-10-01', doneOn: '2026-10-02' }, TRANSFORMER)
    expect(waitCounts(unitsIn, job(unitsIn))).toEqual({ open: 1, late: 0 })
    expect(nextWaitId(job(withWaits()))).toBe('fairoaksd-wait-1')
  })

  it('reads the made-up job’s three: a delivery coming late, the utility, a decision the customer owes', () => {
    const s = initialGcState()
    expect(waitCounts(s, job(s))).toEqual({ open: 3, late: 1 })
  })
})
