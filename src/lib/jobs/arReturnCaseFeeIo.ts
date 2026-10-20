import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { ArCaseFeeBill, ArCaseFeeRow } from './arReturnCaseFee'

/**
 * Each case's returned-check fee and the bills its check paid (`list_ar_return_case_fees`, v2.5033). Null when the
 * read is refused or the function is not on the database yet — the pane then offers no fee rather than a press
 * that would fail. Untyped until the post-push types: the function is new.
 */
export async function listArReturnCaseFees(caseIds: ReadonlyArray<string>): Promise<Map<string, ArCaseFeeRow> | null> {
  if (caseIds.length === 0) return new Map()
  const { data, error } = await (supabase as unknown as SupabaseClient).rpc('list_ar_return_case_fees', { p_case_ids: [...caseIds] })
  if (error) return null
  const out = new Map<string, ArCaseFeeRow>()
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const id = typeof r.case_id === 'string' ? r.case_id : ''
    if (!id) continue
    out.set(id, {
      case_id: id,
      fee_amount: (r.fee_amount as number | string | null) ?? null,
      fee_invoice_id: typeof r.fee_invoice_id === 'string' ? r.fee_invoice_id : null,
      fee_added_at: typeof r.fee_added_at === 'string' ? r.fee_added_at : null,
      fee_added_by: typeof r.fee_added_by === 'string' ? r.fee_added_by : null,
      bills: Array.isArray(r.bills) ? (r.bills as ArCaseFeeBill[]) : [],
      // v2.5144: absent until migration 20261010062000 is on the database.
      fee_came_off_at: typeof r.fee_came_off_at === 'string' ? r.fee_came_off_at : null,
    })
  }
  return out
}
