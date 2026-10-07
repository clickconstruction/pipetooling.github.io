/**
 * The tests of `gcBoardGroups.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-ii). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { customerMoneyWords } from './boardGroups'
import type { CustomerSummary } from './customers'

describe('customerMoneyWords', () => {
  const base: CustomerSummary = { live: [], inFront: 0, underContract: 0, billed: 0, paid: 0, owed: 0, retainageHeld: 0, asked: 0, won: 0 }

  it('names what we are bidding, what is under contract and what they owe', () => {
    expect(customerMoneyWords({ ...base, inFront: 977_823, underContract: 1_488_762, billed: 900_000, owed: 288_879 })).toBe(
      'bidding $977,823 · under contract $1,488,762 · owes us $288,879',
    )
  })

  it('says nothing is billed yet before the first bill', () => {
    expect(customerMoneyWords({ ...base, underContract: 338_767 })).toBe('under contract $338,767 · nothing billed yet')
  })

  it('is empty when nothing is in front of them or under contract', () => {
    expect(customerMoneyWords(base)).toBe('')
  })
})
