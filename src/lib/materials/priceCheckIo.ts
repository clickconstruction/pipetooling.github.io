/**
 * Check 20 prices (v2.4392): the two writes. Both touch only the `material_part_prices` row; its
 * `track_price_history` trigger writes the history row (as the person checking), so a check
 * shows in Price History and freshens What your materials cost.
 *
 * - **Same** sets `effective_date` to today. The trigger fires on a changed date and logs the
 *   price against itself, the "checked, same price" row. A price already dated today logs nothing
 *   new, and that is fine: it was checked today.
 * - **A new price** sets `price` and `effective_date` together, one history row.
 *
 * A row the reader may not change (a read-only training account) updates nothing without an
 * error, so each write asks for the row back and calls an empty answer a refusal.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type PriceCheckResult = { ok: true } | { ok: false; message: string }

export const PRICE_CHECK_REFUSED = 'This account can’t change prices.'

async function updatePrice(db: SupabaseClient, priceId: string, patch: { effective_date: string; price?: number }): Promise<PriceCheckResult> {
  const { data, error } = await db.from('material_part_prices').update(patch).eq('id', priceId).select('id')
  if (error) return { ok: false, message: error.message }
  if (!data || (data as unknown[]).length === 0) return { ok: false, message: PRICE_CHECK_REFUSED }
  return { ok: true }
}

/** Same: the price still holds today. */
export function confirmPriceToday(db: SupabaseClient, priceId: string, today: string): Promise<PriceCheckResult> {
  return updatePrice(db, priceId, { effective_date: today })
}

/** Today's price, typed. */
export function savePriceToday(db: SupabaseClient, priceId: string, price: number, today: string): Promise<PriceCheckResult> {
  return updatePrice(db, priceId, { price, effective_date: today })
}
