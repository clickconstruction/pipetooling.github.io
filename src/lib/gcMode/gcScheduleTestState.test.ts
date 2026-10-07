/**
 * Main's test data for the schedule's kernels (`src/lib/gc/schedule/testState.ts`, the real build) is
 * written by to-dos/gc-mode/scripts/schedule-test-state.ts from this fixture, never by hand. This holds
 * main's file to exactly what the script writes, so a change to the fixture is written there too. It
 * reads the file as text: on the spike, main's shapes are the spike's whole ones (`gcMainShapes.ts`),
 * which main's trimmed test data does not fill.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { testStateSource } from '../../../to-dos/gc-mode/scripts/schedule-test-state'

describe('main\u2019s test data for the schedule', () => {
  it('is what the script writes from the made-up data', () => {
    expect(readFileSync(new URL('../gc/schedule/testState.ts', import.meta.url), 'utf8')).toBe(testStateSource())
  })
})
