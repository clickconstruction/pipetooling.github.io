/**
 * By customer's money (the Board's B2b-iii; gc 5, Owner Billing's read): each customer's band counts its open jobs at
 * `priceToOwner`, so the customers' "bidding" adds up to the Bidding section's worth and their "under contract" to
 * Buying out and Building's. A closed or lost job counts in neither, and the band never speaks of what is billed.
 */
import { describe, expect, it } from 'vitest'
import { boardSectionCounts, customerGroups, customerWorth, customerWorthWords } from './boardGroups'
import { boardStateFromRows } from './boardRows'
import { awardedClinicBoardRows } from './boardTestRows'
import { customerSummary } from './customers'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

/** The made-up data with Hollis Family Pharmacy's Stone Oak closed and Cibolo Creek's PADB lost. */
function withClosedAndLost(): GcState {
  const s = initialGcState()
  return {
    ...s,
    projects: s.projects.map((p) => (p.id === 'stoneoak' ? { ...p, closedOn: '2026-09-30' } : p.id === 'padb' ? { ...p, lostOn: '2026-09-29' } : p)),
  }
}

const states: [string, () => GcState][] = [
  ['the made-up data', () => initialGcState()],
  ['the clinic as a money reader maps it', () => boardStateFromRows(awardedClinicBoardRows())],
  ['the clinic for a reader with no Our number', () => boardStateFromRows({ ...awardedClinicBoardRows(), money: [], moneyShown: false })],
  ['the made-up data with a job closed and one lost', withClosedAndLost],
]

describe('By customer adds up to the sections', () => {
  it.each(states)('%s: the customers’ bidding is Bidding’s worth, their under contract Buying out and Building’s', (_label, make) => {
    const state = make()
    const worth = (key: string) => boardSectionCounts(state).find((c) => c.key === key)?.worth ?? 0
    const sums = customerGroups(state).reduce((t, g) => ({ bidding: t.bidding + customerWorth(g.open).bidding, underContract: t.underContract + customerWorth(g.open).underContract }), { bidding: 0, underContract: 0 })
    expect(sums.bidding).toBeCloseTo(worth('pursuing'), 6)
    expect(sums.underContract).toBeCloseTo(worth('buyout') + worth('building'), 6)
  })

  it('reads the money team’s price and the trades’ alone the same way', () => {
    const money = boardStateFromRows(awardedClinicBoardRows())
    const trades = boardStateFromRows({ ...awardedClinicBoardRows(), money: [], moneyShown: false })
    expect(customerWorth(customerGroups(money)[0]!.open).underContract).toBe(87323.4)
    expect(customerWorth(customerGroups(trades)[0]!.open).underContract).toBe(66500)
  })

  it('counts a closed job in neither, where the customer window’s summary still counts it under contract', () => {
    const state = withClosedAndLost()
    const hollis = customerGroups(state).find((g) => g.customer.name === 'Hollis Family Pharmacy')!
    expect(hollis.open).toHaveLength(0)
    expect(customerWorth(hollis.open)).toEqual({ bidding: 0, underContract: 0 })
    expect(customerWorthWords(hollis.open)).toBe('')
    expect(customerSummary(state, hollis.customer).underContract).toBeGreaterThan(0)
  })

  it('says what is in front of them and what is under contract, never what is billed', () => {
    const cibolo = customerGroups(initialGcState()).find((g) => g.customer.name === 'Cibolo Creek Partners')!
    expect(customerWorthWords(cibolo.open)).toBe('bidding $977,823 · under contract $1,488,762')
    for (const [, make] of states) for (const g of customerGroups(make())) expect(customerWorthWords(g.open)).not.toMatch(/billed|owes/)
  })
})
