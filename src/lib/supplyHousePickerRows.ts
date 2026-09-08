import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type SupplyHousePickerRow = { id: string; name: string }

/**
 * Supply houses a quote can go to (RFQ compose, Plug in quotes, Prepare fixture
 * copy). The `supply_houses` roster doubles as the vendor ledger — insurers,
 * rental yards, "Outside Subcontractors" — so the picker keeps only rows whose
 * `vendor_kind` is `supply_house` (v2.3172). Before that column is pushed the
 * filtered select errors; fall back to the legacy `is_insurer` flag (Tier-2
 * #19, J34-N2), and before *that* column to the whole roster.
 */
export async function fetchSupplyHousePickerRows(): Promise<SupplyHousePickerRow[]> {
  const byKind = await supabase.from('supply_houses').select('id, name').eq('vendor_kind' as never, 'supply_house').order('name')
  if (!byKind.error) return (byKind.data ?? []).map((h) => ({ id: h.id, name: h.name }))
  const byFlag = await supabase.from('supply_houses').select('id, name').eq('is_insurer', false).order('name')
  if (!byFlag.error) return (byFlag.data ?? []).map((h) => ({ id: h.id, name: h.name }))
  const rows = await withSupabaseRetry(() => supabase.from('supply_houses').select('id, name').order('name'), 'load supply houses')
  return (rows ?? []).map((h) => ({ id: h.id, name: h.name }))
}
