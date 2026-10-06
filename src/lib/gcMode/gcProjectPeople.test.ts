import { describe, expect, it } from 'vitest'
import { followUpCallActions, gcReducer, initialGcState, projectFollowPeople, projectPeople, type GcState } from './gcModel'

const of = (state: GcState, id: string) => {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no ${id}`)
  return projectPeople(state, p)
}

describe('people to call on a job (the owner, 2026-10-04)', () => {
  it('counts people, not lines: each once, with every reason, worst first', () => {
    const boerne = of(initialGcState(), 'boerne')
    expect([boerne.count, boerne.late, boerne.tone]).toEqual([6, 3, 'red'])
    // Voltage is late too: one call about the addendum also covers its insurance, which ran out.
    expect(boerne.people.map((p) => `${p.company} ${p.tone}`)).toEqual([
      'Hillside Excavation red',
      'Bexar Steel Erectors red',
      'Voltage Brothers red',
      'Tejas Power amber',
      'Marsh & Vale Architects amber',
      'Cool Breeze Mechanical grey',
    ])
    // One call to Greg covers his late quote and the addendum.
    expect(boerne.people[0]?.reasons.map((r) => r.text)).toEqual(['Promised a quote by Wed Sep 30. That was 2 days ago.', 'Has not opened Addendum 1.'])
    expect(boerne.people[0]?.last).toBe('Sep 26 · Robert called: Greg is busy on a subdivision. Says he will price it by Wednesday.')
    expect(boerne.people[4]).toMatchObject({ kind: 'architect', tag: 'architect', reasons: [{ text: '2 questions are waiting on them, the oldest 5 days.', tone: 'amber' }] })
  })

  it('after the award: the statement of work to sign, a waiver owed, insurance that ran out; a draft of ours is not a call', () => {
    const state = initialGcState()
    expect(of(state, 'helotes').people.map((p) => [p.company, p.reasons.map((r) => r.text)])).toEqual([
      ['Brightline Electric', ['The statement of work is waiting on their signature, sent Sep 30.']],
    ])
    const fair = of(state, 'fairoaksd')
    // Pecan Valley's insurance and waiver, and Cibolo's pay application 3, two days late.
    // G-146: the call list's bar reasons join, so Cool Breeze, Iron Horse, Summit and the architect are on the row too.
    expect([fair.count, fair.late]).toEqual([6, 3])
    expect(fair.people.find((p) => p.company === 'Pecan Valley Electric')?.reasons.map((r) => r.text)).toEqual([
      'Their insurance ran out Tue Sep 15. Nothing they do for us is covered. They are at work on Panels and feeders, and Lighting.',
      'Electrical service inspection failed Mon Sep 28. The city sees it again today. What failed: “The main bonding jumper is missing at the service panel.”',
      'The unconditional waiver on draw 1 has not come.',
      'Site lighting and Fire alarm wait on current insurance. Site lighting starts Mon Oct 19.',
      'Panels and feeders is due today and 80% done.',
      'Lighting is behind: 40% done against 48% in the plan. It is due Fri Oct 23.',
    ])
    expect(fair.people.find((p) => p.kind === 'customer')?.reasons.map((r) => r.text)).toEqual(['Pay application 3 is 2 days late, $288,879 open.'])
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

describe("Work the list for one job (the owner, 2026-10-04)", () => {
  it("walks the card's people in its order, each with this job's reasons, the architect included", () => {
    const state = initialGcState()
    const boerne = state.projects.find((p) => p.id === 'boerne')
    if (!boerne) throw new Error('no boerne')
    const people = projectFollowPeople(state, boerne)
    expect(people.map((p) => p.partner.id)).toEqual(['hillside', 'bexar', 'voltage', 'tejas', 'customer:marshvale', 'coolbreeze'])
    expect(people[0]?.items.map((i) => [i.kind, i.due])).toEqual([['quote', true], ['plans', true]])
    expect(people[4]?.items.map((i) => i.kind)).toEqual(['answer'])
    expect(people[4]?.reach.name).toBe('Jonah Vale')
    // One call covers both: the addendum, and the insurance that ran out.
    expect(people[2]?.items.map((i) => i.kind).sort()).toEqual(['insurance', 'plans'])
    expect(people.every((p) => p.items.every((i) => !i.ask || i.ask.projectId === 'boerne'))).toBe(true)
  })

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
