import { describe, expect, it } from 'vitest'
import { customerGroups, customerMoneyWords, initialGcState, type CustomerGroup, type CustomerSummary, type GcState } from './gcModel'

const names = (state: GcState) => customerGroups(state).map((g) => [g.customer.name, g.open.map((p) => p.name)])

describe('customerGroups (the board by customer, question 9)', () => {
  it('groups the made-up projects by who they are for, the soonest bid first', () => {
    expect(names(initialGcState())).toEqual([
      ['Cibolo Creek Partners', ['Boerne Retail Shell', 'Boerne Retail Pad B', 'Fair Oaks Shops, Building D']],
      ['Dr. Priya Raman', ['Helotes Dental Office']],
      ['Hollis Family Pharmacy', ['Stone Oak Pharmacy']],
    ])
  })

  it('leaves out a company that is only an architect', () => {
    const shown = customerGroups(initialGcState()).map((g) => g.customer.name)
    expect(shown).not.toContain('Marsh & Vale Architects')
  })

  it('folds closed and lost jobs out of the open rows, and a customer with none open goes last', () => {
    const state = initialGcState()
    const today = state.today
    const moved: GcState = {
      ...state,
      projects: state.projects.map((p) =>
        p.id === 'stoneoak' ? { ...p, closedOn: today } : p.id === 'padb' ? { ...p, lostOn: today } : p,
      ),
    }
    const groups = customerGroups(moved)
    const cibolo = groups.find((g) => g.customer.id === 'cibolo')
    expect(cibolo?.open.map((p) => p.id)).toEqual(['boerne', 'fairoaksd'])
    expect(cibolo?.lost.map((p) => p.id)).toEqual(['padb'])
    const hollis = groups[groups.length - 1] as CustomerGroup | undefined
    expect(hollis?.customer.id).toBe('hollis')
    expect(hollis?.open).toEqual([])
    expect(hollis?.closed.map((p) => p.id)).toEqual(['stoneoak'])
  })
})

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
