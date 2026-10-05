import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, projectPeople, type GcState } from './gcModel'

const of = (state: GcState, id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no ${id}`)
  return projectPeople(state, p)
}

describe('people to call on a job (the owner, 2026-10-04)', () => {
  it('counts people, not lines: each once, with every reason, worst first', () => {
    const boerne = of(initialGcState(), 'boerne')
    expect([boerne.count, boerne.late, boerne.tone]).toEqual([6, 2, 'red'])
    expect(boerne.people.map((p) => `${p.company} ${p.tone}`)).toEqual([
      'Hillside Excavation red',
      'Bexar Steel Erectors red',
      'Tejas Power amber',
      'Marsh & Vale Architects amber',
      'Cool Breeze Mechanical grey',
      'Voltage Brothers grey',
    ])
    // One call to Greg covers his late quote and the addendum.
    expect(boerne.people[0]?.reasons.map((r) => r.text)).toEqual(['Promised a quote by Wed Sep 30. That was 2 days ago.', 'Has not opened Addendum 1.'])
    expect(boerne.people[0]?.last).toBe('Sep 26 · Robert called: Greg is busy on a subdivision. Says he will price it by Wednesday.')
    expect(boerne.people[3]).toMatchObject({ kind: 'architect', tag: 'architect', reasons: [{ text: '2 questions are waiting on them, the oldest 5 days.', tone: 'amber' }] })
  })

  it('after the award: the statement of work to sign, a waiver owed, insurance that ran out; a draft of ours is not a call', () => {
    const state = initialGcState()
    expect(of(state, 'helotes').people.map((p) => [p.company, p.reasons.map((r) => r.text)])).toEqual([
      ['Brightline Electric', ['The statement of work is waiting on their signature, sent Sep 30.']],
    ])
    const fair = of(state, 'fairoaksd')
    expect([fair.count, fair.late]).toEqual([1, 1])
    expect(fair.people[0]?.reasons.map((r) => r.text)).toEqual(['Their insurance ran out Sep 15.', 'The unconditional waiver on draw 1 has not come.'])
    expect(of(state, 'stoneoak').count).toBe(0)
    expect(of(state, 'padb').tone).toBeNull()
  })

  it('a call that takes them off drops them, and the customer counts once our bid is out', () => {
    let state = initialGcState()
    state = gcReducer(state, { type: 'officeDecline', projectId: 'boerne', packageId: 'site', inviteId: 'site-hillside', why: 'wont', reason: 'busy', note: '' })
    expect(of(state, 'boerne').people.some((p) => p.company === 'Hillside Excavation')).toBe(false)
    state = gcReducer(state, { type: 'markBidSent', projectId: 'padb' })
    const padb = of(state, 'padb')
    expect(padb.people.map((p) => [p.kind, p.company, p.tone])).toEqual([['customer', 'Cibolo Creek Partners', 'grey']])
  })
})
