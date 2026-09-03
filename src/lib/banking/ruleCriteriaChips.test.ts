import { describe, expect, it } from 'vitest'
import { parseAccountingLabelRuleCriteria } from '../accountingLabelRuleMatch'
import { buildCategoryTagLookups, type CategoryTagRow } from './categoryTags'
import { describeRuleCriteria, ruleTagId } from './ruleCriteriaChips'

const fuel: CategoryTagRow = { id: 't-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }
const lookups = buildCategoryTagLookups([fuel], [
  { tag_id: 't-fuel', bank_category: 'FuelAndGas', label_id: null },
  { tag_id: 't-fuel', bank_category: null, label_id: 'lbl-fuel' },
])

describe('describeRuleCriteria', () => {
  it('renders every clause as a chip, amounts normalised', () => {
    const c = parseAccountingLabelRuleCriteria({
      v: 1,
      counterparty: { op: 'contains', value: ' QuikTrip ' },
      amount: { min: -20, max: -120 },
      bankTag: { tagId: 't-fuel', categories: ['FuelAndGas'] },
    })
    const chips = describeRuleCriteria(c, lookups)
    expect(chips.map((x) => x.key)).toEqual(['counterparty', 'amount', 'bankTag'])
    expect(chips[0]).toMatchObject({ kind: 'text', label: 'counterparty contains', value: 'QuikTrip' })
    expect(chips[1]).toMatchObject({ kind: 'text', label: 'amount', value: '−$120 to −$20' })
    expect(chips[2]).toMatchObject({ kind: 'tag', tag: { id: 't-fuel' } })
  })
  it('flags a tag that no longer exists, and a rule with nothing to match on', () => {
    const gone = parseAccountingLabelRuleCriteria({ v: 1, bankTag: { tagId: 't-old', categories: ['Retail'] } })
    expect(describeRuleCriteria(gone, lookups)[0]).toMatchObject({ kind: 'tag-missing', categories: ['Retail'] })
    expect(describeRuleCriteria(parseAccountingLabelRuleCriteria({ v: 1 }), lookups)[0]).toMatchObject({ key: 'none' })
    expect(describeRuleCriteria(null, lookups)[0]).toMatchObject({ key: 'invalid' })
    expect(describeRuleCriteria(parseAccountingLabelRuleCriteria({ v: 1, amount: { max: 0 } }), null)[0]).toMatchObject({ value: '≤ $0' })
  })
})

describe('ruleTagId', () => {
  it('uses the bankTag clause, else the accounting label’s tag', () => {
    expect(ruleTagId(parseAccountingLabelRuleCriteria({ v: 1, bankTag: { tagId: 't-fuel', categories: [] } }), 'lbl-other', lookups)).toBe('t-fuel')
    expect(ruleTagId(parseAccountingLabelRuleCriteria({ v: 1, counterparty: { op: 'contains', value: 'x' } }), 'lbl-fuel', lookups)).toBe('t-fuel')
    expect(ruleTagId(parseAccountingLabelRuleCriteria({ v: 1 }), 'lbl-none', lookups)).toBeNull()
    expect(ruleTagId(null, 'lbl-fuel', null)).toBeNull()
  })
})
