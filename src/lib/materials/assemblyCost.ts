/**
 * Recursive assembly (material template) cost roll-up — extracted from the
 * closure version inside Materials.tsx (Stage A of the Materials
 * decomposition; see docs/MATERIALS_TABS_ARCHITECTURE.md).
 *
 * Inputs are explicit (no component-state closure): `items` is the page's
 * `allTemplateItemsForStats` cache (all template items for the service type),
 * `lowestPriceByPartId` the page's `partIdToLowestPrice` map.
 *
 * Preserved quirks:
 * - a part with lowest price `<= 0` (or absent) counts as a MISSING price, not
 *   a zero-cost part;
 * - `item.quantity || 1` — quantity 0 rolls up as 1;
 * - the `visited` set guards cycles: a template already on the current path
 *   contributes zeros (direct self-reference is also blocked at add time by
 *   the Add Item handlers, but deeper cycles are only handled here).
 */
export type AssemblyCostItem = {
  template_id: string
  item_type: string
  part_id: string | null
  nested_template_id: string | null
  quantity: number
}

export type AssemblyCostResult = {
  total: number
  missingPrices: number
  partCount: number
  nestedCount: number
}

export function calculateAssemblyCost(
  templateId: string,
  items: AssemblyCostItem[],
  lowestPriceByPartId: Record<string, number>,
  parentQuantity: number = 1,
  visited: Set<string> = new Set()
): AssemblyCostResult {
  // Prevent infinite recursion
  if (visited.has(templateId)) {
    return { total: 0, missingPrices: 0, partCount: 0, nestedCount: 0 }
  }
  visited.add(templateId)

  const templateItems = items.filter(i => i.template_id === templateId)
  let total = 0
  let missingPrices = 0
  let partCount = 0
  let nestedCount = 0

  for (const item of templateItems) {
    const itemQuantity = item.quantity || 1
    const effectiveQuantity = itemQuantity * parentQuantity

    if (item.item_type === 'part' && item.part_id) {
      partCount++
      const lowestPrice = lowestPriceByPartId[item.part_id]
      if (lowestPrice != null && lowestPrice > 0) {
        total += lowestPrice * effectiveQuantity
      } else {
        missingPrices++
      }
    } else if (item.item_type === 'template' && item.nested_template_id) {
      nestedCount++
      const nestedResult = calculateAssemblyCost(
        item.nested_template_id,
        items,
        lowestPriceByPartId,
        effectiveQuantity,
        visited
      )
      total += nestedResult.total
      missingPrices += nestedResult.missingPrices
      partCount += nestedResult.partCount
      nestedCount += nestedResult.nestedCount
    }
  }

  return { total, missingPrices, partCount, nestedCount }
}
