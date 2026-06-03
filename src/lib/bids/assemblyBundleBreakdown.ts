/**
 * Pure aggregation kernel for the Takeoffs "Assembly bundle" breakdown modal.
 *
 * Given an assembly expanded to a flat list of parts (with quantities) and the
 * catalog prices for those parts across supply houses, compute the à-la-carte
 * cost of buying all the parts at each supply house — so it can be compared
 * against the supply-house bundle quotes (`material_template_prices`).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { expandTemplate } from '../materialPOUtils'
import { fetchLowestPartPricesBatch } from '../materialPartCatalogPrice'

/** A leaf part of an expanded assembly with its total quantity. */
export type BundlePart = { partId: string; quantity: number }

/** One catalog price row: a part's unit price at a supply house. */
export type PartPriceRow = { partId: string; supplyHouseId: string; price: number }

/** À-la-carte total for one supply house. */
export type SupplyHousePartTotal = {
  supplyHouseId: string
  /** Σ over parts priced at this house of unit_price × quantity. */
  total: number
  /** How many distinct parts in the assembly have no price at this house. */
  missingCount: number
}

/**
 * For each supply house that prices at least one of the assembly's parts, sum
 * `unit_price × quantity` over the parts it prices, and count how many of the
 * assembly's parts it does NOT price. A supply house that prices none of the
 * parts does not appear in the result.
 *
 * Quantities are merged by part first, so a part appearing twice in the
 * expansion contributes its combined quantity once.
 */
export function aggregatePartPricesBySupplyHouse(
  parts: BundlePart[],
  priceRows: PartPriceRow[],
): SupplyHousePartTotal[] {
  // Merge quantities by part (defensive: callers may pass an unmerged expansion).
  const qtyByPart = new Map<string, number>()
  for (const p of parts) {
    const pid = p.partId
    if (!pid) continue
    qtyByPart.set(pid, (qtyByPart.get(pid) ?? 0) + (Number(p.quantity) || 0))
  }
  const totalPartCount = qtyByPart.size

  // Index prices: supplyHouseId -> (partId -> price). Last price for a
  // (house, part) pair wins, which matches "one effective price" semantics.
  const priceByHouseAndPart = new Map<string, Map<string, number>>()
  for (const row of priceRows) {
    if (!qtyByPart.has(row.partId)) continue
    let perPart = priceByHouseAndPart.get(row.supplyHouseId)
    if (!perPart) {
      perPart = new Map<string, number>()
      priceByHouseAndPart.set(row.supplyHouseId, perPart)
    }
    perPart.set(row.partId, Number(row.price) || 0)
  }

  const result: SupplyHousePartTotal[] = []
  for (const [supplyHouseId, perPart] of priceByHouseAndPart) {
    let total = 0
    for (const [partId, price] of perPart) {
      total += price * (qtyByPart.get(partId) ?? 0)
    }
    result.push({
      supplyHouseId,
      total,
      missingCount: totalPartCount - perPart.size,
    })
  }
  return result
}

/** One part row for the breakdown modal's part list. */
export type BundleBreakdownPart = { partId: string; name: string; quantity: number }

/** À-la-carte total at a named supply house. */
export type BundleBreakdownSupplyHouseTotal = SupplyHousePartTotal & { supplyHouseName: string }

/** One supply-house bundle quote for the whole assembly. */
export type BundleBreakdownQuote = {
  priceId: string
  supplyHouseId: string
  supplyHouseName: string
  price: number
}

export type BundleBreakdown = {
  parts: BundleBreakdownPart[]
  /** À-la-carte: cost of all parts at each supply house, cheapest first. */
  perSupplyHouse: BundleBreakdownSupplyHouseTotal[]
  /** Supply-house bundle quotes from material_template_prices, cheapest first. */
  bundleQuotes: BundleBreakdownQuote[]
}

/**
 * Load everything the bundle breakdown modal needs for one assembly: its
 * expanded parts (names + merged quantities), the à-la-carte cost at each
 * supply house, and the supply-house bundle quotes. Fetches are thin; all
 * aggregation lives in {@link aggregatePartPricesBySupplyHouse}.
 */
export async function loadBundleBreakdown(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<BundleBreakdown> {
  // 1. Expand the assembly to leaf parts with merged quantities.
  const expanded = await expandTemplate(supabase, templateId, 1)
  const qtyByPart = new Map<string, number>()
  for (const { part_id, quantity } of expanded) {
    qtyByPart.set(part_id, (qtyByPart.get(part_id) ?? 0) + quantity)
  }
  const partIds = Array.from(qtyByPart.keys())

  // 2. Fetch part names, per-part catalog prices, and bundle quotes in parallel.
  const [partsRes, pricesRes, quotesRes] = await Promise.all([
    partIds.length > 0
      ? supabase.from('material_parts').select('id, name').in('id', partIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    partIds.length > 0
      ? supabase.from('material_part_prices').select('part_id, supply_house_id, price').in('part_id', partIds)
      : Promise.resolve({ data: [] as Array<{ part_id: string; supply_house_id: string; price: number }> }),
    supabase
      .from('material_template_prices')
      .select('id, supply_house_id, price, supply_houses(name)')
      .eq('template_id', templateId)
      .order('price', { ascending: true }),
  ])

  const nameById = new Map<string, string>()
  for (const p of (partsRes.data ?? []) as Array<{ id: string; name: string | null }>) {
    if (p?.id) nameById.set(p.id, p.name ?? '')
  }

  const parts: BundleBreakdownPart[] = partIds
    .map((partId) => ({ partId, name: nameById.get(partId) ?? partId.slice(0, 8), quantity: qtyByPart.get(partId) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // 3. À-la-carte aggregation via the pure kernel.
  const priceRows = ((pricesRes.data ?? []) as Array<{ part_id: string; supply_house_id: string; price: number }>).map(
    (r) => ({ partId: r.part_id, supplyHouseId: r.supply_house_id, price: r.price }),
  )
  type QuoteRow = { id: string; supply_house_id: string; price: number; supply_houses?: { name: string } | { name: string }[] | null }
  const quoteData = (quotesRes.data ?? []) as QuoteRow[]

  // Resolve supply-house names: bundle quotes embed them; à-la-carte houses
  // (those that price parts but have no bundle quote) need a follow-up fetch.
  const houseNameById = new Map<string, string>()
  for (const q of quoteData) {
    const sh = Array.isArray(q.supply_houses) ? q.supply_houses[0] : q.supply_houses
    if (sh?.name) houseNameById.set(q.supply_house_id, sh.name)
  }
  const unnamedHouseIds = Array.from(new Set(priceRows.map((r) => r.supplyHouseId))).filter(
    (id) => !houseNameById.has(id),
  )
  if (unnamedHouseIds.length > 0) {
    const { data: houses } = await supabase.from('supply_houses').select('id, name').in('id', unnamedHouseIds)
    for (const h of (houses ?? []) as Array<{ id: string; name: string | null }>) {
      if (h?.id) houseNameById.set(h.id, h.name ?? '')
    }
  }

  const perSupplyHouse: BundleBreakdownSupplyHouseTotal[] = aggregatePartPricesBySupplyHouse(
    parts.map((p) => ({ partId: p.partId, quantity: p.quantity })),
    priceRows,
  )
    .map((r) => ({ ...r, supplyHouseName: houseNameById.get(r.supplyHouseId) || r.supplyHouseId.slice(0, 8) }))
    .sort((a, b) => a.total - b.total)

  const bundleQuotes: BundleBreakdownQuote[] = quoteData.map((q) => {
    const sh = Array.isArray(q.supply_houses) ? q.supply_houses[0] : q.supply_houses
    return {
      priceId: q.id,
      supplyHouseId: q.supply_house_id,
      supplyHouseName: sh?.name ?? q.supply_house_id.slice(0, 8),
      price: Number(q.price) || 0,
    }
  })

  return { parts, perSupplyHouse, bundleQuotes }
}

/**
 * One expanded part of an assembly bundle, shown as a grayed, non-counting display
 * row beneath the bundle line in the Combined takeoff. `unitPrice` is the lowest
 * catalog price across supply houses (0 when none); `hasPrice` distinguishes a
 * genuine $0 from "no catalog price".
 */
export type BundlePartLine = {
  partId: string
  name: string
  quantity: number
  unitPrice: number
  supplyHouseName: string | null
  hasPrice: boolean
}

/** Lowest catalog price for a part, as returned by fetchLowestPartPricesBatch. */
export type LowestPartPrice = { price: number; supplyHouseName?: string | null }

/**
 * Pure shaping of an assembly's expanded parts into display rows: merge by part,
 * attach name (fallback to a short id) and lowest catalog price. No I/O.
 */
export function buildBundlePartLines(
  expandedParts: BundlePart[],
  nameById: ReadonlyMap<string, string>,
  lowestByPartId: ReadonlyMap<string, LowestPartPrice>,
): BundlePartLine[] {
  const qtyByPart = new Map<string, number>()
  for (const p of expandedParts) {
    if (!p.partId) continue
    qtyByPart.set(p.partId, (qtyByPart.get(p.partId) ?? 0) + (Number(p.quantity) || 0))
  }
  const lines: BundlePartLine[] = []
  for (const [partId, quantity] of qtyByPart) {
    const low = lowestByPartId.get(partId)
    lines.push({
      partId,
      name: nameById.get(partId) || partId.slice(0, 8),
      quantity,
      unitPrice: low ? Number(low.price) || 0 : 0,
      supplyHouseName: low?.supplyHouseName ?? null,
      hasPrice: low != null,
    })
  }
  lines.sort((a, b) => a.name.localeCompare(b.name))
  return lines
}

/**
 * Load an assembly's expanded parts as grayed display rows for the Combined takeoff:
 * each part with its merged quantity and lowest catalog price across supply houses.
 * Thin I/O around {@link buildBundlePartLines}.
 */
export async function loadBundlePartLines(
  supabase: SupabaseClient<Database>,
  templateId: string,
): Promise<BundlePartLine[]> {
  const expanded = await expandTemplate(supabase, templateId, 1)
  const merged = new Map<string, number>()
  for (const { part_id, quantity } of expanded) {
    merged.set(part_id, (merged.get(part_id) ?? 0) + quantity)
  }
  const partIds = Array.from(merged.keys())
  if (partIds.length === 0) return []

  const [partsRes, lowestByPartId] = await Promise.all([
    supabase.from('material_parts').select('id, name').in('id', partIds),
    fetchLowestPartPricesBatch(supabase, partIds),
  ])

  const nameById = new Map<string, string>()
  for (const p of (partsRes.data ?? []) as Array<{ id: string; name: string | null }>) {
    if (p?.id) nameById.set(p.id, p.name ?? '')
  }

  return buildBundlePartLines(
    partIds.map((partId) => ({ partId, quantity: merged.get(partId) ?? 0 })),
    nameById,
    lowestByPartId,
  )
}
