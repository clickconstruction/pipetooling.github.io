import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, rfiCounts, rfiNeededBy, rfiRows, portalRfis, type GcState } from './gcModel'

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

  it('work already under way needs the answer the day it is asked, never before', () => {
    const s = gcReducer(initialGcState(), { type: 'addRfi', projectId: 'fairoaksd', question: 'Which membrane color on the bay 1 roof?', sheets: [], packageId: 'froof', partnerId: null, holds: ['froof-1'], neededDays: 3 })
    expect(rfiRows(s, fair(s)).find((r) => r.label === 'RFI-005')).toMatchObject({ needed: 'needed today', late: false })
  })

  it('reads late once its day passes', () => {
    const state = { ...initialGcState(), today: '2026-10-05' }
    expect(rfiRows(state, fair(state))[0]).toMatchObject({ label: 'RFI-004', needed: '3 days late', late: true })
  })

  it('goes to the architect, comes back answered, and a cost answer starts one draft change order', () => {
    let s = initialGcState()
    s = gcReducer(s, { type: 'sendRfiToArchitect', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4' })
    expect(rfiRows(s, fair(s))[0]).toMatchObject({ label: 'RFI-004', stateWords: 'with the architect' })
    s = gcReducer(s, { type: 'answerRfi', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4', text: 'Set the 54 by 72 curb. A bulletin follows.', by: 'architect', impact: 'cost', cost: 1_400, days: 1 })
    const row = rfiRows(s, fair(s)).find((r) => r.label === 'RFI-004')
    expect(row).toMatchObject({ stateWords: 'answered', canStartChangeOrder: true, changeOrderNumber: null })
    expect(s.log[0]?.text).toBe('RFI-004 answered by Marsh & Vale Architects Oct 2: adds $1,400 and 1 day.')
    s = gcReducer(s, { type: 'draftChangeOrderFromRfi', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4' })
    const co = fair(s).changeOrders?.slice(-1)[0]
    expect(co).toMatchObject({ status: 'draft', reason: 'plans', packageId: 'froof', cost: 1_400, days: 1, description: 'RFI-004: Set the 54 by 72 curb. A bulletin follows (A-501, M-101)' })
    expect(rfiRows(s, fair(s)).find((r) => r.label === 'RFI-004')).toMatchObject({ canStartChangeOrder: false, changeOrderNumber: co?.number })
    // Once only.
    expect(gcReducer(s, { type: 'draftChangeOrderFromRfi', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4' })).toBe(s)
  })

  it('the architect answers only what was sent to them; we can answer our own; a cost answer needs a cost or days', () => {
    const s = initialGcState()
    const answer = (by: 'architect' | 'us', impact: 'none' | 'cost', cost = 0) => gcReducer(s, { type: 'answerRfi', projectId: 'fairoaksd', rfiId: 'fairoaksd-rfi-4', text: 'Set the bigger curb.', by, impact, cost, days: 0 })
    expect(answer('architect', 'none')).toBe(s)
    expect(answer('us', 'cost', 0)).toBe(s)
    expect(rfiRows(answer('us', 'none'), fair(s)).length).toBe(4)
    expect(fair(answer('us', 'none')).rfis?.find((r) => r.number === 4)?.answer).toMatchObject({ by: 'us', impact: 'none' })
  })

  it('a trade asks from its portal on a job being built: it holds its next work, needed 3 days before', () => {
    let s = initialGcState()
    s = gcReducer(s, { type: 'tradeAskRfi', projectId: 'fairoaksd', packageId: 'fhvac', partnerId: 'coolbreeze', question: 'Can the RTU-1 curb sit on the existing joists?', sheets: ['S-201'] })
    const rfi = fair(s).rfis?.find((r) => r.number === 5)
    // Its ductwork is under way, so the question holds the next work not started: the rooftop units on Oct 12.
    expect(rfi).toMatchObject({ partnerId: 'coolbreeze', packageId: 'fhvac', holds: ['fhvac-1'], neededDays: 3, sentToArchitectOn: null })
    expect(rfiRows(s, fair(s)).find((r) => r.label === 'RFI-005')?.needed).toBe('needed by Fri Oct 9')
    expect(portalRfis(fair(s), 'fhvac', 'coolbreeze').map((r) => r.number)).toEqual([5, 3])
    // Only the trade we hired on it, only while we build.
    expect(gcReducer(s, { type: 'tradeAskRfi', projectId: 'fairoaksd', packageId: 'fhvac', partnerId: 'summit', question: 'x', sheets: [] })).toBe(s)
    expect(gcReducer(s, { type: 'tradeAskRfi', projectId: 'boerne', packageId: 'hvac', partnerId: 'coolbreeze', question: 'x', sheets: [] })).toBe(s)
  })

  it('the office adds one from our superintendent, holding the work it picks', () => {
    const s = gcReducer(initialGcState(), { type: 'addRfi', projectId: 'fairoaksd', question: 'Which way does the bay 2 door swing? A-101 and A-601 differ.', sheets: ['A-101', 'A-601'], packageId: null, partnerId: null, holds: ['felec-5', 'nope'], neededDays: 5 })
    expect(fair(s).rfis?.slice(-1)[0]).toMatchObject({ number: 5, partnerId: null, holds: ['felec-5'], neededDays: 5, askedOn: '2026-10-02' })
    expect(rfiRows(s, fair(s)).find((r) => r.label === 'RFI-005')).toMatchObject({ askedBy: 'Our superintendent', needed: 'needed by Wed Oct 14' })
  })
})
