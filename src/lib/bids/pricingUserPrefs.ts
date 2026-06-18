import { supabase } from '../supabase'

/**
 * Per-user "last selected price book" preference, scoped per service type. Backed by the
 * `bid_pricing_user_prefs` table (cross-device). Used to make a user's most recently chosen
 * price-book template the default fallback for bids that have not set up their own pricing.
 */

/** The template id this user last chose for the given service type, or null if none/error. */
export async function fetchLastPriceBookTemplateId(
  userId: string,
  serviceTypeId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('bid_pricing_user_prefs')
    .select('last_price_book_version_id')
    .eq('user_id', userId)
    .eq('service_type_id', serviceTypeId)
    .maybeSingle()
  if (error) return null
  return data?.last_price_book_version_id ?? null
}

/** Remember the template this user just chose for the given service type (upsert). */
export async function saveLastPriceBookTemplateId(
  userId: string,
  serviceTypeId: string,
  versionId: string,
): Promise<void> {
  await supabase.from('bid_pricing_user_prefs').upsert(
    {
      user_id: userId,
      service_type_id: serviceTypeId,
      last_price_book_version_id: versionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,service_type_id' },
  )
}
