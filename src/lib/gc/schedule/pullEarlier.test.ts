/**
 * The tests of `gcPullEarlier.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a, and PR 9c for the offer itself). The data is `testState.ts`. The tests
 * that play the prototype's reducer stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { PULL_SOONEST_DAYS, RIGHT_BEHIND_DAYS, finishedOn, planPull } from './pullEarlier'
import { initialGcState } from './testState'
import type { ScheduleActivity, ScheduleWait } from './types'
import type { GcState } from '../types'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!

const offerOf = (s: GcState, leaveOut?: string[]) => planPull(s, job(s), leaveOut)

const span = (start: string, finish: string) => ({ start, finish })

/** One of the job's own bars (G-38): no trade's report, done when the office says. */
function own(lineId: string, start: string, finish: string, after: string[] = [], more: Partial<ScheduleActivity> = {}): ScheduleActivity {
  return { lineId, packageId: '', start, finish, after, added: { label: lineId.toUpperCase(), who: 'Our own crew', doneOn: null }, ...more }
}

/** Fair Oaks D with a small schedule of its own bars, and nothing holding them, for the rule's edges. */
function small(activities: ScheduleActivity[], waits: ScheduleWait[] = []): GcState {
  const s = initialGcState()
  return {
    ...s,
    projects: s.projects.map((p) => (p.id === 'fairoaksd' && p.schedule ? { ...p, schedule: { ...p.schedule, activities, moves: [], walks: [], baseline: null }, waits, submittals: [], rfis: [] } : p)),
  }
}

/** A: planned to finish Fri Oct 9, done today, 7 days early. */
const A_EARLY = own('a', '2026-09-28', '2026-10-09', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-10-02' } })

describe('what finished early', () => {
  it('the made-up data has none, on any project', () => {
    const s = initialGcState()
    for (const p of s.projects) expect(planPull(s, p)).toBeNull()
  })

  it('reads the recorded finish, a pass, a done day, or today for a line reported at 100%', () => {
    const a = own('x', '2026-09-28', '2026-10-09')
    expect(finishedOn(a, 0, '2026-10-02')).toBeNull()
    expect(finishedOn({ ...a, actualFinish: '2026-09-30' }, 0, '2026-10-02')).toBe('2026-09-30')
    expect(finishedOn({ ...a, added: { label: 'X', who: 'Us', doneOn: '2026-10-01' } }, 0, '2026-10-02')).toBe('2026-10-01')
    const { added: _added, ...line } = a
    expect(finishedOn(line, 100, '2026-10-02')).toBe('2026-10-02')
    expect(finishedOn({ ...line, finish: '2026-09-25' }, 100, '2026-10-02')).toBe('2026-09-25')
    expect(finishedOn({ ...line, inspection: { label: 'Final', passedOn: '2026-10-01' } }, 0, '2026-10-02')).toBe('2026-10-01')
  })

  it('keeps the defaults it was given: right behind is 2 days, the soonest is tomorrow', () => {
    expect(RIGHT_BEHIND_DAYS).toBe(2)
    expect(PULL_SOONEST_DAYS).toBe(1)
  })
})

describe('the rule, on small schedules of the job’s own bars', () => {
  it('right behind comes in; drawn with room stays', () => {
    const o = offerOf(small([A_EARLY, own('b', '2026-10-12', '2026-10-15', ['a']), own('c', '2026-10-13', '2026-10-15', ['a'])]))!
    expect(o.pulls.map((p) => [p.lineId, p.to.start, p.days])).toEqual([['b', '2026-10-05', 7]])
    expect(o.stays.map((x) => [x.lineId, x.why])).toEqual([['c', 'It was drawn with 3 days of room before it.']])
  })

  it('comes in by the days given back, never more, keeping its length', () => {
    const a = own('a', '2026-09-28', '2026-10-05', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-10-02' } })
    const o = offerOf(small([a, own('b', '2026-10-06', '2026-10-09', ['a'])]))!
    expect(o.finished[0]?.early).toBe(3)
    expect(o.pulls.map((p) => [p.to, p.days])).toEqual([[span('2026-10-03', '2026-10-06'), 3]])
  })

  it('never before tomorrow, and says how many days waiting already cost', () => {
    const a = own('a', '2026-09-20', '2026-10-09', [], { added: { label: 'A', who: 'Our own crew', doneOn: '2026-09-28' } })
    const o = offerOf(small([a, own('b', '2026-10-10', '2026-10-12', ['a'])]))!
    expect(o.pulls.map((p) => [p.to.start, p.days, p.limit])).toEqual([['2026-10-03', 7, 'Tomorrow is the soonest it can start.']])
    expect(o.lostDays).toBe(4)
    expect(o.words.lost).toBe('4 of those days are gone already. Each day of waiting costs one more.')
  })

  it('never before its Not before day', () => {
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'], { notBefore: '2026-10-07' })]))!
    expect(o.pulls.map((p) => [p.to.start, p.days, p.limit])).toEqual([['2026-10-07', 3, 'It cannot start before Wed Oct 7.']])
  })

  it('never before the day after what it waits on from outside is expected', () => {
    const doors: ScheduleWait = { id: 'w1', kind: 'delivery', title: 'the doors', packageId: null, who: 'the supplier', lineIds: ['b'], askedOn: '2026-09-20', expectedOn: '2026-10-05', doneOn: null }
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'])], [doors]))!
    expect(o.pulls.map((p) => [p.to.start, p.days, p.limit])).toEqual([['2026-10-06', 4, 'It waits on the doors, expected Mon Oct 5.']])
  })

  it('a late wait holds it, and the line names it to chase', () => {
    const late: ScheduleWait = { id: 'w1', kind: 'delivery', title: 'the doors', packageId: null, who: 'the supplier', lineIds: ['b'], askedOn: '2026-09-20', expectedOn: '2026-10-12', doneOn: null }
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'])], [late]))!
    expect(o.show).toBe('chase')
    expect(o.stays.map((x) => [x.why, x.held])).toEqual([['It waits on the doors, expected Mon Oct 12.', true]])
  })

  it('work that started stays, and so does an inspection the city will see again', () => {
    const insp = own('i', '2026-10-10', '2026-10-10', ['a'], { inspection: { label: 'Rough-in inspection', failed: [{ on: '2026-09-30', note: 'Strapping.', packageIds: [], reinspectOn: '2026-10-10' }] } })
    const { added: _a, ...inspection } = insp
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'], { actualStart: '2026-10-01' }), inspection]))!
    expect(o.stays.map((x) => [x.lineId, x.why])).toEqual([
      ['b', 'It started Thu Oct 1.'],
      ['i', 'The city sees it again Sat Oct 10.'],
    ])
  })

  it('a bar with another wait comes in only as far as that wait allows, and keeps a gap on its wait', () => {
    const e = own('e', '2026-10-01', '2026-10-07')
    const o = offerOf(small([A_EARLY, e, own('b', '2026-10-10', '2026-10-12', ['a', 'e']), own('g', '2026-10-12', '2026-10-13', ['a'], { lag: { a: 2 } })]))!
    expect(o.pulls.map((p) => [p.lineId, p.to.start, p.days])).toEqual([
      ['b', '2026-10-08', 2],
      ['g', '2026-10-05', 7],
    ])
  })

  it('a chain comes in together, and a finish that moves says by how much', () => {
    const o = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-14', ['a']), own('c', '2026-10-15', '2026-10-20', ['b']), own('d', '2026-10-21', '2026-10-21', ['c'])]))!
    expect(o.pulls.map((p) => [p.lineId, p.to])).toEqual([
      ['b', span('2026-10-03', '2026-10-07')],
      ['c', span('2026-10-08', '2026-10-13')],
      ['d', span('2026-10-14', '2026-10-14')],
    ])
    expect(o.words.state).toBe('3 activities can start 7 days sooner.')
    expect(o.words.finish).toBe('The job finishes Wed Oct 14, 7 days sooner.')
    // Leave the middle one out: it keeps its dates, and what waits only on it stays too.
    const left = offerOf(small([A_EARLY, own('b', '2026-10-10', '2026-10-14', ['a']), own('c', '2026-10-15', '2026-10-20', ['b']), own('d', '2026-10-21', '2026-10-21', ['c'])]), ['c'])!
    expect(left.pulls.map((p) => p.lineId)).toEqual(['b'])
    expect(left.stays.map((x) => [x.lineId, x.left])).toEqual([['c', true]])
    expect(left.words.finish).toBe('The job still finishes Wed Oct 21.')
  })

  it('a job not being built offers nothing', () => {
    const s = small([A_EARLY, own('b', '2026-10-10', '2026-10-12', ['a'])])
    const buyout = { ...s, projects: s.projects.map((p) => (p.id === 'fairoaksd' ? { ...p, stage: 'buyout' as const } : p)) }
    expect(offerOf(buyout)).toBeNull()
  })
})
