/**
 * Main's own tests for telling the trades (the Gantt, Phase 3, and G-113; the schedule's PR 1b): the
 * lines a move changed and the companies doing them, what each told company answered, and a day asked
 * for that stands until the bar moves again, run through the kernels on the test data. The spike's own
 * cases: on Fair Oaks D the roof moves, Summit Roofing's TPO membrane, pushing its sheet metal and Cool
 * Breeze Mechanical's rooftop units. A move is kept as Why it moved saves it; telling the trades and
 * their answers are kept on it as the spike's reducer keeps them.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'
import { moveRecord, planMove, undoMove } from './moves'
import { companiesToTell, datesAsksForOffice, datesAsksOpen, moveAnswerWords, movedLines } from './tellTrades'
import { initialGcState } from './testState'
import type { ScheduleMove } from './types'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const NOTE = 'Rain stopped the roof for a week.'

/** A move saved the way a press saves it, a bar's days later on a given day: the plan's dates, and its record on the schedule, newest first. */
function saved(project: GcProject, lineId: string, days: number, note: string, on = '2026-10-02'): GcProject {
  const schedule = project.schedule!
  const a = schedule.activities.find((x) => x.lineId === lineId)!
  const plan = planMove(project, lineId, addDays(a.start, days), addDays(a.finish, days))!
  const move = moveRecord(schedule, lineId, plan, { reason: 'weather', note, by: 'Robert' }, on)
  return { ...project, schedule: { ...schedule, activities: plan.activities, moves: [move, ...(schedule.moves ?? [])] } }
}
/** A move as telling the trades and their answers leave it. */
const withMove = (project: GcProject, change: Partial<ScheduleMove>, id = 'move-1'): GcProject => ({ ...project, schedule: { ...project.schedule!, moves: project.schedule!.moves!.map((m) => (m.id === id ? { ...m, ...change } : m)) } })
const moveOf = (p: GcProject, id = 'move-1') => p.schedule!.moves!.find((m) => m.id === id)!

describe('who to tell, and what', () => {
  it('lists every line a move changed, the moved one first, with the company doing it, and none for an inspection', () => {
    const s = initialGcState()
    const p = saved(job(s), 'froof-1', 30, NOTE)
    expect(movedLines(s, p, moveOf(p)).map(({ line, partner }) => [line.work, partner?.company])).toEqual([
      ['TPO membrane', 'Summit Roofing'],
      ['Sheet metal and flashing', 'Summit Roofing'],
      ['Rooftop units', 'Cool Breeze Mechanical'],
      ['Controls', 'Cool Breeze Mechanical'],
      ['Test and balance', 'Cool Breeze Mechanical'],
      ['Final inspection', undefined],
    ])
  })

  it('groups the lines a move changed by the company doing them', () => {
    const s = initialGcState()
    const p = saved(job(s), 'froof-1', 30, NOTE)
    const companies = companiesToTell(s, p, [moveOf(p)])
    expect(companies.map((c) => c.partner.company)).toEqual(['Summit Roofing', 'Cool Breeze Mechanical'])
    const summit = companies[0]!
    expect(summit.lines.map((l) => l.work)).toEqual(['TPO membrane', 'Sheet metal and flashing'])
    expect(summit.lines[0]?.to.start).toBe(addDays(summit.lines[0]!.from.start, 30))
    expect(companiesToTell(s, p, [])).toEqual([])
  })
})

describe('their answers', () => {
  it('says what each told company said, for the office’s record, and which asked for another day', () => {
    const s = initialGcState()
    const moved = saved(job(s), 'froof-1', 30, NOTE)
    expect(moveAnswerWords(s, moveOf(moved))).toEqual([])
    const told = withMove(moved, { toldOn: '2026-10-02', toldTo: ['summit', 'coolbreeze'] })
    expect(moveAnswerWords(s, moveOf(told))).toEqual(['Summit Roofing: told Oct 2, no answer yet.', 'Cool Breeze Mechanical: told Oct 2, no answer yet.'])
    const asked = withMove(told, {
      answers: [
        { partnerId: 'summit', on: '2026-10-02', ok: true },
        { partnerId: 'coolbreeze', on: '2026-10-02', ok: false, day: '2026-11-16', note: 'We are on another job until then.' },
      ],
    })
    expect(moveAnswerWords(s, moveOf(asked))).toEqual(['Summit Roofing: the dates work.', 'Cool Breeze Mechanical asked for Mon Nov 16: “We are on another job until then.”'])
    const [ask, ...rest] = datesAsksForOffice(s, asked)
    expect(rest).toEqual([])
    expect([ask?.partner.company, ask?.day, ask?.note]).toEqual(['Cool Breeze Mechanical', '2026-11-16', 'We are on another job until then.'])
  })

  it('keeps a company’s ask for another day until the bar moves again (G-113)', () => {
    const s = initialGcState()
    const told = withMove(saved(job(s), 'froof-1', 7, NOTE), { toldOn: '2026-10-02', toldTo: ['summit'] })
    expect(datesAsksOpen(s, told)).toEqual([])
    const asked = withMove(told, { answers: [{ partnerId: 'summit', on: '2026-10-02', ok: false, day: '2026-10-19', note: 'We are on another job until then.' }] })
    const [ask] = datesAsksOpen(s, asked)
    expect(ask).toMatchObject({ trade: 'Roofing', day: '2026-10-19', on: '2026-10-02' })
    expect(ask?.words).toBe('Asked for Mon Oct 19 on TPO membrane after we moved it: “We are on another job until then.”')
    // Moving the bar again, the next day, answers it. So does undoing the move.
    expect(datesAsksOpen(s, saved(asked, 'froof-1', 3, 'Summit comes back the 19th.', '2026-10-03'))).toEqual([])
    expect(datesAsksOpen(s, { ...asked, schedule: undoMove(asked, 'move-1', 'Robert', '2026-10-02')! })).toEqual([])
  })
})
