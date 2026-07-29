/**
 * Pure kernel for the Takeoffs "In N assemblies" link: given every
 * material_template_items row, build a reverse index from part id to the
 * assemblies (material_templates) that contain it — directly, or through
 * nested assemblies — with the part's total quantity per assembly.
 */

/** The subset of a material_template_items row the index needs. */
export type PartAssemblyIndexItem = {
  template_id: string
  item_type: string
  part_id: string | null
  nested_template_id: string | null
  quantity: number
}

/** One assembly that contains a given part, with the part's total quantity in it. */
export type PartAssemblyEntry = { templateId: string; quantity: number }

/**
 * Expand each template to its leaf-part quantities (following nested
 * templates, multiplying quantities down the chain), then invert to
 * partId → assemblies. A template nested inside a cycle is expanded once
 * per chain and the revisit is skipped, so cycles terminate.
 */
export function buildPartAssemblyIndex(
  items: readonly PartAssemblyIndexItem[],
): Map<string, PartAssemblyEntry[]> {
  const itemsByTemplate = new Map<string, PartAssemblyIndexItem[]>()
  for (const item of items) {
    if (!item.template_id) continue
    const list = itemsByTemplate.get(item.template_id)
    if (list) list.push(item)
    else itemsByTemplate.set(item.template_id, [item])
  }

  // templateId -> (partId -> total quantity), memoized across roots.
  const expandedByTemplate = new Map<string, Map<string, number>>()

  function expand(templateId: string, chain: Set<string>): Map<string, number> {
    const memo = expandedByTemplate.get(templateId)
    if (memo) return memo
    if (chain.has(templateId)) return new Map()
    chain.add(templateId)
    const result = new Map<string, number>()
    for (const item of itemsByTemplate.get(templateId) ?? []) {
      const qty = Number(item.quantity) || 0
      if (item.item_type === 'part' && item.part_id) {
        result.set(item.part_id, (result.get(item.part_id) ?? 0) + qty)
      } else if (item.item_type === 'template' && item.nested_template_id) {
        for (const [partId, nestedQty] of expand(item.nested_template_id, chain)) {
          result.set(partId, (result.get(partId) ?? 0) + nestedQty * qty)
        }
      }
    }
    chain.delete(templateId)
    expandedByTemplate.set(templateId, result)
    return result
  }

  const index = new Map<string, PartAssemblyEntry[]>()
  for (const templateId of itemsByTemplate.keys()) {
    for (const [partId, quantity] of expand(templateId, new Set())) {
      const entries = index.get(partId)
      const entry = { templateId, quantity }
      if (entries) entries.push(entry)
      else index.set(partId, [entry])
    }
  }
  return index
}
