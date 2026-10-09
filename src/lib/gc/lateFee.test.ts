/**
 * The late finish against the contract (O6b-3): the finish that counts is the day we reached substantial completion once
 * Building has it (the milestone's `metOn`), the schedule's projected finish until then; the contract's fee a day
 * prices the days past. And the lines Bill the customer's terms and Money show.
 */
import { describe, expect, it } from 'vitest'
import { lateFinish } from './lateFinish'
import { ownerFinishRisk, ownerFinishWords, ownerLateFeeWords } from './ownerBillingFinish'
import { isSubstantial } from './schedule/schedule'
import { initialGcState } from './schedule/testState'
import type { GcProject } from './types'
import { money } from './words'

/** Fair Oaks D, whose contract day and projected finish are both Fri Dec 11 on the state's Oct 2. */
function fairOaks(over: { metOn?: string; perDay?: number } = {}): { state: ReturnType<typeof initialGcState>; project: GcProject } {
  const state = initialGcState()
  const p = state.projects.find((x) => x.id === 'fairoaksd')!
  const project: GcProject = {
    ...p,
    ...(over.perDay !== undefined ? { ownerLateFinish: { perDay: over.perDay } } : {}),
    ...(over.metOn ? { schedule: { ...p.schedule!, milestones: p.schedule!.milestones.map((m) => (isSubstantial(m) ? { ...m, metOn: over.metOn! } : m)) } } : {}),
  }
  return { state, project }
}

describe('the finish that counts against the contract', () => {
  it('is the schedule\'s projected finish until Building has the day', () => {
    const { state, project } = fairOaks()
    expect(ownerFinishRisk(state, project)).toMatchObject({ metOn: null, finish: { on: '2026-12-11', from: 'projected' }, past: 0 })
  })

  it('is the day we reached substantial completion once Building has it, priced at the contract\'s fee', () => {
    const { state, project } = fairOaks({ metOn: '2026-12-14', perDay: 500 })
    expect(ownerFinishRisk(state, project)).toMatchObject({ metOn: '2026-12-14', finish: { on: '2026-12-14', from: 'met' }, past: 3, perDay: 500, atRisk: 1500 })
    const late = lateFinish(state, project)
    expect([late.late, late.atRisk, late.money]).toEqual([3, 1500, `At ${money(500)} a day, the 3 days cost ${money(1500)}.`])
  })

  it('says which day counts and how far it is from the contract\'s', () => {
    const met = fairOaks({ metOn: '2026-12-14' })
    expect(ownerFinishWords(ownerFinishRisk(met.state, met.project))).toBe('We reached substantial completion Mon Dec 14, 3 days past the contract\'s Fri Dec 11.')
    const early = fairOaks({ metOn: '2026-12-10' })
    expect(ownerFinishWords(ownerFinishRisk(early.state, early.project))).toBe('We reached substantial completion Thu Dec 10, 1 day before the contract\'s Fri Dec 11.')
    const projected = fairOaks()
    expect(ownerFinishWords(ownerFinishRisk(projected.state, projected.project))).toBe('The schedule finishes Fri Dec 11, on the contract\'s Fri Dec 11.')
    const { state } = fairOaks()
    const bare: GcProject = { ...projected.project, schedule: undefined }
    expect(ownerFinishWords(ownerFinishRisk(state, bare))).toBe('Substantial completion is not on the schedule yet.')
  })

  it('says the contract\'s fee in the terms, or that none is typed', () => {
    expect([ownerLateFeeWords(500), ownerLateFeeWords(null), ownerLateFeeWords(undefined)]).toEqual([
      `${money(500)} a day past the contract's substantial completion.`,
      'No late fee is entered from the contract.',
      'No late fee is entered from the contract.',
    ])
  })
})
