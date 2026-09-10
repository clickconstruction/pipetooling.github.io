import { supabase } from './supabase'
import { withSupabaseRetry } from '../utils/errorHandling'

export type SupplyHousePickerRow = { id: string; name: string }

/**
 * Supply houses a quote can go to (RFQ compose, Plug in quotes, Prepare fixture
 * copy). The `supply_houses` roster doubles as the vendor ledger — insurers,
 * rental yards, "Outside Subcontractors" — so the picker keeps only rows whose
 * `vendor_kind` is `supply_house` (v2.3172; the legacy `is_insurer` flag is gone
 * since v2.3244).
 */
export async function fetchSupplyHousePickerRows(): Promise<SupplyHousePickerRow[]> {
  const rows = await withSupabaseRetry(
    () => supabase.from('supply_houses').select('id, name').eq('vendor_kind', 'supply_house').order('name'),
    'load supply houses',
  )
  return (rows ?? []).map((h) => ({ id: h.id, name: h.name }))
}
