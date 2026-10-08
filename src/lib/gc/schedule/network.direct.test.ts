/**
 * G-130: the schedule's day math in one kernel (`network.ts`). What `schedule.ts` and `gantt.ts`
 * re-export is the kernel's own function, one copy. Then the spare days, a push and a loop, read from
 * the kernel itself, and a bar's length counted with the chart's calendar in its spare days.
 */
import { describe, expect, it } from 'vitest'
import * as gantt from './gantt'
import * as network from './network'
import { pushAfter, scheduleFloat, wouldLoop, workingDays } from './network'
import * as schedule from './schedule'
import { initialGcState } from './testState'
import type { ScheduleActivity } from './types'

/** The job's own work, so a push reads its name and whether it is done from the bar alone. */
const own = (lineId: string, start: string, finish: string, after: string[] = [], doneOn: string | null = null): ScheduleActivity => ({
  lineId,
  packageId: '',
  start,
  finish,
  after,
  added: { label: lineId, who: 'Our own crew', doneOn },
})
const job = initialGcState().projects.find((p) => p.id === 'fairoaksd')!

describe('one copy of the day math', () => {
  it('is the kernel’s own function wherever a reader imports it', () => {
    for (const name of ['daysBetween', 'lagOf', 'pushAfter', 'pushedAfterWords', 'scheduleFloat', 'wouldLoop'] as const) expect(schedule[name], name).toBe(network[name])
    for (const name of ['holidayOn', 'holidaysIn', 'holidaysOf', 'isWeekend', 'isWorkingDay', 'workingDays'] as const) expect(gantt[name], name).toBe(network[name])
  })
})

describe('the links, the spare days and the pushes', () => {
  it('gives the longest chain no spare days, and a side branch its gap', () => {
    // A (3 days), B (4 days) after A, C (3 days) after B ends Oct 10; D (2 days) after A ends Oct 5.
    const f = scheduleFloat([own('A', '2026-10-01', '2026-10-03'), own('B', '2026-10-04', '2026-10-07', ['A']), own('C', '2026-10-08', '2026-10-10', ['B']), own('D', '2026-10-04', '2026-10-05', ['A'])])
    expect(['A', 'B', 'C', 'D'].map((id) => f.get(id))).toEqual([0, 0, 0, 5])
  })

  it('pushes what waits on a bar by the days it moved, two steps down, and leaves work done where it is', () => {
    const before = [own('A', '2026-10-01', '2026-10-03'), own('B', '2026-10-04', '2026-10-06', ['A']), own('C', '2026-10-07', '2026-10-09', ['B']), own('D', '2026-10-04', '2026-10-05', ['A'], '2026-10-05')]
    const moved = before.map((a) => (a.lineId === 'A' ? { ...a, start: '2026-10-04', finish: '2026-10-06' } : a))
    const pushed = pushAfter(job, moved, 'A')
    expect(pushed.moved.map((m) => [m.lineId, m.start, m.finish, m.days])).toEqual([
      ['B', '2026-10-07', '2026-10-09', 3],
      ['C', '2026-10-10', '2026-10-12', 3],
    ])
    expect(pushed.activities.find((a) => a.lineId === 'D')).toEqual(before[3])
  })

  it('finds a loop two steps down, and none where there is none', () => {
    const bars = [own('A', '2026-10-01', '2026-10-03'), own('B', '2026-10-04', '2026-10-06', ['A']), own('C', '2026-10-07', '2026-10-09', ['B'])]
    expect(wouldLoop(bars, 'A', 'C')).toBe(true)
    expect(wouldLoop(bars, 'A', 'A')).toBe(true)
    expect(wouldLoop(bars, 'C', 'A')).toBe(false)
  })
})

describe('a bar’s length, counted with the chart’s calendar (G-130)', () => {
  it('counts a bar that finishes before it starts as no days long, in its spare days too', () => {
    expect(workingDays('2026-10-05', '2026-10-03')).toBe(0)
    // X ends, no days long, the day before it starts (Oct 4); the job ends Oct 10: six spare days.
    const f = scheduleFloat([own('Y', '2026-10-01', '2026-10-10'), own('X', '2026-10-05', '2026-10-03')])
    expect([f.get('Y'), f.get('X')]).toEqual([0, 6])
  })
})
