/**
 * Main's own tests for a bid we lost (the owner, 2026-10-03; the Board's B2-i): the reasons in GC
 * words, whether a project is lost, and its line on the board, run through the kernels on the test
 * data. Nothing in the made-up data is lost, so Boerne Retail Pad B is lost here.
 */
import { describe, expect, it } from 'vitest'
import { packageIsOpen } from './followUp'
import { LOST_WHY, isLost, lostWhyLabel, lostWords } from './lost'
import { initialGcState } from './schedule/testState'

describe('a bid we lost', () => {
  it('says why in Trades mode’s loss reasons, in GC words', () => {
    expect(LOST_WHY.map((w) => w.key)).toEqual(['price', 'other_builder', 'project_died', 'no_bid', 'no_answer'])
    expect([lostWhyLabel('other_builder'), lostWhyLabel(null)]).toEqual(['Went with another builder', null])
  })

  it('a lost project reads lost with why and who won, and nobody is chased on it', () => {
    const padb = initialGcState().projects.find((p) => p.id === 'padb')!
    expect(isLost(padb)).toBe(false)
    const lost = { ...padb, lostOn: '2026-10-01', lostWhy: 'price' as const, wonBy: 'Hill Country Builders' }
    expect([isLost(lost), lostWords(lost)]).toEqual([true, 'Price too high · Hill Country Builders won it'])
    expect(lostWords({ ...lost, lostWhy: 'no_answer' as const, wonBy: null })).toBe('No answer from the customer')
    expect(packageIsOpen(lost, lost.packages[0]!)).toBe(false)
  })
})
