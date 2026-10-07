// @vitest-environment jsdom
/**
 * The tests of `gcTheirDates.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './testState'
import { changeOrderWords, contractWords } from './theirDates'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

describe('reading their file', () => {
  it('says what the contract’s day does in the Projected finish measure’s words', () => {
    const s = initialGcState()
    expect([contractWords(s, job(s), '2026-12-04'), contractWords(s, job(s), '2026-12-18'), contractWords(s, job(s), '2026-12-11')]).toEqual([
      "This is the contract's finish. With theirs, the projected finish, Fri Dec 11, is 7 days past the contract.",
      "This is the contract's finish. With theirs, the projected finish, Fri Dec 11, leaves 7 days to spare.",
      "This is the contract's finish. With theirs, the projected finish, Fri Dec 11, leaves no days to spare.",
    ])
    expect(changeOrderWords(job(s), '2026-12-18')).toBeNull()
  })
})
