import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { BRIDGE_ACCOUNTS_OUT_SETTING_KEY, accountsOutText, parseAccountsOut, parseBankNicknames } from './cashAccounts'
import { parseMercuryCash, type MercuryCash } from './mercuryCash'

/**
 * The bank read and the save behind `cashAccounts.ts` (v2.6838), in a file of their own since
 * v2.6888 so the pure half can be copied to the edge functions.
 */

export type BankRead = { cash: MercuryCash; names: Map<string, string>; out: string[] }

/** The bank's accounts with their names, and the saved choice of which count: one call to the bank, one row read. */
export async function loadBankRead(db: SupabaseClient<Database>): Promise<BankRead> {
  const [fn, row] = await Promise.all([
    db.functions.invoke('get-mercury-account-balances', { body: {} }),
    withSupabaseRetry(async () => db.from('app_settings').select('value_text').eq('key', BRIDGE_ACCOUNTS_OUT_SETTING_KEY).maybeSingle(), 'bridge accounts left out') as Promise<{ value_text: string | null } | null>,
  ])
  if (fn.error) throw new Error(fn.error.message)
  return { cash: parseMercuryCash(fn.data, new Date().toISOString()), names: parseBankNicknames(fn.data), out: parseAccountsOut(row?.value_text) }
}

export async function saveAccountsOut(db: SupabaseClient<Database>, ids: ReadonlyArray<string>): Promise<void> {
  await withSupabaseRetry(
    async () => db.from('app_settings').upsert({ key: BRIDGE_ACCOUNTS_OUT_SETTING_KEY, value_text: accountsOutText(ids) }, { onConflict: 'key' }),
    'save bridge accounts left out',
  )
}
