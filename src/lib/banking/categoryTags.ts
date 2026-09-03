// Bank-category tags (Variant D, 2026-09-03): a tag is a name, an icon, a
// color, the Mercury categories it covers and the accounting labels it stands
// for. Rules point at a tag (`bankTag` clause); Review / Job Summary can draw
// a tag as its own cost line. Pure helpers + the default families used to
// seed an org and to "Reset to defaults". The SQL seed in the migration
// mirrors `DEFAULT_CATEGORY_TAGS` — keep the two lists identical.

export const CATEGORY_TAG_COLORS = ['amber', 'blue', 'violet', 'teal', 'gray', 'rose'] as const
export type CategoryTagColor = (typeof CATEGORY_TAG_COLORS)[number]

export type CategoryTagRow = {
  id: string
  name: string
  icon: string
  color: CategoryTagColor
  sort_order: number
  default_key: string | null
  show_as_cost_line: boolean
  hide_from_picker: boolean
}

export type CategoryTagMemberRow = {
  tag_id: string
  bank_category: string | null
  label_id: string | null
}

export type CategoryTagDef = {
  defaultKey: string
  name: string
  icon: string
  color: CategoryTagColor
  /** Mercury category strings exactly as the bank spells them. */
  bankCategories: readonly string[]
  /** `mercury_drag_sort_labels.default_key` values. */
  labelDefaultKeys: readonly string[]
  showAsCostLine: boolean
}

export const DEFAULT_CATEGORY_TAGS: readonly CategoryTagDef[] = [
  {
    defaultKey: 'fuel_vehicle',
    name: 'Fuel & gas',
    icon: '⛽',
    color: 'amber',
    bankCategories: ['FuelAndGas', 'VehicleExpenses', 'Parking'],
    labelDefaultKeys: ['fuel_gas', 'car_truck_expenses', 'vehicle_maintenance_repairs'],
    showAsCostLine: true,
  },
  {
    defaultKey: 'retail_supply',
    name: 'Retail & supply',
    icon: '🛒',
    color: 'blue',
    bankCategories: ['Retail', 'Electronics'],
    labelDefaultKeys: ['cogs_part_iii', 'supplies', 'job_materials_parts', 'shop_supplies', 'consumables', 'tools_small_equipment'],
    showAsCostLine: false,
  },
  {
    defaultKey: 'office_software',
    name: 'Office & software',
    icon: '💻',
    color: 'violet',
    bankCategories: ['Software', 'Utilities', 'Insurance', 'InternetAndTelephone', 'Advertising', 'Education', 'Medical'],
    labelDefaultKeys: ['office_expense', 'utilities', 'insurance', 'advertising', 'employee_benefits', 'rent_lease_20a', 'rent_lease_20b', 'repairs_maintenance'],
    showAsCostLine: false,
  },
  {
    defaultKey: 'fees_services',
    name: 'Fees & services',
    icon: '🧾',
    color: 'teal',
    bankCategories: ['Fees', 'ProfessionalServices'],
    labelDefaultKeys: ['commissions_fees', 'legal_professional', 'contract_labor', 'bad_debts_27b'],
    showAsCostLine: false,
  },
  {
    defaultKey: 'government',
    name: 'Government',
    icon: '🏛',
    color: 'gray',
    bankCategories: ['GovernmentServices', 'BooksAndNewspaper'],
    labelDefaultKeys: ['taxes_licenses'],
    showAsCostLine: false,
  },
  {
    defaultKey: 'food_travel',
    name: 'Food & travel',
    icon: '🍔',
    color: 'rose',
    bankCategories: ['Restaurants', 'Lodging', 'Grocery', 'GroundTransportation', 'AlcoholAndBars'],
    labelDefaultKeys: ['travel', 'meals'],
    showAsCostLine: false,
  },
]

/** Every bank category the defaults claim — used to list the unassigned ones. */
export const DEFAULT_TAGGED_BANK_CATEGORIES: ReadonlySet<string> = new Set(
  DEFAULT_CATEGORY_TAGS.flatMap((t) => [...t.bankCategories]),
)

export type CategoryTagLookups = {
  /** tag id → the bank categories it covers (lower-cased, for matching). */
  categoriesByTagId: ReadonlyMap<string, readonly string[]>
  /** tag id → the same categories in the bank's own spelling (for display and snapshots). */
  categoryNamesByTagId: ReadonlyMap<string, readonly string[]>
  /** lower-cased bank category → owning tag id (a category belongs to at most one tag). */
  tagIdByCategory: ReadonlyMap<string, string>
  /** label id → owning tag id. */
  tagIdByLabelId: ReadonlyMap<string, string>
  tagsById: ReadonlyMap<string, CategoryTagRow>
}

export function buildCategoryTagLookups(
  tags: readonly CategoryTagRow[],
  members: readonly CategoryTagMemberRow[],
): CategoryTagLookups {
  const categoriesByTagId = new Map<string, string[]>()
  const categoryNamesByTagId = new Map<string, string[]>()
  const tagIdByCategory = new Map<string, string>()
  const tagIdByLabelId = new Map<string, string>()
  const tagsById = new Map<string, CategoryTagRow>()
  for (const t of tags) {
    tagsById.set(t.id, t)
    categoriesByTagId.set(t.id, [])
    categoryNamesByTagId.set(t.id, [])
  }
  for (const m of members) {
    if (!tagsById.has(m.tag_id)) continue
    if (m.bank_category) {
      const name = m.bank_category.trim()
      const key = name.toLowerCase()
      if (!key) continue
      categoriesByTagId.get(m.tag_id)!.push(key)
      categoryNamesByTagId.get(m.tag_id)!.push(name)
      tagIdByCategory.set(key, m.tag_id)
    } else if (m.label_id) {
      tagIdByLabelId.set(m.label_id, m.tag_id)
    }
  }
  return { categoriesByTagId, categoryNamesByTagId, tagIdByCategory, tagIdByLabelId, tagsById }
}

/** The tag a card charge belongs to: its accounting label's tag first, else its bank category's tag. */
export function categoryTagForCharge(
  lookups: CategoryTagLookups,
  labelId: string | null | undefined,
  bankCategory: string | null | undefined,
): CategoryTagRow | null {
  if (labelId) {
    const byLabel = lookups.tagIdByLabelId.get(labelId)
    if (byLabel) return lookups.tagsById.get(byLabel) ?? null
    // A labelled charge that belongs to no tag stays untagged — the label is
    // a human decision and outranks the bank's guess.
    return null
  }
  const key = (bankCategory ?? '').trim().toLowerCase()
  if (!key) return null
  const byCat = lookups.tagIdByCategory.get(key)
  return byCat ? (lookups.tagsById.get(byCat) ?? null) : null
}
