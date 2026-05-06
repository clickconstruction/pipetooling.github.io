import { describe, expect, it } from 'vitest'
import {
  accountingRuleLabelDisplayText,
  accountingRuleRowMatchesSearch,
  compareAccountingRulesForTableSort,
  sortAccountingRulesForTable,
} from './accountingRulesTableSearch'

describe('accountingRuleLabelDisplayText', () => {
  it('uses label name when present', () => {
    expect(accountingRuleLabelDisplayText('uuid-here', 'Parts')).toBe('Parts')
  })

  it('truncates id when name missing', () => {
    expect(accountingRuleLabelDisplayText('abcdefgh-1234', undefined)).toBe('abcdefgh')
  })
})

describe('accountingRuleRowMatchesSearch', () => {
  it('matches rule name substring', () => {
    expect(accountingRuleRowMatchesSearch('Ace Hardware -', 'Parts', 'ace')).toBe(true)
  })

  it('matches label substring', () => {
    expect(accountingRuleRowMatchesSearch('Other rule', 'Cost of Goods Sold', 'goods')).toBe(true)
  })

  it('is case insensitive', () => {
    expect(accountingRuleRowMatchesSearch('BIG NAME', 'x', 'big')).toBe(true)
  })

  it('returns false when neither matches', () => {
    expect(accountingRuleRowMatchesSearch('Alpha', 'Beta', 'gamma')).toBe(false)
  })
})

const row = (
  name: string,
  labelId: string,
  sortOrder: number,
  id: string,
): { name: string; label_id: string; sort_order: number; id: string } => ({
  name,
  label_id: labelId,
  sort_order: sortOrder,
  id,
})

describe('compareAccountingRulesForTableSort', () => {
  const labelFromId = (r: { label_id: string }) => `L-${r.label_id}`

  it('sorts by name ascending', () => {
    const a = row('Beta', 'b', 1, 'id-a')
    const b = row('Alpha', 'a', 2, 'id-b')
    expect(compareAccountingRulesForTableSort(a, b, 'name', 'asc', labelFromId)).toBeGreaterThan(0)
    expect(compareAccountingRulesForTableSort(b, a, 'name', 'asc', labelFromId)).toBeLessThan(0)
  })

  it('sorts by name descending', () => {
    const a = row('Alpha', 'a', 1, 'id-a')
    const b = row('Beta', 'b', 2, 'id-b')
    expect(compareAccountingRulesForTableSort(a, b, 'name', 'desc', labelFromId)).toBeGreaterThan(0)
  })

  it('ties name with sort_order then id', () => {
    const first = row('Same', 'x', 1, 'aaa')
    const second = row('Same', 'y', 2, 'bbb')
    expect(compareAccountingRulesForTableSort(first, second, 'name', 'asc', labelFromId)).toBeLessThan(0)
    expect(compareAccountingRulesForTableSort(second, first, 'name', 'asc', labelFromId)).toBeGreaterThan(0)
  })

  it('sorts by label via labelDisplay', () => {
    const a = row('N1', 'id-a', 1, 'r1')
    const b = row('N2', 'id-b', 2, 'r2')
    const display = (r: { label_id: string }) => (r.label_id === 'id-a' ? 'Zebra' : 'Apple')
    expect(compareAccountingRulesForTableSort(a, b, 'label', 'asc', display)).toBeGreaterThan(0)
    expect(compareAccountingRulesForTableSort(a, b, 'label', 'desc', display)).toBeLessThan(0)
  })
})

describe('sortAccountingRulesForTable', () => {
  it('returns a new array sorted by name', () => {
    const r1 = row('Charlie', 'c', 3, 'c')
    const r2 = row('Alpha', 'a', 1, 'a')
    const r3 = row('Bravo', 'b', 2, 'b')
    const input = [r1, r2, r3]
    const sorted = sortAccountingRulesForTable(input, 'name', 'asc', (r) => r.label_id)
    expect(sorted.map((r) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(input[0]!.name).toBe('Charlie')
  })
})
