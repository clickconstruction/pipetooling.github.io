/**
 * The tests of `gcRecovery.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a). The data is `testState.ts`, the prototype's fixture cut to
 * what the kernels read. The tests that play the prototype's reducer or read another lane stay on the
 * spike, where they run against these kernels, until their presses and lanes reach main.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './testState'

describe('the gap below zero (the lead’s condition)', () => {
  it('every gap in the made-up data is still zero or more', () => {
    for (const p of initialGcState().projects) for (const a of p.schedule?.activities ?? []) for (const d of Object.values(a.lag ?? {})) expect(d).toBeGreaterThanOrEqual(0)
  })
})
