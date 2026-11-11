/**
 * Reads and writes for a price sheet's fixtures on the takeoff (punch list #308, PR 6): the
 * assemblies on file with their items, an assembly made for a fixture, a house's bundle price set
 * and put back, and what the sheet remembers of a placement. The takeoff line itself is written by
 * Takeoffs, under the caller's own access, as the Add Assembly window writes it.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../../utils/errorHandling'
import type { AssemblyItem, KnownAssembly } from './sheetFixtures'

type Db = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Every assembly of a service type with its part items. One that nests another assembly is marked, and never reused. */
export async function loadAssemblies(supabase: Db, serviceTypeId: string): Promise<KnownAssembly[]> {
  const templates: { id: string; name: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('material_templates').select('id,name').eq('service_type_id', serviceTypeId).eq('is_robot', false).order('id').range(from, from + 999)
    if (error) throw new Error(formatErrorMessage(error, 'The assemblies could not be read'))
    templates.push(...((data ?? []) as { id: string; name: string }[]))
    if ((data ?? []).length < 1000) break
  }
  const byId = new Map<string, KnownAssembly>(templates.map((t) => [t.id, { id: t.id, name: t.name, items: [], nested: false }]))
  const ids = templates.map((t) => t.id)
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('material_template_items').select('template_id,item_type,part_id,quantity').in('template_id', chunk).order('id').range(from, from + 999)
      if (error) throw new Error(formatErrorMessage(error, 'The assemblies could not be read'))
      for (const it of (data ?? []) as { template_id: string; item_type: string; part_id: string | null; quantity: number | string }[]) {
        const a = byId.get(it.template_id)
        if (!a) continue
        if (it.item_type !== 'part' || !it.part_id) a.nested = true
        else a.items.push({ partId: it.part_id, quantity: Number(it.quantity) })
      }
      if ((data ?? []).length < 1000) break
    }
  }
  return [...byId.values()]
}

/** Make an assembly for a fixture: its name, a line of where it came from, and its parts. */
export async function makeAssembly(
  supabase: Db,
  input: { serviceTypeId: string; name: string; description: string; items: AssemblyItem[] },
): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.from('material_templates').insert({ name: input.name, description: input.description || null, service_type_id: input.serviceTypeId }).select('id').single()
  if (error || !data) return { ok: false, error: `The assembly could not be made: ${formatErrorMessage(error, 'it was not saved')}` }
  const templateId = (data as { id: string }).id
  const { error: itemsError } = await supabase.from('material_template_items').insert(
    input.items.map((it, i) => ({ template_id: templateId, item_type: 'part', part_id: it.partId, nested_template_id: null, quantity: it.quantity, sequence_order: i + 1, notes: null })),
  )
  if (itemsError) {
    // An assembly with no items is of no use to anyone: it goes again.
    await supabase.from('material_templates').delete().eq('id', templateId)
    return { ok: false, error: `The assembly's parts could not be saved: ${formatErrorMessage(itemsError, 'they were not saved')}` }
  }
  return { ok: true, templateId }
}

export type BundlePrice = { price: number; effectiveDate: string | null }

/** Set a house's bundle price on an assembly, and say what it replaced. */
export async function setBundlePrice(
  supabase: Db,
  input: { templateId: string; supplyHouseId: string; price: number; datedOn: string | null },
): Promise<{ ok: true; replaced: BundlePrice | null } | { ok: false; error: string }> {
  const { data: rows, error: readError } = await supabase.from('material_template_prices').select('id,price,effective_date').eq('template_id', input.templateId).eq('supply_house_id', input.supplyHouseId).limit(1)
  if (readError) return { ok: false, error: formatErrorMessage(readError, 'The bundle price could not be read') }
  const old = ((rows ?? []) as { id: string; price: number | string; effective_date: string | null }[])[0]
  const { error } = old
    ? await supabase.from('material_template_prices').update({ price: input.price, effective_date: input.datedOn }).eq('id', old.id)
    : await supabase.from('material_template_prices').insert({ template_id: input.templateId, supply_house_id: input.supplyHouseId, price: input.price, effective_date: input.datedOn })
  if (error) return { ok: false, error: formatErrorMessage(error, 'The bundle price could not be saved') }
  return { ok: true, replaced: old ? { price: Number(old.price), effectiveDate: old.effective_date } : null }
}

/**
 * Put a house's bundle price back to what the sheet replaced, or remove it when there was none.
 * Only while the price is still the one the sheet set: a price somebody changed since is left alone.
 */
export async function restoreBundlePrice(
  supabase: Db,
  input: { templateId: string; supplyHouseId: string; setPrice: number; replaced: BundlePrice | null },
): Promise<{ restored: boolean; error: string | null }> {
  const { data: rows, error: readError } = await supabase.from('material_template_prices').select('id,price').eq('template_id', input.templateId).eq('supply_house_id', input.supplyHouseId).limit(1)
  if (readError) return { restored: false, error: formatErrorMessage(readError, 'The bundle price could not be read') }
  const cur = ((rows ?? []) as { id: string; price: number | string }[])[0]
  if (!cur || Math.abs(Number(cur.price) - input.setPrice) > 0.005) return { restored: false, error: null }
  const { error } = input.replaced
    ? await supabase.from('material_template_prices').update({ price: input.replaced.price, effective_date: input.replaced.effectiveDate }).eq('id', cur.id)
    : await supabase.from('material_template_prices').delete().eq('id', cur.id)
  return { restored: !error, error: error ? formatErrorMessage(error, 'The bundle price could not be put back') : null }
}

export type PlacedRecord = { templateId: string; countRowIds: string[]; placedLineIds: string[]; bundlePrice: number; replaced: BundlePrice | null; madeTemplate: boolean }

export async function recordPlaced(supabase: Db, groupId: string, r: PlacedRecord): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('price_sheet_group_place', {
    p_group_id: groupId,
    p: {
      template_id: r.templateId, count_row_ids: r.countRowIds, placed_line_ids: r.placedLineIds, bundle_price: r.bundlePrice,
      replaced_bundle_price: r.replaced?.price ?? null, replaced_bundle_effective_date: r.replaced?.effectiveDate ?? null, made_template: r.madeTemplate,
    },
  })
  return { error: error ? formatErrorMessage(error, 'The placement could not be kept') : null }
}

export async function recordUnplaced(supabase: Db, groupId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('price_sheet_group_unplace', { p_group_id: groupId })
  return { error: error ? formatErrorMessage(error, 'The fixture could not be taken off') : null }
}
