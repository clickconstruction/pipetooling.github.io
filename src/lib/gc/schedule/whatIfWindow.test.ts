/**
 * The schedule's PR 11 (./whatIfWindow.ts): a move tried in the copy, Undo and Redo on the copy's own record, the line
 * over the chart and Keep's line in the log, on Fair Oaks D.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'
import type { ScheduleActivity } from './types'
import { moveRecord, planMove } from './moves'
import { planPull, pullMove } from './pullEarlier'
import { recoveryMove, recoveryOffers } from './recovery'
import { withLineReported } from './testReports'
import { moveForRpc } from './writes'
import { initialGcState } from './testState'
import { WHAT_IF_NO_WHY, keepWhatIf, whatIfCopy, whatIfProject } from './whatIf'
import { copyRedone, copyUndone, tryInCopy, whatIfKeepWords, whatIfLineWords } from './whatIfWindow'

const job = (s: GcState, id = 'fairoaksd') => s.projects.find((p) => p.id === id)!

/** Fair Oaks D with an empty copy open. */
function opened(s: GcState): GcProject {
  return { ...job(s), whatIf: whatIfCopy(job(s), 'Robert', s.today)! }
}

/** A line moved `by` days on the copy, as Why it moved hands it over: with a reason, or with none yet. */
function moved(project: GcProject, lineId: string, by: number, why: { reason: 'weather'; note: string } | null, today: string) {
  const onCopy = whatIfProject(project)!
  const a = onCopy.schedule!.activities.find((x) => x.lineId === lineId)!
  const plan = planMove(onCopy, lineId, addDays(a.start, by), addDays(a.finish, by))!
  const given = why ?? WHAT_IF_NO_WHY
  const move = { ...moveRecord(onCopy.schedule!, lineId, plan, { ...given, by: 'Robert' }, today), ...(why ? {} : { noWhy: true }) }
  return { move, activities: plan.activities }
}

describe('tryInCopy (the schedule’s PR 11)', () => {
  it('lays the move on the copy, newest first, and leaves the real schedule as it was', () => {
    const s = initialGcState()
    const p0 = opened(s)
    const first = moved(p0, 'froof-1', 3, { reason: 'weather', note: 'Rain on the deck.' }, s.today)
    const c1 = tryInCopy(p0, first.move, first.activities)!
    const p1 = { ...p0, whatIf: c1 }
    const second = moved(p1, 'fplumb-3', 2, null, s.today)
    const c2 = tryInCopy(p1, second.move, second.activities)!
    expect(c2.schedule.moves?.map((m) => [m.id, m.lineId, Boolean(m.noWhy)])).toEqual([
      ['move-2', 'fplumb-3', true],
      ['move-1', 'froof-1', false],
    ])
    expect(c2.schedule.activities).toBe(second.activities)
    expect(c2.base).toBe(p0.whatIf!.base)
    expect(p0.schedule).toBe(job(s).schedule)
    expect(tryInCopy(job(s), first.move, first.activities)).toBeNull()
  })
})

describe('Undo and Redo on the copy (G-40)', () => {
  it('puts the copy’s newest move back and forward on the copy alone', () => {
    const s = initialGcState()
    const p0 = opened(s)
    const tried = moved(p0, 'froof-1', 3, { reason: 'weather', note: 'Rain on the deck.' }, s.today)
    const p1 = { ...p0, whatIf: tryInCopy(p0, tried.move, tried.activities)! }
    const back = copyUndone(p1, 'move-1', 'Robert', s.today)!
    expect(back.schedule.activities).toEqual(p0.whatIf!.schedule.activities)
    expect(back.schedule.moves?.[0]).toMatchObject({ id: 'move-1', undoneOn: s.today, undoneBy: 'Robert' })
    const p2 = { ...p1, whatIf: back }
    const forward = copyRedone(p2, 'move-1')!
    expect(forward.schedule.activities).toEqual(tried.activities)
    expect(forward.schedule.moves?.[0]?.undoneOn).toBeUndefined()
    expect(p2.schedule).toBe(job(s).schedule)
    expect(copyUndone(p0, 'move-1', 'Robert', s.today)).toBeNull()
    expect(copyRedone(p1, 'move-1')).toBeNull()
    expect(copyUndone(job(s), 'move-1', 'Robert', s.today)).toBeNull()
  })
})

describe('whatIfLineWords: the line over the chart', () => {
  it('says what the copy does against the real schedule, with the money team’s bills only when handed in', () => {
    const s = initialGcState()
    const p0 = opened(s)
    expect(whatIfLineWords(p0)!.words).toEqual(['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.', 'Move a bar to try something.'])
    const first = moved(p0, 'froof-1', 3, { reason: 'weather', note: 'Rain on the deck.' }, s.today)
    const p1 = { ...p0, whatIf: tryInCopy(p0, first.move, first.activities)! }
    const second = moved(p1, 'fplumb-3', 2, null, s.today)
    const p2 = { ...p1, whatIf: tryInCopy(p1, second.move, second.activities)! }
    const line = whatIfLineWords(p2)!
    expect([line.moves, line.noWhy, line.bars.length > 0]).toEqual([2, 1, true])
    expect(line.words.slice(0, 3)).toEqual(['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.', '2 moves tried.'])
    expect(line.words[line.words.length - 1]).toBe('1 move has no reason yet.')
    expect(line.words.some((w) => w.startsWith('The bills:'))).toBe(false)
    const withBills = whatIfLineWords(p2, '$4,000 of the Nov 1 bill moves to Dec 1.')!
    expect(withBills.words[withBills.words.length - 2]).toBe('The bills: $4,000 of the Nov 1 bill moves to Dec 1.')
    for (const w of withBills.words) expect(plainWordsFailures(w), w).toEqual([])
    expect(whatIfLineWords(job(s))).toBeNull()
  })

  it('says the finish against the real one, and goes back to its first words once every try is undone', () => {
    const s = initialGcState()
    const p0 = opened(s)
    const tried = moved(p0, 'froof-1', 3, { reason: 'weather', note: 'Rain on the deck.' }, s.today)
    const p1 = { ...p0, whatIf: tryInCopy(p0, tried.move, tried.activities)! }
    const line = whatIfLineWords(p1)!
    expect(line.words.slice(2)).toEqual(['1 move tried.', `${line.bars.length} bars differ from the real schedule.`, 'The job still finishes Tue Dec 8, as in the real one.'])
    // The last bar moved: the finish moves with it.
    const last = [...job(s).schedule!.activities].sort((a, b) => b.finish.localeCompare(a.finish))[0]!
    const late = moved(p0, last.lineId, 7, { reason: 'weather', note: 'Rain on the deck.' }, s.today)
    const lateLine = whatIfLineWords({ ...p0, whatIf: tryInCopy(p0, late.move, late.activities)! })!
    expect(lateLine.finishDays).toBeGreaterThan(0)
    expect(lateLine.words[4]).toMatch(/^The job finishes \w{3} \w{3} \d{1,2}, \d+ days later than the real one\.$/)
    const back = { ...p1, whatIf: copyUndone(p1, 'move-1', 'Robert', s.today)! }
    expect(whatIfLineWords(back, '$1 of the Nov 1 bill moves to Dec 1.')!.words).toEqual(['A copy of the schedule to try moves on.', 'Nothing here reaches the trades or the customer.', 'Move a bar to try something.'])
  })
})

describe('Keep’s line in the log', () => {
  it('is the prototype reducer’s, and counts what the kernel kept', () => {
    const s = initialGcState()
    const p0 = opened(s)
    const tried = moved(p0, 'froof-1', 3, { reason: 'weather', note: 'Rain on the deck.' }, s.today)
    const kept = keepWhatIf({ ...p0, whatIf: tryInCopy(p0, tried.move, tried.activities)! }, {}, 'Robert', s.today)
    if ('problem' in kept) throw new Error(kept.problem)
    expect(whatIfKeepWords(job(s), kept.kept, 'Robert Douglas')).toBe(`Robert Douglas kept a what-if on ${job(s).name}: 1 move on the schedule, each with its reason.`)
    expect(whatIfKeepWords({ name: 'Schedule test P' }, [1, 2], 'Schedule Dev')).toBe('Schedule Dev kept a what-if on Schedule test P: 2 moves on the schedule, each with its reason.')
  })
})

describe('Keep keeps a pull’s and a days back’s own fields (PR 11, amendment 1)', () => {
  /** recovery.test.ts's chain: Sheet metal, then Controls, then Trim, 7 days past the contract, nothing else drawn. */
  function chain(): GcState {
    const s = initialGcState()
    const keep = new Map(job(s).schedule!.activities.map((a) => [a.lineId, a]))
    const line = (id: string, start: string, finish: string, after: string[]): ScheduleActivity => {
      const { lag: _lag, ...base } = keep.get(id) as ScheduleActivity
      return { ...base, lineId: id, start, finish, after }
    }
    const activities = [line('froof-3', '2026-11-30', '2026-12-06', []), line('fhvac-3', '2026-12-07', '2026-12-13', ['froof-3']), line('fplumb-4', '2026-12-14', '2026-12-18', ['fhvac-3'])]
    return {
      ...s,
      projects: s.projects.map((p) => (p.id === 'fairoaksd' && p.schedule ? { ...p, schedule: { ...p.schedule, activities, moves: [], walks: [], baseline: null }, waits: [], submittals: [], rfis: [] } : p)),
    }
  }

  it('a pull tried in the copy is kept with the lines that finished, and sent with them', () => {
    const s = withLineReported(withLineReported(initialGcState(), 'fairoaksd', 'fhvac', 'fhvac-2', 100), 'fairoaksd', 'fplumb', 'fplumb-3', 100)
    const p0 = opened(s)
    const onCopy = whatIfProject(p0)!
    const offer = planPull(s, onCopy)!
    // The window's own reason, filled in: a listed reason and a sentence, so Keep never asks.
    const move = pullMove(onCopy.schedule!, offer, { reason: 'early', note: offer.note, by: 'Robert' }, s.today)!
    const kept = keepWhatIf({ ...p0, whatIf: tryInCopy(p0, move, offer.activities)! }, {}, 'Robert', s.today)
    if ('problem' in kept) throw new Error(kept.problem)
    expect(kept.kept[0]!.pull).toEqual(move.pull)
    expect(moveForRpc(p0, kept.kept[0]!).pullFinished).toEqual(offer.finished.map((f) => f.lineId))
  })

  it('a side-by-side days back tried in the copy is kept with its wait and gaps, and sent with them', () => {
    const s = chain()
    const p0 = opened(s)
    const onCopy = whatIfProject(p0)!
    const offer = recoveryOffers(s, onCopy).find((o) => o.key === 'side:fhvac-3:froof-3')!
    const move = recoveryMove(onCopy.schedule!, offer, { reason: 'recovery', note: offer.note, by: 'Robert' }, s.today)
    const kept = keepWhatIf({ ...p0, whatIf: tryInCopy(p0, move, offer.activities)! }, {}, 'Robert', s.today)
    if ('problem' in kept) throw new Error(kept.problem)
    expect(kept.kept[0]!.recovery).toEqual({ how: 'side', after: offer.after, gapWas: offer.gapWas ?? 0, gap: offer.gap ?? 0 })
    expect(moveForRpc(p0, kept.kept[0]!).recovery).toEqual({ how: 'side', afterActivityId: offer.after, gapWas: offer.gapWas ?? 0, gap: offer.gap ?? 0 })
  })
})
