/**
 * The tests of `gcSplitBars.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a). The data is `testState.ts`, the prototype's fixture cut to
 * what the kernels read. The tests that play the prototype's reducer or read another lane stay on the
 * spike, where they run against these kernels, until their presses and lanes reach main.
 */
import { describe, expect, it } from 'vitest'
import { draftShares } from './splitBars'

const SALES_BACK = [
  { name: 'Sales floor', start: '2026-09-14', finish: '2026-10-09' },
  { name: 'Back of house', start: '2026-10-10', finish: '2026-10-23' },
]

describe('splitting a line', () => {
  it("the window's shares follow the days as they are typed, adding up to 100", () => {
    expect(draftShares(SALES_BACK)).toEqual([65, 35])
    expect(draftShares([...SALES_BACK, { start: '2026-10-20', finish: '' }])).toEqual([65, 35, null])
    expect(draftShares([{ start: '2026-09-14', finish: '2026-09-16' }, { start: '2026-09-17', finish: '2026-09-19' }, { start: '2026-09-20', finish: '2026-09-22' }])).toEqual([34, 33, 33])
    expect(draftShares([{ start: '', finish: '' }])).toEqual([null])
  })
})
