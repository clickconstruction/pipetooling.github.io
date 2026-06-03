import { supabase } from './supabase'

/**
 * Cross-device Banking preferences (table `banking_user_prefs`). The localStorage
 * helpers in `bankingDragSortStorage.ts` remain an instant-load cache; this is the
 * source of truth so the Accounting toggles follow the user across devices.
 * NULL columns mean "never set on any device" → caller keeps its default.
 */
export type AccountingPrefsRow = {
  accounting_hide_labeled: boolean | null
  accounting_apply_rules_by_default: boolean | null
  accounting_approve_by_default: boolean | null
}

export type BankingPrefColumn = keyof AccountingPrefsRow

/** Read the caller's saved Accounting prefs, or null if they have no row yet. */
export async function fetchAccountingPrefs(userId: string): Promise<AccountingPrefsRow | null> {
  const { data, error } = await supabase
    .from('banking_user_prefs')
    .select('accounting_hide_labeled, accounting_apply_rules_by_default, accounting_approve_by_default')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as AccountingPrefsRow | null) ?? null
}

/** Persist a single toggle to the caller's prefs row (upsert; only this column changes). */
export async function saveBankingPref(userId: string, column: BankingPrefColumn, value: boolean): Promise<void> {
  const { error } = await supabase
    .from('banking_user_prefs')
    .upsert({ user_id: userId, [column]: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(error.message)
}
