import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import type { RememberPlan } from './takeoffBookLearn'

/**
 * The writes behind "Remember for the book" (docs/TAKEOFFS_REFRESH_PLAN.md
 * decision 3), driven by a `planRememberForBook` plan:
 *   1. a new `<key> · book` assembly holding the fixture's part lines (never
 *      an in-place edit — the plan already picked an unused name),
 *   2. a book entry for the key (or an alias on the entry that answers to it),
 *   3. one entry item per assembly to link (the new one and any bundle
 *      templates), stage `rough_in` — Combined ignores stage; By Stage
 *      applies it as rough-in, the safe default.
 * Returns what it created so the caller can refresh the catalog and the book.
 */
export async function rememberFixtureForBook(
  supabase: SupabaseClient<Database>,
  args: { plan: Extract<RememberPlan, { kind: 'remember' }>; serviceTypeId: string; bookVersionId: string; existingAlias: string[] | null | undefined },
): Promise<{ templateId: string | null; entryId: string; itemsLinked: number }> {
  const { plan, serviceTypeId, bookVersionId } = args
  let templateId: string | null = null
  if (plan.newAssembly) {
    const { data: tpl, error: tplErr } = await supabase
      .from('material_templates')
      .insert({ name: plan.newAssembly.name, description: 'Remembered from a takeoff', service_type_id: serviceTypeId })
      .select('id')
      .single()
    if (tplErr || !tpl) throw new Error(tplErr?.message ?? 'Failed to create the assembly')
    templateId = tpl.id
    const items = plan.newAssembly.items.map((it, i) => ({
      template_id: tpl.id,
      item_type: 'part' as const,
      part_id: it.part_id,
      nested_template_id: null,
      quantity: it.quantity,
      sequence_order: i + 1,
    }))
    const { error: itemsErr } = await supabase.from('material_template_items').insert(items)
    if (itemsErr) throw new Error(itemsErr.message)
  }

  let entryId: string
  if (plan.entry.action === 'create') {
    const { data: maxRow } = await supabase
      .from('takeoff_book_entries')
      .select('sequence_order')
      .eq('version_id', bookVersionId)
      .order('sequence_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: entry, error: entryErr } = await supabase
      .from('takeoff_book_entries')
      .insert({ version_id: bookVersionId, fixture_name: plan.entry.fixtureName, alias_names: [], sequence_order: ((maxRow as { sequence_order: number } | null)?.sequence_order ?? 0) + 1 })
      .select('id')
      .single()
    if (entryErr || !entry) throw new Error(entryErr?.message ?? 'Failed to create the book entry')
    entryId = entry.id
  } else {
    entryId = plan.entry.entryId
    if (plan.entry.action === 'alias') {
      const aliases = Array.from(new Set([...(args.existingAlias ?? []), plan.entry.alias]))
      const { error: aliasErr } = await supabase.from('takeoff_book_entries').update({ alias_names: aliases }).eq('id', entryId)
      if (aliasErr) throw new Error(aliasErr.message)
    }
  }

  const toLink = [...(templateId ? [templateId] : []), ...plan.templateIdsToLink]
  let itemsLinked = 0
  if (toLink.length > 0) {
    const { data: existing } = await supabase.from('takeoff_book_entry_items').select('template_id, sequence_order').eq('entry_id', entryId)
    const have = new Set(((existing ?? []) as Array<{ template_id: string }>).map((r) => r.template_id))
    let seq = Math.max(0, ...((existing ?? []) as Array<{ sequence_order: number }>).map((r) => r.sequence_order))
    const rows = toLink
      .filter((t) => !have.has(t))
      .map((t) => ({ entry_id: entryId, template_id: t, stage: 'rough_in', sequence_order: ++seq }))
    if (rows.length > 0) {
      const { error: linkErr } = await supabase.from('takeoff_book_entry_items').insert(rows)
      if (linkErr) throw new Error(linkErr.message)
      itemsLinked = rows.length
    }
  }
  return { templateId, entryId, itemsLinked }
}
