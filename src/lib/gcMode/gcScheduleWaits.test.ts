import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import type { GcState } from './gcTypes'
import { customerAsks } from './gcCustomerSchedule'
import { customerDecisions, nextWaitId, waitCounts, waitHolds, waitNextStep, waitRows, waitWhoDefault } from './gcScheduleWaits'

/** Fair Oaks Shops, Building D, today Fri Oct 2 2026. The rooftop units (fhvac-1) start Oct 12; the roof curbs (froof-4) Oct 5. */
const ID = 'fairoaksd'
const job = (state: GcState) => state.projects.find((p) => p.id === ID)!
/** The job with the made-up waits taken off, so each test adds its own. */
const bare = (): GcState => {
  const s = initialGcState()
  return { ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, waits: [] } : p)) }
}

function withUnits(expectedOn: string, from = bare()): GcState {
  return gcReducer(from, { type: 'addScheduleWait', projectId: ID, kind: 'delivery', title: 'Rooftop units', packageId: 'fhvac', who: 'Carrier', lineIds: ['fhvac-1', 'nope'], expectedOn, askedOn: '2026-09-01' })
}

describe('what the work waits on (G-73 to G-75)', () => {
  it('puts a delivery on the schedule, tied to the work that needs it, and keeps only lines the chart has', () => {
    const state = withUnits('2026-10-20')
    const [row] = waitRows(state, job(state))
    expect(row?.wait).toMatchObject({ id: 'fairoaksd-wait-1', kind: 'delivery', who: 'Carrier', lineIds: ['fhvac-1'], askedOn: '2026-09-01', shippedOn: null, doneOn: null })
    expect(row?.state).toBe('asked')
    expect(row?.stateWords).toBe('ordered Sep 1')
    expect(row?.neededBy).toBe('2026-10-12')
    expect(row?.daysLate).toBe(8)
    expect(row?.late).toBe(true)
    expect(row?.words).toBe('Expected Tue Oct 20 from Carrier, 8 days after HVAC · Rooftop units starts.')
    expect(row?.nextStep).toEqual({ step: 'shipped', label: 'Shipped' })
    expect(state.log[0]?.text).toBe("Rooftop units is on Fair Oaks Shops, Building D's schedule: a delivery, expected Tue Oct 20 from Carrier, holding 1 activity.")
  })

  it('holds the work when it comes on or after the start, or its day passed; not when it comes in time', () => {
    const late = withUnits('2026-10-20')
    expect(waitHolds(late, job(late)).get('fhvac-1')).toEqual({ kind: 'delivery', words: 'Rooftop units, expected Oct 20, 8 days after this starts', late: true })
    const onTheDay = withUnits('2026-10-12')
    expect(waitHolds(onTheDay, job(onTheDay)).get('fhvac-1')).toEqual({ kind: 'delivery', words: 'Rooftop units, expected Oct 12, the day this starts', late: false })
    const passed = withUnits('2026-09-28')
    expect(waitHolds(passed, job(passed)).get('fhvac-1')).toEqual({ kind: 'delivery', words: 'Rooftop units, expected Sep 28 and not in', late: true })
    expect(waitRows(passed, job(passed))[0]?.words).toBe('Expected Sep 28 from Carrier, and not in, 14 days before HVAC · Rooftop units starts.')
    const early = withUnits('2026-10-05')
    expect(waitHolds(early, job(early)).size).toBe(0)
    expect(waitRows(early, job(early))[0]?.tone).toBe('grey')
  })

  it('walks the steps in each kind’s words, and the hold lifts when it is in', () => {
    let state = withUnits('2026-10-20')
    state = gcReducer(state, { type: 'setScheduleWaitStep', projectId: ID, waitId: 'fairoaksd-wait-1', step: 'shipped', on: '2026-10-02' })
    expect(waitRows(state, job(state))[0]?.stateWords).toBe('shipped Oct 2')
    expect(waitNextStep(job(state).waits![0]!)).toEqual({ step: 'done', label: 'On site' })
    state = gcReducer(state, { type: 'setScheduleWaitStep', projectId: ID, waitId: 'fairoaksd-wait-1', step: 'done', on: '2026-10-02' })
    expect(waitRows(state, job(state))[0]).toMatchObject({ state: 'done', stateWords: 'on site Oct 2', tone: 'green', nextStep: null })
    expect(waitHolds(state, job(state)).size).toBe(0)
    expect(state.log[0]?.text).toBe('Fair Oaks Shops, Building D: Rooftop units is on site, Fri Oct 2.')
    // Shipped is a delivery's step only; a permit goes applied for, then issued.
    const permitted = gcReducer(bare(), { type: 'addScheduleWait', projectId: ID, kind: 'permit', title: 'Electrical service permit', packageId: 'felec', who: '', lineIds: ['felec-4'], expectedOn: '2026-10-30' })
    expect(permitted.log[0]?.text).toMatch(/a permit, expected Fri Oct 30 from the city/)
    expect(waitRows(permitted, job(permitted))[0]?.nextStep).toEqual({ step: 'asked', label: 'Applied for' })
    expect(gcReducer(permitted, { type: 'setScheduleWaitStep', projectId: ID, waitId: 'fairoaksd-wait-1', step: 'shipped', on: '2026-10-02' })).toBe(permitted)
  })

  it('a new expected day is kept with who said it', () => {
    let state = withUnits('2026-10-20')
    state = gcReducer(state, { type: 'setScheduleWaitStep', projectId: ID, waitId: 'fairoaksd-wait-1', step: 'expected', on: '2026-10-09', note: 'Carrier found two units in Dallas.' })
    expect(job(state).waits![0]).toMatchObject({ expectedOn: '2026-10-09', note: 'Carrier found two units in Dallas.' })
    expect(waitHolds(state, job(state)).size).toBe(0)
    expect(state.log[0]?.text).toBe('Fair Oaks Shops, Building D: Rooftop units is now expected Fri Oct 9: Carrier found two units in Dallas.')
  })

  it("the customer's decisions are what they read under What we need from you, with the day the work needs them", () => {
    let state = gcReducer(bare(), { type: 'addScheduleWait', projectId: ID, kind: 'decision', title: 'the restroom tile', packageId: 'fplumb', who: 'Cibolo Creek Partners', lineIds: ['fplumb-4'], expectedOn: '2026-11-20' })
    expect(customerDecisions(job(state))).toEqual([{ words: 'Your decision on the restroom tile, needed by Mon Nov 30: Trim waits on it.', by: '2026-11-30' }])
    expect(customerAsks(job(state)).map((a) => a.words)).toContain('Your decision on the restroom tile, needed by Mon Nov 30: Trim waits on it.')
    state = gcReducer(state, { type: 'setScheduleWaitStep', projectId: ID, waitId: 'fairoaksd-wait-1', step: 'done', on: '2026-10-02' })
    expect(customerDecisions(job(state))).toEqual([])
  })

  it('orders the open ones by the day they are needed, counts the late ones, and takes one off', () => {
    let state = withUnits('2026-10-20')
    state = gcReducer(state, { type: 'addScheduleWait', projectId: ID, kind: 'utility', title: 'The transformer', packageId: null, who: 'CPS Energy', lineIds: ['felec-5'], expectedOn: '2026-10-15' })
    expect(nextWaitId(job(state))).toBe('fairoaksd-wait-3')
    expect(waitRows(state, job(state)).map((r) => r.wait.title)).toEqual(['Rooftop units', 'The transformer'])
    expect(waitCounts(state, job(state))).toEqual({ open: 2, late: 1 })
    expect(waitRows(state, job(state))[1]?.trade).toBe("the job's own")
    state = gcReducer(state, { type: 'removeScheduleWait', projectId: ID, waitId: 'fairoaksd-wait-1' })
    expect(job(state).waits?.map((w) => w.title)).toEqual(['The transformer'])
    expect(state.log[0]?.text).toBe("Rooftop units came off Fair Oaks Shops, Building D's schedule.")
  })

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
