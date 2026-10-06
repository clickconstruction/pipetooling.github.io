import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { addDays } from './gcBuilding'
import type { GcState } from './gcTypes'
import { moveRows, moveWhyProblem, planMove, scheduleFinish, undoableMove, whatIfSlips } from './gcScheduleMoves'

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
const why = { reason: 'weather' as const, note: 'Rain stopped the roof for a week.', by: 'Robert' }

describe('an explanation is required (the owner, 2026-10-05)', () => {
  it('needs a reason and a sentence', () => {
    expect(moveWhyProblem(null, 'Rain stopped the roof.')).toBe('Pick why it moved.')
    expect(moveWhyProblem('weather', 'rain')).toBe('Say what happened, in a sentence.')
    expect(moveWhyProblem('weather', 'Rain stopped the roof.')).toBeNull()
  })

  it('a move sent with a thin explanation is refused', () => {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    const after = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: tpo.lineId, start: addDays(tpo.start, 7), finish: addDays(tpo.finish, 7), after: tpo.after, why: { ...why, note: 'rain' } })
    expect(after).toBe(state)
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

describe('a move is recorded with its explanation, and the last one can be undone', () => {
  function moved() {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    const to = { start: addDays(tpo.start, 30), finish: addDays(tpo.finish, 30) }
    const after = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: tpo.lineId, ...to, after: tpo.after, why })
    return { state, after, tpo, to }
  }

  it('keeps who, when, the dates before and after, the reason, their words and what it pushed', () => {
    const { state, after, tpo, to } = moved()
    const [move] = job(after).schedule?.moves ?? []
    expect(move).toMatchObject({ on: state.today, by: 'Robert', lineId: tpo.lineId, from: { start: tpo.start, finish: tpo.finish }, to, reason: 'weather', note: 'Rain stopped the roof for a week.' })
    expect(move?.pushed.length).toBeGreaterThan(0)
    expect(move?.finishTo).toBe(scheduleFinish(job(after).schedule?.activities ?? []))
    const [row] = moveRows(job(after))
    expect(row?.who).toContain('Robert')
    expect(row?.what).toContain('Roofing · TPO membrane moved from')
    expect(row?.reason).toBe('Weather')
    expect(after.log[0]?.text).toContain('Robert: Rain stopped the roof for a week.')
  })

  it('a move without an explanation (the old form) still saves and keeps no record', () => {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    const after = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: tpo.lineId, start: addDays(tpo.start, 3), finish: addDays(tpo.finish, 3), after: tpo.after })
    expect(job(after).schedule?.moves).toBeUndefined()
  })

  it('undo puts every date back and keeps the move on the record', () => {
    const { state, after } = moved()
    const move = undoableMove(job(after))!
    const back = gcReducer(after, { type: 'undoScheduleMove', projectId: ID, moveId: move.id, by: 'Wendi' })
    expect(job(back).schedule?.activities.map((a) => [a.lineId, a.start, a.finish])).toEqual(job(state).schedule?.activities.map((a) => [a.lineId, a.start, a.finish]))
    expect(job(back).schedule?.moves?.[0]).toMatchObject({ undoneOn: state.today, undoneBy: 'Wendi' })
    expect(moveRows(job(back))[0]?.undone).toContain('by Wendi')
    expect(undoableMove(job(back))).toBeNull()
  })

  it('nothing to undo once something it touched has moved again', () => {
    const { after } = moved()
    const pushedId = job(after).schedule?.moves?.[0]?.pushed[0]?.lineId ?? ''
    const a = (job(after).schedule?.activities ?? []).find((x) => x.lineId === pushedId)!
    const again = gcReducer(after, { type: 'setScheduleActivity', projectId: ID, lineId: a.lineId, start: addDays(a.start, 2), finish: addDays(a.finish, 2), after: a.after })
    expect(undoableMove(job(again))).toBeNull()
    expect(gcReducer(again, { type: 'undoScheduleMove', projectId: ID, moveId: 'move-1', by: 'Wendi' })).toBe(again)
  })
})

describe('waits drawn by hand, gaps and day limits (G-34 to G-36)', () => {
  it('a gap on a wait pushes the work after it that many more days', () => {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    const sheet = line(state, 'Sheet metal and flashing')
    const plain = planMove(job(state), tpo.lineId, addDays(tpo.start, 30), addDays(tpo.finish, 30))!
    const gapped = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: sheet.lineId, start: sheet.start, finish: sheet.finish, after: sheet.after, lag: { [tpo.lineId]: 3 } })
    expect(job(gapped).schedule?.activities.find((a) => a.lineId === sheet.lineId)?.lag).toEqual({ [tpo.lineId]: 3 })
    const withGap = planMove(job(gapped), tpo.lineId, addDays(tpo.start, 30), addDays(tpo.finish, 30))!
    const before = plain.pushed.find((p) => p.lineId === sheet.lineId)!
    const after = withGap.pushed.find((p) => p.lineId === sheet.lineId)!
    expect(after.to.start).toBe(addDays(before.to.start, 3))
  })

  it('a day it cannot start before stops a move; a day it must finish by only warns', () => {
    const state = initialGcState()
    const curbs = line(state, 'Roof curbs')
    const limited = gcReducer(state, { type: 'setScheduleActivity', projectId: ID, lineId: curbs.lineId, start: curbs.start, finish: curbs.finish, after: curbs.after, notBefore: curbs.start, mustFinishBy: curbs.finish })
    const a = job(limited).schedule?.activities.find((x) => x.lineId === curbs.lineId)
    expect(a?.notBefore).toBe(curbs.start)
    expect(a?.mustFinishBy).toBe(curbs.finish)
    expect(planMove(job(limited), curbs.lineId, addDays(curbs.start, -2), addDays(curbs.finish, -2))?.problem).toMatch(/cannot start before/)
    const late = planMove(job(limited), curbs.lineId, addDays(curbs.start, 2), addDays(curbs.finish, 2))!
    expect(late.problem).toBeNull()
    expect(late.warnings[0]).toMatch(/must finish by .* 2 days past it/)
    // Dropped with null.
    const dropped = gcReducer(limited, { type: 'setScheduleActivity', projectId: ID, lineId: curbs.lineId, start: curbs.start, finish: curbs.finish, after: curbs.after, notBefore: null, mustFinishBy: null })
    const b = job(dropped).schedule?.activities.find((x) => x.lineId === curbs.lineId)
    expect(b?.notBefore).toBeUndefined()
    expect(b?.mustFinishBy).toBeUndefined()
  })

  it('a wait that makes a loop warns, and the loop is named', () => {
    const state = initialGcState()
    const tpo = line(state, 'TPO membrane')
    const sheet = line(state, 'Sheet metal and flashing')
    const plan = planMove(job(state), tpo.lineId, tpo.start, tpo.finish, [...tpo.after, sheet.lineId])!
    expect(plan.linksChanged).toBe(true)
    expect(plan.warnings[0]).toContain('Roofing · Sheet metal and flashing already waits on this, so this makes a loop.')
  })
})
