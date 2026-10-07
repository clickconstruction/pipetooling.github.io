/**
 * The tests of `gcPullEarlier.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a). The data is `testState.ts`, the prototype's fixture cut to
 * what the kernels read. The tests that play the prototype's reducer or read another lane stay on the
 * spike, where they run against these kernels, until their presses and lanes reach main.
 */
import { describe, expect, it } from 'vitest'
import { PULL_SOONEST_DAYS, RIGHT_BEHIND_DAYS, finishedOn } from './pullEarlier'
import type { ScheduleActivity } from './types'

/** One of the job's own bars (G-38): no trade's report, done when the office says. */
function own(lineId: string, start: string, finish: string, after: string[] = [], more: Partial<ScheduleActivity> = {}): ScheduleActivity {
  return { lineId, packageId: '', start, finish, after, added: { label: lineId.toUpperCase(), who: 'Our own crew', doneOn: null }, ...more }
}

describe('what finished early', () => {
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
