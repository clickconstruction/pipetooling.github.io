import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_SETTINGS_KEY_BID_TAX_RATE_PCT_V1, DEFAULT_BID_TAX_RATE_PCT, parseBidTaxRatePct } from '../appSettingsKeys'
import type { Database } from '../../types/database'

type Client = SupabaseClient<Database>

/** The company default from app_settings; 8.25 when the row is missing (the migration seeds it). */
export async function loadBidTaxRateDefault(supabase: Client): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value_num').eq('key', APP_SETTINGS_KEY_BID_TAX_RATE_PCT_V1).maybeSingle()
  return parseBidTaxRatePct(data?.value_num ?? null, DEFAULT_BID_TAX_RATE_PCT)
}

/** Writes the bid's own rate (null = back to the company default). Fail-soft: the error comes back for a toast. */
export async function saveBidTaxRate(supabase: Client, bidId: string, pct: number | null): Promise<{ error: string | null }> {
  // `tax_rate_pct` joins the generated types on the regen after the push; until then the payload is cast.
  const payload = { tax_rate_pct: pct } as unknown as Database['public']['Tables']['bids']['Update']
  const { error } = await supabase.from('bids').update(payload).eq('id', bidId)
  return { error: error ? error.message : null }
}
