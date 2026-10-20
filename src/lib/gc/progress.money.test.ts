/**
 * The ring shows counts, never money (the lead, B2b-vi-c, on the owner's rule that our number, markup, contribution, earned
 * and labor stay from teammates): the count in the middle, the line that says what it counts, and the building ring's
 * work items carry no dollars, so a later change to the kernel cannot slip money into what every reader of a row sees.
 * The bidding card's trade lines keep the quoted numbers the same reader already sees on the row's price card.
 */
import { describe, expect, it } from 'vitest'
import { stageProgress } from './progress'
import { initialGcState } from './schedule/testState'

const MONEY = /\$|\d\s*K\b/

describe('the ring shows counts, never money', () => {
  it('keeps dollars out of every ring’s count and headline', () => {
    const state = initialGcState()
    for (const p of state.projects) {
      const r = stageProgress(state, p)
      expect(r.center, p.id).not.toMatch(MONEY)
      expect(r.headline, p.id).not.toMatch(MONEY)
    }
  })

  it('keeps dollars out of the building ring’s work items, which weigh by worth but say a percent', () => {
    const state = initialGcState()
    const building = state.projects.filter((p) => p.stage === 'building')
    expect(building.length).toBeGreaterThan(0)
    for (const p of building) {
      for (const g of stageProgress(state, p).groups) {
        for (const i of g.items) expect(`${i.label} · ${i.detail}`, p.id).not.toMatch(MONEY)
      }
    }
  })
})
