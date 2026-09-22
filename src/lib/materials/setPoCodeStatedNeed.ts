import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { normalizeStatedNeed } from './poCodeStatedNeed'

/**
 * Write (or clear) what they said they need on one minted PO code (v2.3718) —
 * `set_material_po_generator_stated_need`, the ledger's only update door. The
 * database trims and NULLIFs the same way `normalizeStatedNeed` does, so the
 * value handed back is exactly what the row now holds.
 */
export async function setPoCodeStatedNeed(entryId: string, text: string | null | undefined): Promise<string | null> {
  const notes = normalizeStatedNeed(text)
  await withSupabaseRetry(
    () =>
      supabase.rpc('set_material_po_generator_stated_need', { p_id: entryId, p_notes: notes ?? '' }),
    'set po code stated need',
  )
  return notes
}
