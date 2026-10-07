/**
 * The tests of `gcNotReady.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1b). The data is `testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { lapsedInsuranceWords } from './notReady'
import { initialGcState } from './testState'

describe('a trade at work with its insurance run out (G-138)', () => {
  it('gives the morning list its line, read on the list’s day', () => {
    const pecan = initialGcState().partners.find((p) => p.id === 'pecanvalley')!
    expect(lapsedInsuranceWords(pecan, '2026-10-02')).toBe('Their insurance ran out Tue Sep 15. Nothing they do for us is covered.')
    expect(lapsedInsuranceWords(pecan, '2026-09-14')).toBeNull()
    expect(lapsedInsuranceWords({ ...pecan, coiExpires: null }, '2026-10-02')).toBe('No insurance on file. Nothing they do for us is covered.')
  })
})
