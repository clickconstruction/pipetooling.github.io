import { afterEach, describe, expect, it } from 'vitest'
import { gcNeedsYou, gcReducer, gcStoreDispatch, gcStoreState, initialGcState, promisesToChase, followUps, resetGcStore } from './gcModel'

afterEach(() => resetGcStore())

describe("GC follow up on the dashboard's Needs you (the owner, 2026-10-04)", () => {
  it('counts what Follow up counts, and names the first few', () => {
    const state = initialGcState()
    const needs = gcNeedsYou(state)
    const badge = followUps(state).filter((f) => f.why !== 'waiting').length + promisesToChase(state)
    expect(needs?.count).toBe(badge)
    expect(needs?.late).toBe(true)
    expect(needs?.title).toBe(`${badge} to follow up on in GC mode`)
    expect(needs?.detail.startsWith("Hillside Excavation is late on their word · Tejas Power promised a quote today · Bexar Steel Erectors never opened the ask")).toBe(true)
  })

  it('is null when there is no one to chase', () => {
    let state = initialGcState()
    for (const f of followUps(state).filter((x) => x.why !== 'waiting')) {
      state = gcReducer(state, { type: 'officeDecline', projectId: f.project.id, packageId: f.pkg.id, inviteId: f.invite.id, why: 'wont', reason: 'busy', note: '' })
    }
    const left = gcNeedsYou(state)
    // Only papers can be left once every ask is answered.
    expect(left === null || left.title.endsWith('to chase in GC mode')).toBe(true)
  })

  it('the store is one state for the session: a move on the GC page reaches every reader', () => {
    const before = gcNeedsYou(gcStoreState())?.count ?? 0
    const first = followUps(gcStoreState()).find((x) => x.why === 'passed')
    if (!first) throw new Error('no passed ask')
    gcStoreDispatch({ type: 'officeDecline', projectId: first.project.id, packageId: first.pkg.id, inviteId: first.invite.id, why: 'wont', reason: 'busy', note: '' })
    expect(gcNeedsYou(gcStoreState())?.count).toBe(before - 1)
    resetGcStore()
    expect(gcNeedsYou(gcStoreState())?.count).toBe(before)
  })
})
