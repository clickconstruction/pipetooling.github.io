/**
 * The reads behind Choose from the takeoff (v2.4107): the bid's count rows and part
 * lines (the base rows or the selected version's), the parts with their types, the
 * bundle names, the house behind each catalog price, the estimator's ticks, and the
 * rows already on a revision. One door, so the picker and the strip count the same.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { takeoffCandidates, type TakeoffCandidate, type TakeoffHouse, type TakeoffLine, type TakeoffPart } from './takeoffCandidates'

type Client = SupabaseClient<Database>

export type TakeoffCandidatesLoad = { candidates: TakeoffCandidate[]; fixtures: number; withProduct: number }

/**
 * The takeoff's fixtures as submittal candidates. Rows on the bid's selected version
 * win over the unsplit base rows of the same fixture; `alreadyOn` marks the count rows
 * a revision's items already came from.
 */
export async function loadTakeoffCandidates(supabase: Client, bidId: string, opts: { selectedVersionId?: string | null; revisionId?: string | null } = {}): Promise<TakeoffCandidatesLoad> {
  const [rowsRes, linesRes, choicesRes, onRes] = await Promise.all([
    supabase.from('bids_count_rows').select('id, fixture, count, bid_version_id, sequence_order').eq('bid_id', bidId).order('sequence_order'),
    supabase.from('bids_takeoff_rough_part_lines').select('count_row_id, part_id, source_template_id, quantity, unit_price, source_material_part_price_id, bid_version_id').eq('bid_id', bidId),
    supabase.from('bid_submittal_takeoff_choices').select('count_row_id, ticked, split').eq('bid_id', bidId),
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
  const lines: TakeoffLine[] = ((linesRes.data ?? []) as Array<{ count_row_id: string; part_id: string | null; source_template_id: string | null; quantity: number; unit_price: number; source_material_part_price_id: string | null }>)
    .filter((l) => rowIds.has(l.count_row_id))
    .map((l) => ({ countRowId: l.count_row_id, partId: l.part_id, sourceTemplateId: l.source_template_id, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unit_price) || 0, sourceMaterialPartPriceId: l.source_material_part_price_id }))

  const partIds = [...new Set(lines.map((l) => l.partId).filter((x): x is string => !!x))]
  const templateIds = [...new Set(lines.map((l) => l.sourceTemplateId).filter((x): x is string => !!x))]
  const priceIds = [...new Set(lines.map((l) => l.sourceMaterialPartPriceId).filter((x): x is string => !!x))]
  const [partsRes, templatesRes, pricesRes] = await Promise.all([
    partIds.length ? supabase.from('material_parts').select('id, name, manufacturer, part_types(name)').in('id', partIds) : Promise.resolve({ data: [] }),
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
  for (const c of (choicesRes.data ?? []) as Array<{ count_row_id: string; ticked: boolean; split?: boolean | null }>) {
    choices.set(c.count_row_id, c.ticked)
    if (c.split != null) splits.set(c.count_row_id, !!c.split)
  }
  const alreadyOn = new Set<string>()
  for (const it of (onRes.data ?? []) as Array<{ source_count_row_id: string | null }>) if (it.source_count_row_id) alreadyOn.add(it.source_count_row_id)

  const candidates = takeoffCandidates({ countRows, lines, parts, templates, houses, choices, splits, alreadyOn })
  return { candidates, fixtures: candidates.length, withProduct: candidates.filter((c) => c.product).length }
}

/** The estimator's ticks (and splits, v2.4114), one upsert per fixture shown; a split not given is left as stored. */
export async function saveTakeoffChoices(supabase: Client, bidId: string, ticks: ReadonlyMap<string, boolean>, splits?: ReadonlyMap<string, boolean>): Promise<void> {
  const rows = [...ticks.entries()].map(([count_row_id, ticked]) => ({ bid_id: bidId, count_row_id, ticked, ...(splits?.has(count_row_id) ? { split: !!splits.get(count_row_id) } : {}) }))
  if (rows.length === 0) return
  const { error } = await supabase.from('bid_submittal_takeoff_choices').upsert(rows, { onConflict: 'bid_id,count_row_id' })
  if (error) throw error
}
