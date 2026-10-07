/**
 * The tests of `gcDecline.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-i). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { declineReasonWords } from './decline'

describe('why a company is out (the owner, 2026-10-04)', () => {
  it("an 'other' reason reads as their words", () => {
    expect(declineReasonWords({ reason: 'other', note: 'owner is a competitor of theirs', on: '2026-10-02' })).toBe('owner is a competitor of theirs')
  })
})
