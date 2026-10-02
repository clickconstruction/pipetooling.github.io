/**
 * The reads behind Choose from the takeoff (v2.4107): the bid's count rows and part
 * lines (the base rows or the selected version's), the parts with their types, the
 * bundle names, the house behind each catalog price, the estimator's ticks, and the
 * rows already on a revision. One door, so the picker and the strip count the same.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { fetchAllRowsChunkedIn } from '../supabasePaging'
import { takeoffCandidates, type TakeoffAssemblyItem, type TakeoffCandidate, type TakeoffHouse, type TakeoffLine, type TakeoffPart } from './takeoffCandidates'

type Client = SupabaseClient<Database>

export type TakeoffCandidatesLoad = { candidates: TakeoffCandidate[]; fixtures: number; withProduct: number }

type AssemblyItemRow = { id: string; template_id: string; item_type: string; part_id: string | null; nested_template_id: string | null; quantity: number; sequence_order: number }

/**
 * What is inside the given assemblies, nested assemblies opened level by level (at most six), by
 * template id. Paged with a stable order (the row-cap rule). A failed read leaves the assemblies
 * closed — each stays one piece by its name.
 */
export async function loadAssemblyContents(supabase: Client, templateIds: ReadonlyArray<string>): Promise<Map<string, TakeoffAssemblyItem[]>> {
  const out = new Map<string, TakeoffAssemblyItem[]>()
  let next = [...new Set(templateIds)].filter(Boolean)
  for (let depth = 0; depth < 6 && next.length > 0; depth++) {
    let rows: AssemblyItemRow[]
    try {
      rows = await fetchAllRowsChunkedIn<AssemblyItemRow, string>(
        next,
        (chunk, from, to) =>
          supabase.from('material_template_items').select('id, template_id, item_type, part_id, nested_template_id, quantity, sequence_order').in('template_id', chunk).order('id', { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: AssemblyItemRow[] | null; error: { message: string } | null }>,
        'load assembly contents',
      )
    } catch {
      return out
    }
    for (const id of next) if (!out.has(id)) out.set(id, [])
    for (const r of rows) {
      const item: TakeoffAssemblyItem = { id: r.id, partId: r.item_type === 'part' ? r.part_id : null, nestedTemplateId: r.item_type === 'template' ? r.nested_template_id : null, quantity: Number(r.quantity) || 0, sequenceOrder: Number(r.sequence_order) || 0 }
      out.get(r.template_id)?.push(item)
    }
    next = [...new Set(rows.map((r) => (r.item_type === 'template' ? r.nested_template_id : null)).filter((x): x is string => !!x && !out.has(x)))]
  }
  return out
}

/**
 * The takeoff's fixtures as submittal candidates. Rows on the bid's selected version
 * win over the unsplit base rows of the same fixture; `alreadyOn` marks the count rows
 * a revision's items already came from.
 */
export async function loadTakeoffCandidates(supabase: Client, bidId: string, opts: { selectedVersionId?: string | null; revisionId?: string | null } = {}): Promise<TakeoffCandidatesLoad> {
  const [rowsRes, linesRes, choicesRes, onRes] = await Promise.all([
    supabase.from('bids_count_rows').select('id, fixture, count, bid_version_id, sequence_order').eq('bid_id', bidId).order('sequence_order'),
    supabase.from('bids_takeoff_rough_part_lines').select('id, count_row_id, sequence_order, part_id, source_template_id, quantity, unit_price, source_material_part_price_id, bid_version_id').eq('bid_id', bidId).order('sequence_order'),
    supabase.from('bid_submittal_takeoff_choices').select('count_row_id, ticked, split, product_line_ids').eq('bid_id', bidId),
    opts.revisionId ? supabase.from('bid_submittal_items').select('source_count_row_id').eq('submittal_id', opts.revisionId) : Promise.resolve({ data: [] as Array<{ source_count_row_id: string | null }> }),
  ])
  const sel = opts.selectedVersionId ?? null
  const allRows = (rowsRes.data ?? []) as Array<{ id: string; fixture: string | null; count: number; bid_version_id: string | null }>
  // The version's rows first, then the base rows whose fixture the version did not restate.
  const versionRows = sel ? allRows.filter((r) => r.bid_version_id === sel) : []
  const named = new Set(versionRows.map((r) => (r.fixture ?? '').trim().toUpperCase()))
  const baseRows = allRows.filter((r) => r.bid_version_id == null && !named.has((r.fixture ?? '').trim().toUpperCase()))
  const countRows = [...versionRows, ...baseRows].map((r) => ({ id: r.id, fixture: r.fixture, count: Number(r.count) || 0 }))
  const rowIds = new Set(countRows.map((r) => r.id))
  const lines: TakeoffLine[] = ((linesRes.data ?? []) as Array<{ id?: string; count_row_id: string; sequence_order?: number | null; part_id: string | null; source_template_id: string | null; quantity: number; unit_price: number; source_material_part_price_id: string | null }>)
    .filter((l) => rowIds.has(l.count_row_id))
    .map((l) => ({ id: l.id, countRowId: l.count_row_id, sequenceOrder: l.sequence_order ?? undefined, partId: l.part_id, sourceTemplateId: l.source_template_id, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unit_price) || 0, sourceMaterialPartPriceId: l.source_material_part_price_id }))

  const templateIds = [...new Set(lines.map((l) => l.sourceTemplateId).filter((x): x is string => !!x))]
  // Parts, not assemblies (2026-10-01): open every assembly the takeoff priced from, and read its parts too.
  const assemblies = await loadAssemblyContents(supabase, templateIds)
  const insideIds = [...assemblies.values()].flatMap((items) => items.map((it) => it.partId).filter((x): x is string => !!x))
  const partIds = [...new Set([...lines.map((l) => l.partId).filter((x): x is string => !!x), ...insideIds])]
  const priceIds = [...new Set(lines.map((l) => l.sourceMaterialPartPriceId).filter((x): x is string => !!x))]
  const [partsRes, templatesRes, pricesRes] = await Promise.all([
    partIds.length
      ? fetchAllRowsChunkedIn<{ id: string; name: string; manufacturer: string | null; part_types: { name: string } | { name: string }[] | null }, string>(
          partIds,
          (chunk, from, to) => supabase.from('material_parts').select('id, name, manufacturer, part_types(name)').in('id', chunk).order('id', { ascending: true }).range(from, to) as unknown as PromiseLike<{ data: Array<{ id: string; name: string; manufacturer: string | null; part_types: { name: string } | { name: string }[] | null }> | null; error: { message: string } | null }>,
          'load takeoff parts',
        ).then((data) => ({ data }), () => ({ data: [] }))
      : Promise.resolve({ data: [] }),
    templateIds.length ? supabase.from('material_templates').select('id, name').in('id', templateIds) : Promise.resolve({ data: [] }),
    priceIds.length ? supabase.from('material_part_prices').select('id, supply_house_id, supply_houses(name)').in('id', priceIds) : Promise.resolve({ data: [] }),
  ])
  const parts = new Map<string, TakeoffPart>()
  for (const p of (partsRes.data ?? []) as Array<{ id: string; name: string; manufacturer: string | null; part_types: { name: string } | { name: string }[] | null }>) {
    const pt = Array.isArray(p.part_types) ? p.part_types[0] : p.part_types
    parts.set(p.id, { name: p.name, manufacturer: p.manufacturer, partTypeName: pt?.name ?? null })
  }
  const templates = new Map<string, string>()
  for (const t of (templatesRes.data ?? []) as Array<{ id: string; name: string }>) templates.set(t.id, t.name)
  const houses = new Map<string, TakeoffHouse>()
  for (const pr of (pricesRes.data ?? []) as Array<{ id: string; supply_house_id: string; supply_houses: { name: string } | { name: string }[] | null }>) {
    const h = Array.isArray(pr.supply_houses) ? pr.supply_houses[0] : pr.supply_houses
    houses.set(pr.id, { houseId: pr.supply_house_id, houseName: h?.name ?? 'the house' })
  }
  const choices = new Map<string, boolean>()
  const splits = new Map<string, boolean>()
  const productKeys = new Map<string, string[]>()
  for (const c of (choicesRes.data ?? []) as Array<{ count_row_id: string; ticked: boolean; split?: boolean | null; product_line_ids?: string[] | null }>) {
    choices.set(c.count_row_id, c.ticked)
    if (c.split != null) splits.set(c.count_row_id, !!c.split)
    if (Array.isArray(c.product_line_ids)) productKeys.set(c.count_row_id, c.product_line_ids)
  }
  const alreadyOn = new Set<string>()
  for (const it of (onRes.data ?? []) as Array<{ source_count_row_id: string | null }>) if (it.source_count_row_id) alreadyOn.add(it.source_count_row_id)

  const candidates = takeoffCandidates({ countRows, lines, parts, templates, assemblies, houses, choices, splits, productKeys, alreadyOn })
  return { candidates, fixtures: candidates.length, withProduct: candidates.filter((c) => c.product).length }
}

/**
 * The estimator's ticks (and splits, v2.4118; the pieces switched in the product, v2.4292; order only,
 * 2026-10-02), one upsert per fixture shown; a split, pieces or an order-only pick not given are left as stored.
 */
export async function saveTakeoffChoices(supabase: Client, bidId: string, ticks: ReadonlyMap<string, boolean>, splits?: ReadonlyMap<string, boolean>, productKeys?: ReadonlyMap<string, ReadonlyArray<string>>, orderOnly?: ReadonlyMap<string, boolean>): Promise<void> {
  const rows = [...ticks.entries()].map(([count_row_id, ticked]) => ({
    bid_id: bidId,
    count_row_id,
    ticked,
    ...(splits?.has(count_row_id) ? { split: !!splits.get(count_row_id) } : {}),
    ...(productKeys?.has(count_row_id) ? { product_line_ids: [...productKeys.get(count_row_id)!] } : {}),
    // 2026-10-02 · the fixture comes on as an order-only row; not given, it is left as stored.
    ...(orderOnly?.has(count_row_id) ? { order_only: !!orderOnly.get(count_row_id) } : {}),
  }))
  if (rows.length === 0) return
  const { error } = await supabase.from('bid_submittal_takeoff_choices').upsert(rows, { onConflict: 'bid_id,count_row_id' })
  if (error) throw error
}
