import { describe, expect, it } from 'vitest'
import { referenceGradeChip, referenceGradeChipApplies } from './referenceGradeChip'

describe('referenceGradeChipApplies', () => {
  it('applies to sent bids, decided bids, and sent+decided bids', () => {
    expect(referenceGradeChipApplies({ bid_date_sent: '2026-09-01', outcome: null })).toBe(true)
    expect(referenceGradeChipApplies({ bid_date_sent: null, outcome: 'lost' })).toBe(true)
    expect(referenceGradeChipApplies({ bid_date_sent: '2026-09-01', outcome: 'won' })).toBe(true)
  })

  it('does not apply to a working (unsent, undecided) bid', () => {
    expect(referenceGradeChipApplies({ bid_date_sent: null, outcome: null })).toBe(false)
  })
})

describe('referenceGradeChip', () => {
  const full = { hasPlans: true, hasValue: true, hasCounts: true, hasPricing: true }

  it('grade A has no missing line', () => {
    expect(referenceGradeChip(full)).toEqual({ grade: 'A', missingLine: null })
  })

  it('X: no plans dominates everything else', () => {
    const chip = referenceGradeChip({ ...full, hasPlans: false })
    expect(chip.grade).toBe('X')
    expect(chip.missingLine).toMatch(/no plans link/)
  })

  it('B with counts but no pricing names the pricing gap', () => {
    const chip = referenceGradeChip({ ...full, hasPricing: false })
    expect(chip.grade).toBe('B')
    expect(chip.missingLine).toMatch(/no priced rows/)
    expect(chip.missingLine).toMatch(/learn pricing/)
  })

  it('B with no counts names the counts gap', () => {
    const chip = referenceGradeChip({ ...full, hasCounts: false, hasPricing: false })
    expect(chip.grade).toBe('B')
    expect(chip.missingLine).toMatch(/no takeoff rows/)
  })

  it('C: counts without a value names the dollars gap', () => {
    const chip = referenceGradeChip({ hasPlans: true, hasValue: false, hasCounts: true, hasPricing: false })
    expect(chip.grade).toBe('C')
    expect(chip.missingLine).toMatch(/no final value/)
  })

  it('D: plans only is a census reference', () => {
    const chip = referenceGradeChip({ hasPlans: true, hasValue: false, hasCounts: false, hasPricing: false })
    expect(chip.grade).toBe('D')
    expect(chip.missingLine).toMatch(/plans-only census/)
  })

  it('pricing without counts never fakes an A (mirrors referenceGrade, no fork)', () => {
    const chip = referenceGradeChip({ hasPlans: true, hasValue: true, hasCounts: false, hasPricing: true })
    expect(chip.grade).toBe('B')
    expect(chip.missingLine).toMatch(/no takeoff rows/)
  })
})
