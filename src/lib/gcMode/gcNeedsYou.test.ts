import { afterEach, describe, expect, it } from 'vitest'
import { allPeople, followUps, gcNeedsYou, gcReducer, gcStoreDispatch, gcStoreState, initialGcState, projectPeople, resetGcStore } from './gcModel'

afterEach(() => resetGcStore())

describe("GC follow up on the dashboard's Needs you (the owner, 2026-10-04)", () => {
  it('counts what Follow up and the board count: each person once across every job', () => {
    const state = initialGcState()
    const needs = gcNeedsYou(state)
    // "Make them match": the board rows add up to the same people, and the same late ones.
    const rows = state.projects.map((p) => projectPeople(state, p))
    expect(needs?.count).toBe(allPeople(state).count)
    expect(needs?.count).toBe(rows.reduce((n, r) => n + r.count, 0))
    expect(allPeople(state).late).toBe(rows.reduce((n, r) => n + r.late, 0))
    expect(needs?.late).toBe(true)
    expect(needs?.title).toBe('9 to follow up on in GC mode')
    expect(needs?.detail).toBe("Hillside Excavation is late on their word · Bexar Steel Erectors never opened the ask · Voltage Brothers' insurance ran out · and 6 more.")
  })

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
