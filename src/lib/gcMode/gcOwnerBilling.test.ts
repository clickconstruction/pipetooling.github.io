/** GC mode design spike: the owner's pay application, read off the made-up Helotes Dental Office. */
import { describe, expect, it } from 'vitest'
import { initialGcState, nextOwnerBillDay, ownerPayApp, proposalTotals } from './gcModel'

function helotes() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.id === 'helotes')
  if (!project) throw new Error('fixture has no helotes')
  return { state, project }
}

describe('ownerPayApp', () => {
  it('bills the trades’ reported work, our costs in step with it, less 10% held', () => {
    const { state, project } = helotes()
    const app = ownerPayApp(state, project)
    expect(Math.round(app.contract)).toBe(Math.round(proposalTotals(project).price))
    // Hill Country reported framing 100% of $22,000 and hang and tape 60% of $27,200.
    const dry = app.lines.find((l) => l.id === 'dry')
    expect(dry?.doneToDate).toBe(38_320)
    expect(Math.round(app.doneToDate)).toBe(52_557)
    expect(Math.round(app.retainage)).toBe(5_256)
    expect(Math.round(app.due)).toBe(47_301)
    expect(Math.round(app.leftToBill)).toBe(291_466)
    expect(app.billOn).toBe('2026-10-25')
    expect(app.expectPaidOn).toBe('2026-11-15')
    expect(app.started).toBe(false)
  })

  it('counts nothing for a trade with no signed statement of work, our own crew, or no award', () => {
    const { state, project } = helotes()
    const app = ownerPayApp(state, project)
    for (const id of ['delec', 'dhvac', 'dplumb', 'mill']) {
      expect(app.lines.find((l) => l.id === id)?.doneToDate).toBe(0)
    }
  })
})

describe('nextOwnerBillDay', () => {
  it('is the 25th of this month until it passes, then next month’s', () => {
    expect(nextOwnerBillDay('2026-10-02')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-25')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-26')).toBe('2026-11-25')
    expect(nextOwnerBillDay('2026-12-30')).toBe('2027-01-25')
  })
})
