// What to insert / delete when the manager saves a tag's membership. Pure.

import type { CategoryTagMemberRow } from './categoryTags'

export type CategoryTagMembersDiff = {
  addCategories: string[]
  removeCategories: string[]
  addLabelIds: string[]
  removeLabelIds: string[]
}

export function diffCategoryTagMembers(
  tagId: string,
  current: readonly CategoryTagMemberRow[],
  nextCategories: readonly string[],
  nextLabelIds: readonly string[],
): CategoryTagMembersDiff {
  const curCats = new Map<string, string>()
  const curLabels = new Set<string>()
  for (const m of current) {
    if (m.tag_id !== tagId) continue
    if (m.bank_category) curCats.set(m.bank_category.trim().toLowerCase(), m.bank_category)
    else if (m.label_id) curLabels.add(m.label_id)
  }
  const wantCats = new Map<string, string>()
  for (const c of nextCategories) {
    const t = c.trim()
    if (t) wantCats.set(t.toLowerCase(), t)
  }
  const wantLabels = new Set(nextLabelIds.filter((id) => id.trim()))
  return {
    addCategories: [...wantCats.entries()].filter(([k]) => !curCats.has(k)).map(([, v]) => v),
    removeCategories: [...curCats.entries()].filter(([k]) => !wantCats.has(k)).map(([, v]) => v),
    addLabelIds: [...wantLabels].filter((id) => !curLabels.has(id)),
    removeLabelIds: [...curLabels].filter((id) => !wantLabels.has(id)),
  }
}
