import { describe, expect, it } from 'vitest'
import {
  CATEGORY_TAG_COLORS,
  DEFAULT_CATEGORY_TAGS,
  DEFAULT_TAGGED_BANK_CATEGORIES,
  buildCategoryTagLookups,
  categoryTagForCharge,
  type CategoryTagRow,
} from './categoryTags'

const fuel: CategoryTagRow = { id: 't-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }
const office: CategoryTagRow = { id: 't-office', name: 'Office & software', icon: '💻', color: 'violet', sort_order: 10, default_key: 'office_software', show_as_cost_line: false, hide_from_picker: false }

describe('DEFAULT_CATEGORY_TAGS', () => {
  it('claims each bank category and label once, with valid colors and unique keys', () => {
    const cats = DEFAULT_CATEGORY_TAGS.flatMap((t) => [...t.bankCategories])
    expect(new Set(cats).size).toBe(cats.length)
    const labels = DEFAULT_CATEGORY_TAGS.flatMap((t) => [...t.labelDefaultKeys])
    expect(new Set(labels).size).toBe(labels.length)
    const keys = DEFAULT_CATEGORY_TAGS.map((t) => t.defaultKey)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of DEFAULT_CATEGORY_TAGS) expect(CATEGORY_TAG_COLORS).toContain(t.color)
    expect(DEFAULT_TAGGED_BANK_CATEGORIES.has('FuelAndGas')).toBe(true)
    expect(DEFAULT_TAGGED_BANK_CATEGORIES.has('Other')).toBe(false)
    expect(DEFAULT_CATEGORY_TAGS.filter((t) => t.showAsCostLine).map((t) => t.defaultKey)).toEqual(['fuel_vehicle'])
  })
})

describe('buildCategoryTagLookups + categoryTagForCharge', () => {
  const lookups = buildCategoryTagLookups(
    [fuel, office],
    [
      { tag_id: 't-fuel', bank_category: 'FuelAndGas', label_id: null },
      { tag_id: 't-fuel', bank_category: 'VehicleExpenses', label_id: null },
      { tag_id: 't-fuel', bank_category: null, label_id: 'lbl-fuel' },
      { tag_id: 't-office', bank_category: 'Software', label_id: null },
      { tag_id: 'ghost', bank_category: 'Retail', label_id: null }, // unknown tag ignored
    ],
  )
  it('indexes categories (lower-cased) and labels by tag', () => {
    expect(lookups.categoriesByTagId.get('t-fuel')).toEqual(['fuelandgas', 'vehicleexpenses'])
    expect(lookups.tagIdByCategory.get('software')).toBe('t-office')
    expect(lookups.tagIdByCategory.has('retail')).toBe(false)
    expect(lookups.tagIdByLabelId.get('lbl-fuel')).toBe('t-fuel')
  })
  it('lets the label decide, then falls back to the bank category', () => {
    expect(categoryTagForCharge(lookups, 'lbl-fuel', 'Retail')?.id).toBe('t-fuel')
    expect(categoryTagForCharge(lookups, 'lbl-untagged', 'FuelAndGas')).toBeNull()
    expect(categoryTagForCharge(lookups, null, 'fuelandgas')?.id).toBe('t-fuel')
    expect(categoryTagForCharge(lookups, null, 'Other')).toBeNull()
    expect(categoryTagForCharge(lookups, null, null)).toBeNull()
  })
})
