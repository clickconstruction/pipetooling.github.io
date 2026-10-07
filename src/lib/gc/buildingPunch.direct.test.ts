/**
 * Main's own tests for the punch list (the Building lane's U2), run on the test data: the spike's own
 * case, Fair Oaks D's concrete with one item to fix, one fixed and waiting on our check, and one
 * checked.
 */
import { describe, expect, it } from 'vitest'
import { nextPunchId, punchClear, punchCounts, punchItems, punchState, punchWords } from './buildingPunch'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!

describe('the punch list', () => {
  it('says where each item stands, and counts a trade’s and the job’s', () => {
    const s = initialGcState()
    expect(punchItems(fairOaks(s), 'fconc').map(punchState)).toEqual(['open', 'fixed', 'done'])
    expect(punchCounts(fairOaks(s), 'fconc')).toEqual({ open: 1, fixed: 1, done: 1, total: 3 })
    expect(punchCounts(fairOaks(s))).toEqual({ open: 1, fixed: 1, done: 1, total: 3 })
    expect(punchWords(punchCounts(fairOaks(s), 'fconc'))).toBe('1 to fix, 1 fixed and waiting on our check, 1 checked')
    expect(punchWords({ open: 0, fixed: 0, done: 2, total: 2 })).toBe('2 checked')
  })

  it('is clear only when every item is checked fixed, or there are none', () => {
    const s = initialGcState()
    expect(punchClear(fairOaks(s), 'fconc')).toBe(false)
    expect(punchClear(fairOaks(s), 'fsite')).toBe(true)
    const checked = { ...fairOaks(s), punch: fairOaks(s).punch!.map((i) => ({ ...i, fixedOn: i.fixedOn ?? '2026-10-02', checkedOn: '2026-10-02' })) }
    expect(punchClear(checked, 'fconc')).toBe(true)
  })

  it('numbers the next item on the job', () => {
    const s = initialGcState()
    expect(nextPunchId(fairOaks(s))).toBe('fairoaksd-punch-4')
    expect(nextPunchId({ ...fairOaks(s), punch: [] })).toBe('fairoaksd-punch-1')
  })
})
