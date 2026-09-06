import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type SupplyHousePickerRow = { id: string; name: string }

/**
 * Supply houses a quote can go to (RFQ compose, Plug in quotes, Prepare fixture
 * copy). The `supply_houses` roster doubles as the vendor ledger — insurers,
 * rental yards, "Outside Subcontractors" — so the picker drops rows the office
 * has tagged `is_insurer` (Tier-2 #19, J34-N2). Until that migration lands the
 * filtered select errors on the unknown column; fall back to the whole roster.
 */
export async function fetchSupplyHousePickerRows(): Promise<SupplyHousePickerRow[]> {
  const filtered = await supabase.from('supply_houses').select('id, name').eq('is_insurer', false).order('name')
  if (!filtered.error) return (filtered.data ?? []).map((h) => ({ id: h.id, name: h.name }))
  const rows = await withSupabaseRetry(() => supabase.from('supply_houses').select('id, name').order('name'), 'load supply houses')
  return (rows ?? []).map((h) => ({ id: h.id, name: h.name }))
}
