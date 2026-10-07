/**
 * Main's own tests for moving a bar, baselines, a change order's days, the real days and the job's
 * own bars (the schedule's PR 1a): the cases the spike's reducer tests play, run here through the
 * kernels the reducer calls, on the test data. Each pins the prototype's own answer.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import type { ChangeOrder, GcProject, GcState } from '../types'
import { actualProblem, actualWords, withReportedActuals } from './actualDates'
import { addedActivityProblem, addedActivityWords, nextOwnId } from './addedActivity'
import { baselineDue, baselineHistory, baselineWords, nextBaselineName, withNewBaseline } from './baseline'
import { changeOrderMove, changeOrdersOnChart, changeOrderTails, customerContractDays, whereWorkIs } from './changeOrderDays'
import { moveActivityName, moveRecord, moveRows, planMove, redoableMove, redoMove, undoableMove, undoMove } from './moves'
import { scheduleItems } from './schedule'
import { initialGcState } from './testState'
import type { ScheduleActivity } from './types'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const at = (project: GcProject, lineId: string) => project.schedule!.activities.find((a) => a.lineId === lineId)!
const span = (a: ScheduleActivity) => ({ start: a.start, finish: a.finish })

/** A move saved the way a press saves it: the plan's dates, and its record on the schedule, newest first. */
function saved(project: GcProject, lineId: string, start: string, finish: string, note: string, changeOrderId?: string): GcProject {
  const schedule = project.schedule!
  const plan = planMove(project, lineId, start, finish)!
  const move = moveRecord(schedule, lineId, plan, { reason: changeOrderId ? 'change order' : 'weather', note, by: 'Robert' }, '2026-10-02', changeOrderId)
  return { ...project, schedule: { ...schedule, activities: plan.activities, moves: [move, ...(schedule.moves ?? [])] } }
}

describe('a move kept on the schedule, with Undo and Redo', () => {
  it('keeps the move with its reason and words, lists it, puts it back, and puts it forward again', () => {
    const s = initialGcState()
    const tpo = at(job(s), 'froof-1')
    const moved = saved(job(s), 'froof-1', addDays(tpo.start, 3), addDays(tpo.finish, 3), ' Rain on the deck. ')
    const move = moved.schedule!.moves![0]!
    expect(move).toMatchObject({ id: 'move-1', on: '2026-10-02', by: 'Robert', reason: 'weather', note: 'Rain on the deck.', from: { start: '2026-09-21', finish: '2026-10-09' }, to: { start: '2026-09-24', finish: '2026-10-12' }, finishFrom: '2026-12-08', finishTo: '2026-12-08' })
    expect(move.pushed).toEqual([
      { lineId: 'froof-3', from: { start: '2026-10-12', finish: '2026-10-21' }, to: { start: '2026-10-13', finish: '2026-10-22' } },
      { lineId: 'fhvac-1', from: { start: '2026-10-12', finish: '2026-10-23' }, to: { start: '2026-10-13', finish: '2026-10-24' } },
    ])
    expect(moveActivityName(moved, 'froof-1')).toBe('Roofing · TPO membrane')
    const row = moveRows(moved)[0]!
    expect([row.who, row.what, row.effect, row.reason, row.undone]).toEqual(['Fri Oct 2 · Robert', 'Roofing · TPO membrane moved from Sep 21 to Oct 9, to Sep 24 to Oct 12.', '2 after it moved out.', 'Weather', null])

    expect(undoableMove(moved)?.id).toBe('move-1')
    expect(undoMove(moved, 'move-2', 'Wendi', '2026-10-03')).toBeNull()
    const back = { ...moved, schedule: undoMove(moved, 'move-1', 'Wendi', '2026-10-03')! }
    expect([span(at(back, 'froof-1')), span(at(back, 'froof-3')), span(at(back, 'fhvac-1'))]).toEqual([span(tpo), span(at(job(s), 'froof-3')), span(at(job(s), 'fhvac-1'))])
    expect(back.schedule!.moves![0]).toMatchObject({ undoneOn: '2026-10-03', undoneBy: 'Wendi' })
    expect(undoableMove(back)).toBeNull()
    expect(moveRows(back)[0]?.undone).toBe('Undone Oct 3 by Wendi.')

    expect(redoableMove(back)?.id).toBe('move-1')
    const again = { ...back, schedule: redoMove(back, 'move-1')! }
    expect(span(at(again, 'froof-1'))).toEqual({ start: '2026-09-24', finish: '2026-10-12' })
    expect(again.schedule!.moves![0]?.undoneOn).toBeUndefined()
    expect(redoableMove(again)).toBeNull()
  })

  it('will not undo a move once a bar it moved has moved again', () => {
    const s = initialGcState()
    const tpo = at(job(s), 'froof-1')
    const moved = saved(job(s), 'froof-1', addDays(tpo.start, 3), addDays(tpo.finish, 3), 'Rain on the deck.')
    const touched = { ...moved, schedule: { ...moved.schedule!, activities: moved.schedule!.activities.map((a) => (a.lineId === 'froof-3' ? { ...a, start: addDays(a.start, 1), finish: addDays(a.finish, 1) } : a)) } }
    expect(undoableMove(touched)).toBeNull()
    expect(undoMove(touched, 'move-1', 'Wendi', '2026-10-03')).toBeNull()
  })
})

describe('a change order’s days, and a new baseline after it (G-76, G-41)', () => {
  const co: ChangeOrder = { id: 'co-1', number: 1, description: 'A larger roof curb for RTU-2', packageId: 'froof', status: 'signed', answeredOn: '2026-10-02', days: 3 }

  it('finds where its work is, draws its days as a tail, and offers the move that lands them', () => {
    const s = initialGcState()
    const signed = { ...job(s), changeOrders: [co] }
    expect(whereWorkIs(signed, co, s.today)?.lineId).toBe('froof-1')
    expect(changeOrdersOnChart(signed, s.today).map((r) => [r.lineId, r.where, r.words])).toEqual([['froof-1', 'Roofing · TPO membrane', 'Change order 1 adds 3 days to Roofing · TPO membrane. Not on the dates yet.']])
    expect([...changeOrderTails(signed, s.today)]).toEqual([['froof-1', { days: 3, words: 'Change order 1 adds 3 days to Roofing · TPO membrane. Not on the dates yet.' }]])
    expect(changeOrderMove(signed, co, s.today)).toEqual({
      lineId: 'froof-1',
      start: '2026-09-21',
      finish: '2026-10-12',
      after: at(signed, 'froof-1').after,
      why: { reason: 'change order', note: 'Change order 1, signed Oct 2: A larger roof curb for RTU-2. It adds 3 days to this work.' },
      changeOrderId: 'co-1',
    })
    expect(customerContractDays(signed)).toEqual(['Change order 1 added 3 days to your contract.', 'Substantial completion is now Mon Dec 14, 3 days past the Dec 11 you signed.'])
    expect([nextBaselineName(signed, s.today), baselineDue(signed, s.today)]).toEqual(['Baseline 2', null])
    expect(changeOrdersOnChart(job(s), s.today)).toEqual([])
  })

  it('once its days are on the dates, offers a new baseline named for it, which keeps the old one', () => {
    const s = initialGcState()
    const signed = { ...job(s), changeOrders: [co] }
    const m = changeOrderMove(signed, co, s.today)!
    const landed = saved(signed, m.lineId, m.start, m.finish, m.why.note, m.changeOrderId)
    expect(changeOrdersOnChart(landed, s.today)[0]?.words).toBe('Change order 1 put 3 days on Roofing · TPO membrane, Oct 2 by Robert.')
    expect([changeOrderTails(landed, s.today).size, changeOrderMove(landed, co, s.today)]).toEqual([0, null])
    expect(nextBaselineName(landed, s.today)).toBe('After change order 1')
    expect(baselineDue(landed, s.today)).toBe('Change order 1 put 3 days on the schedule since the baseline of Wed Jul 1. A new baseline after a signed change order is usual.')
    expect(scheduleItems(s, landed).find((i) => i.activity.lineId === 'froof-1')?.slipDays).toBe(10)

    expect(withNewBaseline(landed.schedule!, '  ', '', 'Robert', s.today)).toBeNull()
    expect(withNewBaseline({ ...landed.schedule!, baseline: null }, 'After change order 1', '', 'Robert', s.today)).toBeNull()
    const rebased = { ...landed, schedule: withNewBaseline(landed.schedule!, ' After change order 1 ', 'The curb was signed.', 'Robert', s.today)! }
    expect(rebased.schedule!.baseline).toMatchObject({ lockedOn: '2026-10-02', name: 'After change order 1', by: 'Robert', why: 'The curb was signed.' })
    expect(rebased.schedule!.baseline?.activities['froof-1']).toEqual({ start: '2026-09-21', finish: '2026-10-12' })
    expect(baselineHistory(rebased.schedule!).map(baselineWords)).toEqual(['At Start, locked Jul 1.', 'After change order 1, set Oct 2 by Robert: The curb was signed.'])
    expect(scheduleItems(s, rebased).find((i) => i.activity.lineId === 'froof-1')?.slipDays).toBe(0)
    expect(baselineDue(rebased, s.today)).toBeNull()
  })
})

describe('the days work really ran (G-55)', () => {
  it('takes a report’s first day over 0% as the start and 100% as the finish, today, where none was kept', () => {
    const s = initialGcState()
    const schedule = job(s).schedule!
    expect(withReportedActuals(schedule, 'froof-1', 0, s.today)).toBe(schedule)
    expect(withReportedActuals(schedule, 'nope', 50, s.today)).toBe(schedule)
    expect(withReportedActuals(undefined, 'froof-1', 50, s.today)).toBeUndefined()
    const started = withReportedActuals(schedule, 'froof-1', 50, s.today)!
    expect(started.activities.find((a) => a.lineId === 'froof-1')).toMatchObject({ actualStart: '2026-10-02' })
    expect(started.activities.find((a) => a.lineId === 'froof-1')?.actualFinish).toBeUndefined()
    const done = withReportedActuals(started, 'froof-1', 100, '2026-10-09')!
    expect(done.activities.find((a) => a.lineId === 'froof-1')).toMatchObject({ actualStart: '2026-10-02', actualFinish: '2026-10-09' })
  })

  it('says the real days against the planned ones, and refuses days that cannot be', () => {
    const tpo = at(job(initialGcState()), 'froof-1')
    expect(actualWords(tpo)).toBeNull()
    expect(actualWords({ ...tpo, actualStart: '2026-09-21' })).toBe('Started Mon Sep 21, as planned; not finished.')
    expect(actualWords({ ...tpo, actualStart: '2026-09-23' })).toBe('Started Wed Sep 23, 2 days late; not finished.')
    expect(actualWords({ ...tpo, actualStart: '2026-09-23', actualFinish: '2026-10-10' })).toBe('Sep 23 to Oct 10, 1 day past the planned finish.')
    expect(actualWords({ ...tpo, actualFinish: '2026-10-09' })).toBe('Finished Fri Oct 9, on the planned finish.')
    const today = '2026-10-02'
    expect([
      actualProblem('2026-10-05', undefined, today),
      actualProblem('2026-09-21', '2026-10-05', today),
      actualProblem('2026-09-25', '2026-09-21', today),
      actualProblem(undefined, '2026-09-30', today),
      actualProblem('2026-09-21', '2026-09-30', today),
    ]).toEqual(['A start cannot be after today.', 'A finish cannot be after today.', 'It has to finish on or after it started.', 'Say when it started first.', null])
  })
})

describe('the job’s own bars (G-38)', () => {
  it('numbers the next one, says what is missing, and reads it back in a sentence', () => {
    const project = job(initialGcState())
    expect(nextOwnId(project)).toBe('fairoaksd-own-1')
    const own: ScheduleActivity = { lineId: 'fairoaksd-own-2', packageId: '', start: '2026-08-31', finish: '2026-09-06', after: [], added: { label: 'Slab cure', who: 'Cure time', doneOn: null } }
    expect(nextOwnId({ ...project, schedule: { ...project.schedule!, activities: [...project.schedule!.activities, own] } })).toBe('fairoaksd-own-3')
    expect([
      addedActivityProblem(' ', 'Cure time', '2026-08-31', '2026-09-06'),
      addedActivityProblem('Slab cure', ' ', '2026-08-31', '2026-09-06'),
      addedActivityProblem('Slab cure', 'Cure time', '', '2026-09-06'),
      addedActivityProblem('Slab cure', 'Cure time', '2026-09-06', '2026-08-31'),
      addedActivityProblem('Slab cure', 'Cure time', '2026-08-31', '2026-09-06'),
    ]).toEqual(['Give it a name.', 'Say whose it is.', 'It needs a start and a finish.', 'It has to finish on or after it starts.', null])
    expect([addedActivityWords(own), addedActivityWords({ ...own, added: { ...own.added!, doneOn: '2026-09-06' } }), addedActivityWords(at(project, 'froof-1'))]).toEqual(['Slab cure, Cure time, 7 days.', 'Slab cure, Cure time, 7 days, done.', null])
  })
})
