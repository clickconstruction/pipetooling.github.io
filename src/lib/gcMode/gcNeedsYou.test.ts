import { afterEach, describe, expect, it } from 'vitest'
import { followUps, gcNeedsYou, gcReducer, gcStoreDispatch, gcStoreState, initialGcState, resetGcStore } from './gcModel'

afterEach(() => resetGcStore())

describe("GC follow up on the dashboard's Needs you (the owner, 2026-10-04)", () => {

  it('a company taken off every reason drops out', () => {
    let state = initialGcState()
    const before = gcNeedsYou(state)?.count ?? 0
    const ask = followUps(state).find((f) => f.partner.id === 'bexar')
    if (!ask) throw new Error('no bexar ask')
    state = gcReducer(state, { type: 'officeDecline', projectId: ask.project.id, packageId: ask.pkg.id, inviteId: ask.invite.id, why: 'wont', reason: 'busy', note: '' })
    expect(gcNeedsYou(state)?.count).toBe(before - 1)
  })

  it('the store is one state for the session: a move on the GC page reaches every reader', () => {
    const before = gcNeedsYou(gcStoreState())?.count ?? 0
    const first = followUps(gcStoreState()).find((x) => x.partner.id === 'bexar')
    if (!first) throw new Error('no bexar ask')
    gcStoreDispatch({ type: 'officeDecline', projectId: first.project.id, packageId: first.pkg.id, inviteId: first.invite.id, why: 'wont', reason: 'busy', note: '' })
    expect(gcNeedsYou(gcStoreState())?.count).toBe(before - 1)
    resetGcStore()
    expect(gcNeedsYou(gcStoreState())?.count).toBe(before)
  })
})
