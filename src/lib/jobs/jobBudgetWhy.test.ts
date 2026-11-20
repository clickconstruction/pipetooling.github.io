import { describe, expect, it } from 'vitest'
import { componentBurn } from './jobBudget'
import { budgetWhySentence } from './jobBudgetWhy'

describe('budgetWhySentence: the Job Budget card reads in dollars, never points', () => {
  const fmt = (x: number) => x.toLocaleString('en-US', { maximumFractionDigits: 0 })
  it('says materials blew the estimate, and what labor and subs are over or under for the work done', () => {
    const words = budgetWhySentence({
      // 86% of the labor budget spent at 77% done: $38,760 against the $34,527 the work calls for.
      labor: componentBurn({ usedUsd: 38_760, budgetUsd: 44_840, pctDone: 77 }),
      materials: componentBurn({ usedUsd: 37_900, budgetUsd: 31_200, pctDone: 77 }),
      // 57% of the subs budget spent at 77% done: $3,700 against $5,005.
      subs: componentBurn({ usedUsd: 3_700, budgetUsd: 6_500, pctDone: 77 }),
      pctDone: 77,
      fmt,
    })
    expect(words).toBe('Materials are $6,700 over the estimate with 23 % of the work left, labor is $4,233 over for the work done, and subs are $1,305 under for the work done.')
    expect(words).not.toMatch(/point/i)
  })
  it('names a component only five percentage points or more either side of the work, as before', () => {
    const near = componentBurn({ usedUsd: 54, budgetUsd: 100, pctDone: 50 })
    const far = componentBurn({ usedUsd: 55, budgetUsd: 100, pctDone: 50 })
    const none = componentBurn({ usedUsd: 0, budgetUsd: null, pctDone: 50 })
    expect(budgetWhySentence({ labor: near, materials: none, subs: none, pctDone: 50, fmt })).toBe('Every component is on pace with the work.')
    expect(budgetWhySentence({ labor: far, materials: none, subs: none, pctDone: 50, fmt })).toBe('Labor is $5 over for the work done.')
  })
  it('has words for nothing to read and for everything on pace', () => {
    const none = componentBurn({ usedUsd: 0, budgetUsd: null, pctDone: null })
    expect(budgetWhySentence({ labor: none, materials: none, subs: none, pctDone: null, fmt })).toBe('No component budget to read against yet.')
    const on = componentBurn({ usedUsd: 50, budgetUsd: 100, pctDone: 50 })
    expect(budgetWhySentence({ labor: on, materials: on, subs: on, pctDone: 50, fmt })).toBe('Every component is on pace with the work.')
  })
})
