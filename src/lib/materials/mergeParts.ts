/**
 * Merging two copies of one part (punch list #308, PR 8): the words the Duplicates page says before
 * and after, and the pairs a person said are not the same. Pure, with the reads and writes below.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../utils/errorHandling'

type Db = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type MergeCounts = { pricesMoved: number; pricesMerged: number; assemblies: number; takeoffLines: number; purchaseOrderLines: number; houseNumbers: number }

export const NO_MERGE_COUNTS: MergeCounts = { pricesMoved: 0, pricesMerged: 0, assemblies: 0, takeoffLines: 0, purchaseOrderLines: 0, houseNumbers: 0 }

export function addMergeCounts(a: MergeCounts, b: MergeCounts): MergeCounts {
  return {
    pricesMoved: a.pricesMoved + b.pricesMoved,
    pricesMerged: a.pricesMerged + b.pricesMerged,
    assemblies: a.assemblies + b.assemblies,
    takeoffLines: a.takeoffLines + b.takeoffLines,
    purchaseOrderLines: a.purchaseOrderLines + b.purchaseOrderLines,
    houseNumbers: a.houseNumbers + b.houseNumbers,
  }
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/** What the confirm window says before a merge. */
export function mergeAsk(keepName: string, dropNames: string[]): { title: string; message: string; confirmLabel: string } {
  const others = dropNames.length === 1 ? `“${dropNames[0]}”` : `${dropNames.length} other parts`
  return {
    title: dropNames.length === 1 ? 'Merge these two parts into one?' : `Merge these ${dropNames.length + 1} parts into one?`,
    message: `${others} ${dropNames.length === 1 ? 'goes' : 'go'} into “${keepName}”. Every price, assembly, takeoff line, purchase order line and house number moves to the part that stays. Where both have a price from one supply house, the newer one stays. The other ${dropNames.length === 1 ? 'name is' : 'names are'} kept in its notes, so a search still finds it. A merge cannot be undone.`,
    confirmLabel: dropNames.length === 1 ? 'Merge the two parts' : `Merge the ${dropNames.length + 1} parts`,
  }
}

/** What the page says after a merge: what now points at the part that stays. */
export function mergeOutcome(keepName: string, merged: number, c: MergeCounts): string {
  const moved = [
    c.pricesMoved + c.pricesMerged ? n(c.pricesMoved + c.pricesMerged, 'price', 'prices') : null,
    c.assemblies ? n(c.assemblies, 'assembly', 'assemblies') : null,
    c.takeoffLines ? n(c.takeoffLines, 'takeoff line', 'takeoff lines') : null,
    c.purchaseOrderLines ? n(c.purchaseOrderLines, 'purchase order line', 'purchase order lines') : null,
    c.houseNumbers ? n(c.houseNumbers, 'house number', 'house numbers') : null,
  ].filter(Boolean) as string[]
  const list = moved.length === 0 ? '' : moved.length === 1 ? moved[0]! : `${moved.slice(0, -1).join(', ')} and ${moved[moved.length - 1]}`
  const head = `${n(merged, 'part was', 'parts were')} merged into “${keepName}”.`
  if (!list) return `${head} Nothing else pointed at ${merged === 1 ? 'it' : 'them'}.`
  return `${head} ${list} now ${moved.length === 1 && /^1 /.test(moved[0]!) ? 'points' : 'point'} at it.${c.pricesMerged ? ` ${n(c.pricesMerged, 'price was', 'prices were')} on both: the newer one stayed.` : ''}`
}

/** A pair of part ids as one key, the lower id first. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** True when every two parts of a group were called not the same: the group is not offered again. */
export function allCalledDistinct(ids: string[], distinct: Set<string>): boolean {
  if (ids.length < 2) return false
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (!distinct.has(pairKey(ids[i]!, ids[j]!))) return false
  return true
}

/** The pairs called not the same. Empty until the table is on the database. */
export async function loadDistinctPairs(supabase: Db): Promise<Set<string>> {
  const out = new Set<string>()
  const { data, error } = await supabase.from('material_part_distinct_pairs').select('low_part_id,high_part_id').limit(5000)
  if (error) return out
  for (const r of (data ?? []) as { low_part_id: string; high_part_id: string }[]) out.add(`${r.low_part_id}|${r.high_part_id}`)
  return out
}

/** Call every two parts of a group not the same. */
export async function callDistinct(supabase: Db, ids: string[]): Promise<{ error: string | null }> {
  const rows: { low_part_id: string; high_part_id: string }[] = []
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) rows.push(ids[i]! < ids[j]! ? { low_part_id: ids[i]!, high_part_id: ids[j]! } : { low_part_id: ids[j]!, high_part_id: ids[i]! })
  const { error } = await supabase.from('material_part_distinct_pairs').upsert(rows, { onConflict: 'low_part_id,high_part_id', ignoreDuplicates: true })
  return { error: error ? formatErrorMessage(error, 'That could not be kept') : null }
}

/** Merge one copy into the part that stays. */
export async function mergeParts(supabase: Db, keepId: string, dropId: string): Promise<{ ok: true; counts: MergeCounts } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('merge_material_parts', { p_keep: keepId, p_drop: dropId })
  if (error) {
    const missing = (error as { code?: string }).code === 'PGRST202' || /could not find the function/i.test((error as { message?: string }).message ?? '')
    return { ok: false, error: missing ? 'Merging parts is not switched on yet. It arrives with the next database update.' : formatErrorMessage(error, 'The parts could not be merged') }
  }
  const j = (data ?? {}) as Record<string, number>
  return {
    ok: true,
    counts: {
      pricesMoved: Number(j.prices_moved ?? 0), pricesMerged: Number(j.prices_merged ?? 0), assemblies: Number(j.assemblies ?? 0),
      takeoffLines: Number(j.takeoff_lines ?? 0), purchaseOrderLines: Number(j.purchase_order_lines ?? 0), houseNumbers: Number(j.house_numbers ?? 0),
    },
  }
}
