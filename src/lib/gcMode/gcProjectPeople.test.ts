import { describe, expect, it } from 'vitest'
import { followUpCallActions, gcReducer, initialGcState, projectFollowPeople, projectPeople, type GcState } from './gcModel'

const of = (state: GcState, id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no ${id}`)
  return projectPeople(state, p)
}

describe('people to call on a job (the owner, 2026-10-04)', () => {

  it('a call that takes them off drops them, and the customer counts once our bid is out', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'officeDecline', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', why: 'wont', reason: 'busy', note: '' })
    expect(of(state, 'boerne').people.some((p) => p.company === 'Hillside Excavation')).toBe(false)
    state = gcReducer(state, { type: 'markBidSent', projectId: 'padb' })
    const padb = of(state, 'padb')
    expect(padb.people.map((p) => [p.kind, p.company, p.tone])).toEqual([['customer', 'Cibolo Creek Partners', 'grey']])
  })
})

describe("Work the list for one job (the owner, 2026-10-04)", () => {

  it("a call logged with the architect goes on the architect's record", () => {
    const state = initialGcState()
    const boerne = state.projects.find((p) => p.id === 'boerne')
    if (!boerne) throw new Error('no boerne')
    const architect = projectFollowPeople(state, boerne).find((p) => p.partner.id === 'customer:marshvale')
    if (!architect) throw new Error('no architect')
    let next = state
    for (const a of followUpCallActions(architect, architect.items, 'Jonah will answer both by Monday.', null)) next = gcReducer(next, a)
    expect(next.customers.find((c) => c.id === 'marshvale')?.contacts[0]?.note).toBe('Call about questions · boerne retail shell: Jonah will answer both by Monday.')
  })
})
