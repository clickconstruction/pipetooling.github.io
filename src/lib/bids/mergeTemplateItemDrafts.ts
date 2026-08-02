/**
 * The Takeoff tab's part-merge rule — extracted from FOUR divergent
 * implementations (BIDS_TAKEOFF_TAB_ARCHITECTURE.md preserve-quirk #15):
 * parts merge by `part_id` (a template holds one row per part — quantities
 * add), while nested templates may repeat as separate rows.
 *
 * - `mergeTemplateItemDrafts` — the batch form (`saveTakeoffNewTemplate`'s
 *   pre-insert loop): collapses a draft list, first-occurrence order kept.
 * - `mergeItemIntoDrafts` — the single-item form (`addTakeoffNewTemplateItem`'s
 *   setState updater): merges a part into an existing row or appends.
 * - `mergedPartQuantity` — the shared `(existing.quantity ?? 1) + qty` rule the
 *   two DB-backed variants (`addEditTemplateItem`, `savePartsToTemplate`)
 *   apply when UPDATE-ing an existing row.
 */

export type TemplateItemDraft = {
  item_type: string
  part_id: string | null
  nested_template_id: string | null
  quantity: number
}

/** Batch form: merge parts by part_id (quantities add); nested templates repeat. */
export function mergeTemplateItemDrafts<T extends TemplateItemDraft>(items: Array<T | null | undefined>): TemplateItemDraft[] {
  const merged: TemplateItemDraft[] = []
  for (const item of items) {
    if (!item) continue
    if (item.item_type === 'part' && item.part_id) {
      const existing = merged.find((m) => m.item_type === 'part' && m.part_id === item.part_id)
      if (existing) {
        existing.quantity += item.quantity
      } else {
        merged.push({ ...item, quantity: item.quantity })
      }
    } else {
      merged.push({ ...item, quantity: item.quantity })
    }
  }
  return merged
}

/**
 * Single-item form: returns a NEW array with the item merged into an existing
 * part row (quantities add, `?? 1` default) or appended. Non-part items always
 * append. Safe as a React setState updater body.
 */
export function mergeItemIntoDrafts<T extends TemplateItemDraft>(prev: T[], item: T): T[] {
  if (item.item_type === 'part' && item.part_id) {
    const idx = prev.findIndex((p) => p.item_type === 'part' && p.part_id === item.part_id)
    if (idx >= 0) {
      const next = [...prev]
      next[idx] = { ...next[idx]!, quantity: (next[idx]!.quantity ?? 1) + item.quantity }
      return next
    }
  }
  return [...prev, item]
}

/** The DB-update quantity rule shared by the two persisted variants. */
export function mergedPartQuantity(existingQuantity: number | null | undefined, addedQuantity: number): number {
  return (existingQuantity ?? 1) + addedQuantity
}
