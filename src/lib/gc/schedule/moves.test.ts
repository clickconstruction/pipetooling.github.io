/**
 * The tests of `gcScheduleMoves.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a). The data is `testState.ts`, the prototype's fixture cut to
 * what the kernels read. The tests that play the prototype's reducer or read another lane stay on the
 * spike, where they run against these kernels, until their presses and lanes reach main.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import { moveWhyProblem, planMove, whatIfSlips } from './moves'
import { initialGcState } from './testState'
import type { GcState } from '../types'

/** Fair Oaks Shops, Building D: the roof (ftpo) is followed by sheet metal and curbs, and they by the rooftop units. */
const ID = 'fairoaksd'

function job(state: GcState) {
  const project = state.projects.find((p) => p.id === ID)
  if (!project?.schedule) throw new Error('the made-up data lost Fair Oaks D')
  return project
}

function line(state: GcState, label: string) {
  const project = job(state)
  for (const pkg of project.packages) {
    const l = [...(pkg.sow?.sov ?? []), ...pkg.scope].find((x) => x.label === label)
    const a = l ? project.schedule?.activities.find((x) => x.lineId === l.id) : undefined
    if (a) return a
  }
  throw new Error(`no activity called ${label}`)
}

describe('an explanation is required (the owner, 2026-10-05)', () => {
  it('needs a reason and a sentence', () => {
    expect(moveWhyProblem(null, 'Rain stopped the roof.')).toBe('Pick why it moved.')
    expect(moveWhyProblem('weather', 'rain')).toBe('Say what happened, in a sentence.')
    expect(moveWhyProblem('weather', 'Rain stopped the roof.')).toBeNull()
  })
})

describe('a move, looked at before it is saved', () => {
  it('says what it pushes and what it does to the finish, and changes nothing', () => {
    const state = initialGcState()
    const before = JSON.stringify(state)
    const tpo = line(state, 'TPO membrane')
    const plan = planMove(job(state), tpo.lineId, addDays(tpo.start, 30), addDays(tpo.finish, 30))!
    expect(plan.problem).toBeNull()
    expect(plan.pushed.length).toBeGreaterThan(0)
    expect(plan.pushed.every((p) => p.to.start > p.from.start)).toBe(true)
    expect(plan.finishTo >= plan.finishFrom).toBe(true)
    expect(plan.words).toMatch(/The job (still )?finishes/)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('knows a move that changes nothing, and one that cannot be', () => {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    expect(planMove(job(state), tpo.lineId, tpo.start, tpo.finish)?.same).toBe(true)
    expect(planMove(job(state), tpo.lineId, tpo.finish, tpo.start)?.problem).toBe('It has to finish on or after it starts.')
    expect(planMove(job(state), 'nope', tpo.start, tpo.finish)).toBeNull()
  })

  it('a small slip with room behind it moves nothing else', () => {
    const state = initialGcState()
    const lighting = line(state, 'Site lighting')
    expect(whatIfSlips(job(state), lighting.lineId, 2)).toBe('If it slips 2 days: nothing else moves.')
    expect(whatIfSlips(job(state), line(state, 'Test and balance').lineId, 10)).toMatch(/The job finishes .* later\./)
  })
})

describe('waits drawn by hand, gaps and day limits (G-34 to G-36)', () => {
  it('a wait that makes a loop warns, and the loop is named', () => {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    const sheet = line(state, 'Sheet metal and flashing')
    const plan = planMove(job(state), tpo.lineId, tpo.start, tpo.finish, [...tpo.after, sheet.lineId])!
    expect(plan.linksChanged).toBe(true)
    expect(plan.warnings[0]).toContain('Roofing · Sheet metal and flashing already waits on this, so this makes a loop.')
  })
})
