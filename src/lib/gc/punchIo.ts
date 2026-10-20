/**
 * GC mode, the real build, the Building lane's U6d and U3b-ii: where the punch list is read and pressed (`gc_punch_items`, dev
 * only while Building is built). The Closeout window reads it to hold Accept the work; the Punch list window and Closeout
 * press it. Each press goes to its function in migration 20261010049000 (U3b-i), which checks it again. An item taken off is
 * kept in the table and never read here.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { PUNCH_COLUMNS, type PunchRow } from './punchRows'

/** The answer of a press, or its problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data as T
}

/** The punch items on these jobs, none taken off. */
export async function loadGcPunch(projectIds: string[]): Promise<PunchRow[]> {
  if (projectIds.length === 0) return []
  const result = await supabase.from('gc_punch_items').select(PUNCH_COLUMNS).in('project_id', projectIds).is('removed_at', null)
  checkSupabaseError(result, 'load the punch list')
  return result.data ?? []
}

/** Add an item to a trade's punch list, its place and photo link when given. Returns the item. */
export async function addPunchItem(packageId: string, item: { text: string; where: string; photoUrl: string }): Promise<string> {
  const where = item.where.trim()
  const photo = item.photoUrl.trim()
  const p = { packageId, text: item.text.trim(), ...(where ? { where } : {}), ...(photo ? { photoUrl: photo } : {}) }
  return taken(await supabase.rpc('gc_add_punch_item', { p }), 'add the punch item')
}

/** Take off an item added by mistake. It stays in the record. */
export async function removePunchItem(itemId: string): Promise<void> {
  taken(await supabase.rpc('gc_remove_punch_item', { p_item_id: itemId }), 'take the punch item off')
}

/** The trade told us an item is fixed. */
export async function punchFixedIn(itemId: string): Promise<void> {
  taken(await supabase.rpc('gc_punch_fixed_in', { p_item_id: itemId }), 'record the item fixed')
}

/** Checked fixed, or back to the trade with what is still wrong. */
export async function checkPunchItem(itemId: string, fixed: boolean, note?: string): Promise<void> {
  const n = note?.trim()
  taken(await supabase.rpc('gc_check_punch_item', { p_item_id: itemId, p_fixed: fixed, ...(n ? { p_note: n } : {}) }), 'check the punch item')
}
