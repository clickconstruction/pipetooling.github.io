import { describe, expect, it } from 'vitest'
import { diffCategoryTagMembers } from './categoryTagMembersDiff'

describe('diffCategoryTagMembers', () => {
  const current = [
    { tag_id: 't1', bank_category: 'FuelAndGas', label_id: null },
    { tag_id: 't1', bank_category: 'Parking', label_id: null },
    { tag_id: 't1', bank_category: null, label_id: 'l1' },
    { tag_id: 't2', bank_category: 'Retail', label_id: null }, // another tag — ignored
  ]
  it('computes adds and removes, case-insensitively for categories', () => {
    const d = diffCategoryTagMembers('t1', current, ['fuelandgas', 'VehicleExpenses', ' '], ['l2'])
    expect(d.addCategories).toEqual(['VehicleExpenses'])
    expect(d.removeCategories).toEqual(['Parking'])
    expect(d.addLabelIds).toEqual(['l2'])
    expect(d.removeLabelIds).toEqual(['l1'])
  })
  it('is empty when nothing changed', () => {
    expect(diffCategoryTagMembers('t1', current, ['FuelAndGas', 'Parking'], ['l1'])).toEqual({ addCategories: [], removeCategories: [], addLabelIds: [], removeLabelIds: [] })
  })
})
