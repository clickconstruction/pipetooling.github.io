/**
 * Main's own tests for what a quote leaves out (the owner, 2026-10-04; the Board's B2-i): the
 * exclusions nobody covers yet, and the words for them, run through the kernels on the test data.
 * The spike's own case: Summit Roofing's quote on Boerne Retail Shell, roofing's Known exclusion
 * permits and fees, by the owner.
 */
import { describe, expect, it } from 'vitest'
import { exclusionListWords, uncoveredExclusions, unitPriceWords } from './exclusions'
import { initialGcState } from './schedule/testState'

describe('what a quote leaves out', () => {
  it('an exclusion is uncovered unless it is Known, priced per unit, or given a cost', () => {
    const roof = initialGcState().projects.find((p) => p.id === 'boerne')!.packages.find((k) => k.id === 'roof')!
    const bid = {
      ...roof.invites[0]!.bid!,
      exclusions: [{ name: 'Permits and fees' }, { name: 'Roof drains' }, { name: 'Rock', unitPrice: { amount: 38, unit: 'cy' } }, { name: 'Dewatering' }],
      exclusionCovers: { 'Roof drains': 1500 },
    }
    expect(uncoveredExclusions({ ...roof, excludes: [{ label: 'Permits and fees', by: 'the owner' }] }, bid).map((e) => e.name)).toEqual(['Dewatering'])
  })

  it('reads a list the way a sentence does, a unit price with it', () => {
    expect(unitPriceWords({ amount: 38, unit: 'cy' })).toBe('$38 per cy')
    expect(exclusionListWords([{ name: 'Permits and fees' }, { name: 'Rock', unitPrice: { amount: 38, unit: 'cy' } }, { name: 'Dewatering' }])).toBe(
      'permits and fees, rock ($38 per cy if it comes up) and dewatering',
    )
    expect(exclusionListWords([])).toBe('')
  })
})
