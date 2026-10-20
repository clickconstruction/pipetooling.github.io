/**
 * The tests of `gcBoardGroups.test.ts` on branch spike/gc-mode that read only B2b-i's kernels and the made-up data, moved word for word
 * (the Board's B2b-i), beside the ones earlier lifts moved. The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import type { CustomerGroup } from './boardGroups'
import { boardSectionCounts, boardSectionWorthWords, customerGroups } from './boardGroups'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

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

describe('the stage strip (the owner, 2026-10-04)', () => {
  it('counts each section and what it is worth', () => {
    const counts = boardSectionCounts(initialGcState())
    expect(counts.map((c) => `${c.key} ${c.count}`)).toEqual(['pursuing 2', 'buyout 1', 'building 2', 'closed 0', 'lost 0'])
    expect(counts.map(boardSectionWorthWords)).toEqual(['$977,823 priced so far', '$338,767 under contract', '$1,671,175 under contract', '', ''])
  })
})
