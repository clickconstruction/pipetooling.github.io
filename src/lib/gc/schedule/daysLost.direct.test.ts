/**
 * Main's own tests for the days lost (G-58, G-96; the schedule's PR 1b): which weather days a move
 * answers, and the days lost by cause with what each did to the finish, run through the kernels on
 * the test data. The spike's own cases: on Fair Oaks D rain held the roofers on Thu Sep 24, and
 * lightning cleared the site Fri Sep 25.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'
import { daysLostByCause, lostDaysUnanswered } from './daysLost'
import { moveRecord, planMove, undoMove } from './moves'
import { initialGcState } from './testState'
import type { ScheduleMoveReason } from './types'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const at = (project: GcProject, lineId: string) => project.schedule!.activities.find((a) => a.lineId === lineId)!

/** A move saved the way a press saves it: the plan's dates, and its record on the schedule, newest first. */
function saved(project: GcProject, lineId: string, start: string, finish: string, reason: ScheduleMoveReason, note: string): GcProject {
  const schedule = project.schedule!
  const plan = planMove(project, lineId, start, finish)!
  const move = moveRecord(schedule, lineId, plan, { reason, note, by: 'Robert' }, '2026-10-02')
  return { ...project, schedule: { ...schedule, activities: plan.activities, moves: [move, ...(schedule.moves ?? [])] } }
}

describe('weather days a move answers (G-58)', () => {
  it('a weather move on the bar answers the lost days before it; a move for another reason does not', () => {
    const p = job(initialGcState())
    expect(lostDaysUnanswered(p, 'froof-1').length).toBe(1)
    const tpo = at(p, 'froof-1')
    expect(lostDaysUnanswered(saved(p, 'froof-1', tpo.start, addDays(tpo.finish, 1), 'weather', 'Rain on the 24th, by the log.'), 'froof-1')).toEqual([])
    expect(lostDaysUnanswered(saved(p, 'froof-1', tpo.start, addDays(tpo.finish, 1), 'crew', 'Summit came short-handed all week.'), 'froof-1').length).toBe(1)
  })
})

describe('days lost by cause (G-96)', () => {
  it('adds the standing moves up by cause, with what each did to the finish', () => {
    let p = job(initialGcState())
    expect(daysLostByCause(p).words).toBe('No move has been made on the schedule. The daily log shows 2 days lost to the weather.')
    const tpo = at(p, 'froof-1')
    // The roof out a week for the weather: it pushes the sheet metal and the rooftop units; the finish holds (the final inspection has room).
    p = saved(p, 'froof-1', tpo.start, addDays(tpo.finish, 7), 'weather', 'Rain all week, by the daily log.')
    const once = daysLostByCause(p)
    expect(once.moves).toBe(1)
    expect(once.rows.map((r) => [r.cause, r.workDays, r.finishDays, r.reasons])).toEqual([['weather', 7, once.finishDays, ['weather']]])
    // The final inspection out 10 days on the customer: the finish moves with it.
    const final = at(p, 'fairoaksd-insp-final')
    p = saved(p, final.lineId, addDays(final.start, 10), addDays(final.finish, 10), 'customer', 'Cibolo asked us to hold the final for their tenant walk.')
    const twice = daysLostByCause(p)
    expect(twice.rows[0]).toMatchObject({ cause: 'customer', finishDays: 10, workDays: 10, moves: 1, reasons: ['the customer'] })
    expect(twice.finishDays).toBe(once.finishDays + 10)
    expect(twice.words).toMatch(/^The finish moved \d+ days later in 2 moves: 10 days the customer's \(the customer\)/)
    expect(twice.words).toMatch(/The daily log shows 2 days lost to the weather\.$/)
    // An undone move drops out.
    const undone = { ...p, schedule: undoMove(p, p.schedule!.moves![0]!.id, 'Robert', '2026-10-02')! }
    expect(daysLostByCause(undone).moves).toBe(1)
  })
})
