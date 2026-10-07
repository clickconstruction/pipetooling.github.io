/**
 * The tests of `gcBench.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-ii). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { assistantRules, itemsByTrade, tradeTodoCounts } from './bench'
import { initialGcState } from './schedule/testState'

describe('trade headings (the owner, 2026-10-04)', () => {
  it('every to-do names its trade, the strip counts them, and a list groups under each trade', () => {
    const rules = assistantRules(initialGcState())
    const items = rules.flatMap((r) => r.items)
    expect(items.every((i) => i.trade !== undefined)).toBe(true)
    const counts = tradeTodoCounts(rules)
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(items.filter((i) => i.trade).length)
    const bench = rules.find((r) => r.key === 'bench')
    const grouped = itemsByTrade(bench?.items ?? [])
    expect(grouped.map((g) => g.trade)).toEqual((bench?.items ?? []).map((i) => i.trade))
  })
})
