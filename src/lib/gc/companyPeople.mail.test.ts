// GC mode, the real build, the Building lane's U2b: the Follow up sheet's mail kernels' tests, moved from the prototype (branch spike/gc-mode, gcCompanyPeople.test.ts).
import { describe, expect, it } from 'vitest'
import { companyPeople, followItemMailGroup, followUpMailTo, mailToGreeting, mailToWhy } from './companyPeople'
import { followUpDraft, type FollowItem, type FollowPerson } from './followUpSheet'
import { allFollowPeople } from './projectPeople'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

function personOf(state: GcState, partnerId: string): FollowPerson {
  const p = allFollowPeople(state, partnerId).find((x) => x.partner.id === partnerId)
  if (!p) throw new Error(`no ${partnerId}`)
  return p
}

/** Some trade's quote item, to tick beside Pecan Valley's papers. */
function aQuoteItem(state: GcState): FollowItem {
  const item = allFollowPeople(state).flatMap((p) => p.items).find((i) => i.kind === 'quote')
  if (!item) throw new Error('no quote item')
  return item
}

describe('who at a trade gets what, on the office side (the owner, 2026-10-05)', () => {
  it("Follow up's email for a waiver and insurance goes to the bookkeeper, greets them by name, and says why", () => {
    const state = initialGcState()
    const all = personOf(state, 'pecanvalley')
    // Since G-146 the sheet carries the call list's schedule items too: those go to the job's contact, never the bookkeeper.
    expect(all.items.map((i) => [i.kind, followItemMailGroup(state, i)])).toEqual([
      ['insurance', 'pay'],
      ['waiver', 'pay'],
      ['schedule', 'job'],
      ['schedule', 'job'],
      ['schedule', 'job'],
    ])
    // The email for the waiver and the insurance: the papers alone.
    const pecan = { ...all, items: all.items.filter((i) => i.kind !== 'schedule') }
    const to = followUpMailTo(state, pecan.partner, pecan.items)
    expect(to.map((t) => [t.name, t.email])).toEqual([['Dana Whitfield', 'dana@pecanvalleyelectric.example']])
    expect(mailToWhy(state, pecan.partner, pecan.items, to)).toBe('Pecan Valley Electric sends pay and papers to Dana Whitfield, its bookkeeper.')
    const draft = followUpDraft(pecan, pecan.items, { from: 'company', via: 'email', length: 'nudge' }, null, mailToGreeting(to))
    expect(draft.body.startsWith('Hello Dana,')).toBe(true)
  })

  it('a quote ticked with them goes to the main contact too, main first; nothing ticked goes to the main contact', () => {
    const state = initialGcState()
    const pecan = personOf(state, 'pecanvalley')
    const to = followUpMailTo(state, pecan.partner, [aQuoteItem(state), ...pecan.items])
    expect(to.map((t) => t.name)).toEqual(['Marcus Bell', 'Dana Whitfield'])
    expect(mailToGreeting(to)).toBe('Marcus and Dana')
    expect(mailToGreeting(to, 'es')).toBe('Marcus y Dana')
    expect(followUpMailTo(state, pecan.partner, []).map((t) => t.name)).toEqual(['Marcus Bell'])
  })

  it('a company that named no one: everything to its main contact, nothing to explain', () => {
    const state = initialGcState()
    const other = allFollowPeople(state).find((p) => !p.partner.people?.length && p.items.length > 0)
    if (!other) throw new Error('no other company')
    const to = followUpMailTo(state, other.partner, other.items)
    expect(to).toEqual([{ name: other.reach.name, first: other.reach.first, email: other.reach.email, main: true }])
    expect(mailToWhy(state, other.partner, other.items, to)).toBeNull()
    expect(companyPeople(other.partner)).toHaveLength(1)
  })

  it('plans go to the bidding people while we bid, to the job people once it is ours', () => {
    const state = initialGcState()
    const pursuing = state.projects.find((p) => p.stage === 'pursuing')
    const building = state.projects.find((p) => p.stage !== 'pursuing' && !p.lostOn)
    if (!pursuing || !building) throw new Error('no jobs')
    const plans = (projectId: string): FollowItem => ({ ...aQuoteItem(state), kind: 'plans', ask: { projectId, packageId: 'x', inviteId: 'x' } })
    expect(followItemMailGroup(state, plans(pursuing.id))).toBe('quotes')
    expect(followItemMailGroup(state, plans(building.id))).toBe('job')
  })
})
