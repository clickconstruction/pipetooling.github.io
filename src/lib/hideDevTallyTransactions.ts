import { supabase } from './supabase'
import { APP_SETTINGS_KEY_HIDE_DEV_TALLY_TRANSACTIONS, parseHideDevTallyFlag } from './appSettingsKeys'

/**
 * Org-wide "hide dev-role staff transactions" flag for the Stale tally follow-up, stored in
 * `app_settings` (RLS: any authenticated user reads, only devs write). The follow-up RPC reads
 * this same key, so toggling it hides dev-role transactions in the modal list and its banner
 * count for everyone. See `parseHideDevTallyFlag` (pure) in `appSettingsKeys.ts`.
 */

/** Read the org-wide hide-dev flag (false on missing row or error). */
export async function fetchHideDevTallyTransactions(): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value_text')
    .eq('key', APP_SETTINGS_KEY_HIDE_DEV_TALLY_TRANSACTIONS)
    .maybeSingle()
  if (error) return false
  return parseHideDevTallyFlag(data?.value_text ?? null)
}

/** Set the org-wide hide-dev flag (dev-only; enforced by `app_settings` RLS). Throws on error. */
export async function setHideDevTallyTransactions(on: boolean): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      { key: APP_SETTINGS_KEY_HIDE_DEV_TALLY_TRANSACTIONS, value_text: on ? 'true' : 'false' },
      { onConflict: 'key' },
    )
  if (error) throw error
}
