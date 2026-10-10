/**
 * The tests of `gcNeedsYou.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data, moved word
 * for word (the Board's B2b-i). The data is `schedule/testState.ts`. The tests that play the prototype's reducer stay on
 * the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { gcNeedsYou } from './needsYou'
import { allPeople, projectPeople } from './projectPeople'
import { initialGcState } from './schedule/testState'

describe("GC follow up on the dashboard's Needs you (the owner, 2026-10-04)", () => {
  it('counts what Follow up and the board count: each person once across every job', () => {
    const state = initialGcState()
    const needs = gcNeedsYou(state)
    // "Make them match": the badge is the board rows' people, each once across every job, and the same late ones.
    // One call covers every job, so a company on two jobs' rows counts on each row and once here: since G-146,
    // Cool Breeze and the architect are on Boerne's row and Fair Oaks D's, so the rows add to 13 and the badge says 11.
    const rows = state.projects.map((p) => projectPeople(state, p))
    expect(needs?.count).toBe(allPeople(state).count)
    expect(needs?.count).toBe(new Set(rows.flatMap((r) => r.people.map((p) => p.key))).size)
    expect(allPeople(state).late).toBe(new Set(rows.flatMap((r) => r.people.filter((p) => p.tone === 'red').map((p) => p.key))).size)
    expect(rows.reduce((n, r) => n + r.count, 0)).toBe(13)
    expect(needs?.late).toBe(true)
    expect(needs?.title).toBe('11 to follow up on in GC mode')
    expect(needs?.detail).toBe("Hillside Excavation is late on their word · Bexar Steel Erectors never opened the ask · Voltage Brothers' insurance ran out · and 8 more.")
  })
})
