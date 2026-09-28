import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { loadAllAssemblyItemLinks } from '../materials/assemblyItems'
import { buildPartAssemblyIndex, type PartAssemblyEntry } from './partAssemblyIndex'

/**
 * The Takeoffs "In N assemblies" index, from every assembly item row (paged).
 * The whole table rather than the loaded trade's assemblies: an assembly's
 * quantities follow its nested assemblies, and nothing holds a nested
 * assembly to its parent's service type.
 *
 * Fail-soft: resolves `null` when any page fails, never an index built from
 * the pages that did arrive — the caller leaves the index it has alone.
 */
export async function loadPartAssemblyIndex(
  supabase: SupabaseClient<Database>,
): Promise<Map<string, PartAssemblyEntry[]> | null> {
  try {
    return buildPartAssemblyIndex(await loadAllAssemblyItemLinks(supabase))
  } catch {
    return null
  }
}
