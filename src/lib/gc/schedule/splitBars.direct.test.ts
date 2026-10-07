/**
 * Main's own tests for one line as several bars (G-39; the schedule's PR 1a): the spike's split, part
 * report and part move, run here through the kernels the reducer calls, on the test data. Lighting on
 * Fair Oaks D runs Mon Sep 14 to Fri Oct 23, 40 days, reported 40% done.
 */
import { describe, expect, it } from 'vitest'
import type { GcState } from '../types'
import { lineLabel, movedParts, partFacts, partMoveOf, partMoveSpans, partPcts, partSpans, partStanding, partsSummary, splitDrafts, splitParts, withPartDays, withPartReport } from './splitBars'
import { initialGcState } from './testState'
import type { ScheduleActivity, ScheduleMove } from './types'

const LIGHTING = 'felec-3'
const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const lighting = (s: GcState) => job(s).schedule!.activities.find((a) => a.lineId === LIGHTING)!
/** The spike's split: the sales floor first, then the back of house. */
const DRAFTS = [
  { name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' },
  { name: 'Back of house', start: '2026-10-10', finish: '2026-10-23' },
]

/** Lighting split as the split window sends it, at its 40%. */
function split(s: GcState): ScheduleActivity {
  const made = splitParts(lighting(s), DRAFTS, 40)
  if ('problem' in made) throw new Error(made.problem)
  return { ...lighting(s), parts: made.parts }
}

describe('a line split into parts', () => {
  it('offers halves to start from, and splits by the days, the shares adding up to 100', () => {
    const s = initialGcState()
    expect(splitDrafts(lighting(s))).toEqual([
      { name: 'Part 1', start: '2026-09-14', finish: '2026-10-03' },
      { name: 'Part 2', start: '2026-10-04', finish: '2026-10-23' },
    ])
    expect(split(s).parts).toEqual([
      { id: 'felec-3-p1', name: 'Sales floor', from: 0, days: 26, share: 65, pct: 40 },
      { id: 'felec-3-p2', name: 'Back of house', from: 26, days: 14, share: 35, pct: 40 },
    ])
    expect(partSpans(split(s)).map((p) => [p.part.name, p.start, p.finish, p.days])).toEqual([
      ['Sales floor', '2026-09-14', '2026-10-09', 26],
      ['Back of house', '2026-10-10', '2026-10-23', 14],
    ])
    expect(lineLabel(job(s), LIGHTING)).toBe('Lighting')
    expect(lineLabel(job(s), 'nope')).toBe('nope')
    expect(partsSummary('Lighting', lighting(s))).toBe('Lighting is one bar. Split it when the work goes in parts, a floor or an area at a time.')
    expect(partsSummary('Lighting', split(s))).toBe('Lighting is 40% done, the parts by their share.')
  })

  it('refuses a split it cannot make, and says why', () => {
    const s = initialGcState()
    const [first, second] = DRAFTS as [(typeof DRAFTS)[number], (typeof DRAFTS)[number]]
    expect(splitParts(lighting(s), [first], 40)).toEqual({ problem: 'Split it into two parts or more.' })
    expect(splitParts(lighting(s), [first, { ...second, name: ' ' }], 40)).toEqual({ problem: 'Give each part a name.' })
    expect(splitParts(lighting(s), [first, { ...second, name: ' sales FLOOR ' }], 40)).toEqual({ problem: 'Give each part its own name.' })
    expect(splitParts(lighting(s), [first, { ...second, finish: '2026-10-20' }], 40)).toEqual({
      problem: 'The first part starts Mon Sep 14 and the last ends Fri Oct 23, as the line does. Move a part after the split to change that.',
    })
  })

  it('takes a part’s report and its real start, and says where each part stands by its own dates', () => {
    const s = initialGcState()
    const reported = withPartReport(split(s), 'felec-3-p1', 60, s.today)
    expect(reported.parts?.[0]).toMatchObject({ pct: 60, actualStart: '2026-10-02' })
    expect([reported.actualStart, reported.actualFinish]).toEqual(['2026-10-02', undefined])
    expect(partFacts(reported, s.today)).toEqual(['Sales floor: 60%, plan 73%. Started Fri Oct 2.', 'Back of house: 40%, starts Sat Oct 10.'])
    const sales = { start: '2026-09-14', finish: '2026-10-09' }
    expect([partStanding(sales, 60, s.today), partStanding(sales, 70, s.today), partStanding(sales, 100, s.today)]).toEqual([
      { words: 'behind', tone: 'amber' },
      { words: 'on track', tone: 'blue' },
      { words: 'done', tone: 'green' },
    ])
    expect([
      partStanding({ start: '2026-10-10', finish: '2026-10-23' }, 40, s.today),
      partStanding({ start: '2026-09-14', finish: '2026-09-30' }, 50, s.today),
      partStanding({ start: '2026-09-14', finish: '2026-10-02' }, 50, s.today),
    ]).toEqual([
      { words: 'starts Oct 10', tone: 'grey' },
      { words: '2 days late', tone: 'red' },
      { words: 'due today', tone: 'amber' },
    ])
    // Nothing under the 40% already billed on the line.
    expect(partPcts(split(s), 'felec-3-p1', 40)).toEqual([40, 50, 60, 70, 80, 90, 100])
  })

  it('moves one part, and puts its days back and forward with the move', () => {
    const s = initialGcState()
    const a = split(s)
    expect(partMoveOf(a, 'felec-3-p2', '2026-10-10', '2026-10-23')).toBeNull()
    expect(partMoveOf(a, 'felec-3-p2', '2026-10-12', '2026-10-27')).toEqual({
      lineId: LIGHTING,
      start: '2026-09-14',
      finish: '2026-10-27',
      after: ['felec-1'],
      part: { id: 'felec-3-p2', name: 'Back of house', from: { start: '2026-10-10', finish: '2026-10-23' }, start: '2026-10-12', finish: '2026-10-27' },
    })
    const moved = movedParts(a, 'felec-3-p2', '2026-10-12', '2026-10-27')!
    expect(moved.parts.map((p) => [p.id, p.from, p.days])).toEqual([
      ['felec-3-p1', 0, 26],
      ['felec-3-p2', 28, 16],
    ])
    expect(movedParts(a, 'felec-3-p2', '2026-10-27', '2026-10-12')).toBeNull()
    const days = (list: { id: string; from: number; days: number }[]) => list.map(({ id, from, days }) => ({ id, from, days }))
    const move: ScheduleMove = {
      id: 'move-1',
      on: s.today,
      by: 'Robert',
      lineId: LIGHTING,
      from: { start: a.start, finish: a.finish },
      to: { start: moved.start, finish: moved.finish },
      reason: 'materials',
      note: 'The back of house fixtures come Monday.',
      pushed: [],
      finishFrom: '2026-12-08',
      finishTo: '2026-12-08',
      parts: { id: 'felec-3-p2', was: days(a.parts!), now: days(moved.parts) },
    }
    expect(partMoveSpans(move)).toEqual({ from: { start: '2026-10-10', finish: '2026-10-23' }, to: { start: '2026-10-12', finish: '2026-10-27' } })
    expect(partMoveSpans({ ...move, parts: undefined })).toBeNull()
    const now = withPartDays({ ...a, start: moved.start, finish: moved.finish }, move, 'now')
    expect(now.parts?.map((p) => [p.from, p.days, p.pct])).toEqual([
      [0, 26, 40],
      [28, 16, 40],
    ])
    expect(withPartDays(now, move, 'was').parts?.map((p) => [p.from, p.days])).toEqual([
      [0, 26],
      [26, 14],
    ])
  })
})
