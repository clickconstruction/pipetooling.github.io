import { describe, expect, it } from 'vitest'
import { laborCountsOutOfStep } from './laborCountsDrift'

/**
 * The Pricing strip's labor honesty line (punch list #137 PR 2): it shows exactly when the
 * Labor tab's own load sync would change something for this version's counts, and never
 * otherwise — the detector IS `planLaborSync`, so the two can't disagree.
 */

const COUNTS = [
  { fixture: 'Floor drain 3"', count: 12 },
  { fixture: 'Water closet', count: 9 },
]
const LABOR_IN_STEP = [
  { id: 'l1', fixture: 'Floor drain 3"', count: 12 },
  { id: 'l2', fixture: 'Water closet', count: 9 },
]

describe('laborCountsOutOfStep', () => {
  it('labor synced to these counts: quiet', () => {
    expect(laborCountsOutOfStep({ countRows: COUNTS, laborRows: LABOR_IN_STEP })).toBe(false)
  })

  it('a count moved since the last Labor visit', () => {
    expect(laborCountsOutOfStep({ countRows: [{ fixture: 'Floor drain 3"', count: 14 }, COUNTS[1]!], laborRows: LABOR_IN_STEP })).toBe(true)
  })

  it('this version counts a fixture labor has never seen', () => {
    expect(laborCountsOutOfStep({ countRows: [...COUNTS, { fixture: 'Hub drain', count: 3 }], laborRows: LABOR_IN_STEP })).toBe(true)
  })

  it('labor still carries a fixture this version does not count', () => {
    expect(laborCountsOutOfStep({ countRows: [COUNTS[0]!], laborRows: LABOR_IN_STEP })).toBe(true)
  })

  it('an alternate group splits one name over two count rows: their sum is what labor holds', () => {
    expect(
      laborCountsOutOfStep({
        countRows: [{ fixture: 'Water closet', count: 6 }, { fixture: 'Water closet', count: 3 }, COUNTS[0]!],
        laborRows: LABOR_IN_STEP,
      }),
    ).toBe(false)
  })

  it('no labor rows yet: the setup story, not drift', () => {
    expect(laborCountsOutOfStep({ countRows: COUNTS, laborRows: [] })).toBe(false)
  })

  it('no counts: quiet (the Workbench is not rendered anyway)', () => {
    expect(laborCountsOutOfStep({ countRows: [], laborRows: LABOR_IN_STEP })).toBe(false)
  })
})
