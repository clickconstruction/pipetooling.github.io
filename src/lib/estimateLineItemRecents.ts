import type { EstimateCatalogLineItem } from './estimateLineItemCatalog'

const STORAGE_PREFIX = 'estimate_line_item_recents_v1'

const INTERNAL_CAP = 20

export function estimateLineItemRecentsStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`
}

export function loadRecentCatalogIds(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw == null || raw === '') return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const x of parsed) {
      if (typeof x !== 'string') continue
      const id = x.trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(id)
      if (out.length >= INTERNAL_CAP) break
    }
    return out
  } catch {
    return []
  }
}

export function persistRecentCatalogIds(storageKey: string, ids: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids.slice(0, INTERNAL_CAP)))
  } catch {
    // ignore quota / private mode
  }
}

/** MRU: move picked id to front, dedupe, cap. */
export function recordRecentCatalogPick(currentIds: string[], pickedId: string): string[] {
  const id = pickedId.trim()
  if (!id) return currentIds
  const rest = currentIds.filter((x) => x !== id)
  return [id, ...rest].slice(0, INTERNAL_CAP)
}

export type ResolvedRecentChip = {
  id: string
  line_item: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
}

/** Up to 3 chips: only ids that still exist in the catalog. */
export function resolveRecentChips(
  recentIds: string[],
  catalog: EstimateCatalogLineItem[],
): ResolvedRecentChip[] {
  const byId = new Map(catalog.map((c) => [c.id, c] as const))
  const out: ResolvedRecentChip[] = []
  for (const rid of recentIds) {
    const c = byId.get(rid)
    if (!c) continue
    out.push({
      id: c.id,
      line_item: c.line_item,
      description: c.description,
      quantity: c.quantity,
      unit_price_cents: c.unit_price_cents,
      amount_cents: c.amount_cents,
    })
    if (out.length >= 3) break
  }
  return out
}
