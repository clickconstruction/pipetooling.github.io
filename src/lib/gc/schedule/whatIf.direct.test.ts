/**
 * Main's own tests for what if (G-81; the schedule's PR 1a): a copy made from Fair Oaks D, a move
 * tried on it, its ghosts, and Keep with its refusals, run through the kernels on the test data. The
 * schedule's PR 1b adds the words for its kept moves the trades have not been told.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'
import { moveRecord, planMove } from './moves'
import { initialGcState } from './testState'
import { keepWhatIf, whatIfBaseChanges, whatIfCopy, whatIfGhosts, whatIfKeptWords, whatIfProject, whatIfTried } from './whatIf'

const job = (s: GcState, id = 'fairoaksd') => s.projects.find((p) => p.id === id)!

/** Fair Oaks D with a copy open and the TPO membrane tried 3 days later on it. */
function tried(s: GcState, why = { reason: 'weather' as const, note: 'Rain on the deck.' }): GcProject {
  const copy = whatIfCopy(job(s), 'Robert', s.today)!
  const onCopy = whatIfProject({ ...job(s), whatIf: copy })!
  const tpo = onCopy.schedule!.activities.find((a) => a.lineId === 'froof-1')!
  const plan = planMove(onCopy, 'froof-1', addDays(tpo.start, 3), addDays(tpo.finish, 3))!
  const move = moveRecord(copy.schedule, 'froof-1', plan, { ...why, by: 'Robert' }, s.today)
  return { ...job(s), whatIf: { ...copy, schedule: { ...copy.schedule, activities: plan.activities, moves: [move] } } }
}

describe('a what-if copy', () => {
  it('starts as the real schedule with a history of its own, and none for a job with no schedule', () => {
    const s = initialGcState()
    const copy = whatIfCopy(job(s), 'Robert', s.today)!
    expect([copy.on, copy.by, copy.schedule.moves, copy.schedule.walks]).toEqual(['2026-10-02', 'Robert', [], []])
    expect(copy.schedule.activities).toEqual(job(s).schedule!.activities)
    expect(copy.base['froof-1']).toEqual({ start: '2026-09-21', finish: '2026-10-09', after: ['fsteel-2'] })
    expect(whatIfCopy(job(s, 'helotes'), 'Robert', s.today)).toBeNull()
  })

  it('shows the real dates under each bar the copy moved, and nothing changed under it yet', () => {
    const s = initialGcState()
    const project = tried(s)
    expect([...whatIfGhosts(project)]).toEqual([
      ['froof-1', { start: '2026-09-21', finish: '2026-10-09' }],
      ['froof-3', { start: '2026-10-12', finish: '2026-10-21' }],
      ['fhvac-1', { start: '2026-10-12', finish: '2026-10-23' }],
    ])
    expect(whatIfTried(project).map((m) => m.lineId)).toEqual(['froof-1'])
    expect(whatIfBaseChanges(project)).toEqual([])
  })

  it('keeps the tried move as a real one, by the person who kept it, marked as tried first', () => {
    const s = initialGcState()
    const kept = keepWhatIf(tried(s), {}, 'Wendi', '2026-10-03')
    if ('problem' in kept) throw new Error(kept.problem)
    expect(kept.kept).toHaveLength(1)
    expect(kept.kept[0]).toMatchObject({ id: 'move-1', on: '2026-10-03', by: 'Wendi', lineId: 'froof-1', reason: 'weather', note: 'Rain on the deck.', fromWhatIf: '2026-10-02' })
    expect(kept.schedule.activities.find((a) => a.lineId === 'froof-1')).toMatchObject({ start: '2026-09-24', finish: '2026-10-12' })
    expect(kept.schedule.moves?.[0]?.id).toBe('move-1')
  })

  it('refuses Keep when the real schedule moved, when nothing was tried, and when a move has no reason', () => {
    const s = initialGcState()
    const project = tried(s)
    const real = project.schedule!
    const moved = { ...project, schedule: { ...real, activities: real.activities.map((a) => (a.lineId === 'froof-1' ? { ...a, finish: addDays(a.finish, 1) } : a)) } }
    expect(whatIfBaseChanges(moved)).toEqual([{ lineId: 'froof-1', name: 'TPO membrane' }])
    expect(keepWhatIf(moved, {}, 'Wendi', s.today)).toEqual({ problem: 'The real schedule changed since this copy was made. TPO membrane moved there. Throw this copy away and make a new one.' })
    const copy = whatIfCopy(job(s), 'Robert', s.today)!
    expect(keepWhatIf({ ...job(s), whatIf: copy }, {}, 'Wendi', s.today)).toEqual({ problem: 'Nothing was tried in the what-if.' })
    expect(keepWhatIf(job(s), {}, 'Wendi', s.today)).toEqual({ problem: 'There is no what-if open.' })
    const noWhy = tried(s)
    const m = noWhy.whatIf!.schedule.moves![0]!
    const unexplained = { ...noWhy, whatIf: { ...noWhy.whatIf!, schedule: { ...noWhy.whatIf!.schedule, moves: [{ ...m, noWhy: true }] } } }
    expect(keepWhatIf(unexplained, {}, 'Wendi', s.today)).toEqual({ problem: 'Give each move a reason and a sentence.' })
    const explained = keepWhatIf(unexplained, { [m.id]: { reason: 'materials', note: 'The membrane ships Friday.' } }, 'Wendi', s.today)
    expect('kept' in explained && explained.kept[0]).toMatchObject({ reason: 'materials', note: 'The membrane ships Friday.' })
  })
})

describe('the moves kept from a what-if, before the trades are told', () => {
  it('says how many were kept and which companies have not been told, until they are', () => {
    const s = initialGcState()
    const kept = keepWhatIf(tried(s), {}, 'Wendi', '2026-10-03')
    if ('problem' in kept) throw new Error(kept.problem)
    const p = { ...job(s), schedule: kept.schedule }
    expect(whatIfKeptWords(s, p)).toEqual({ words: '1 move kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told.', companies: ['Summit Roofing', 'Cool Breeze Mechanical'] })
    const told = { ...p, schedule: { ...p.schedule, moves: p.schedule.moves!.map((m) => ({ ...m, toldOn: '2026-10-03', toldTo: ['summit', 'coolbreeze'] })) } }
    expect(whatIfKeptWords(s, told)).toBeNull()
    expect(whatIfKeptWords(s, job(s))).toBeNull()
  })
})
