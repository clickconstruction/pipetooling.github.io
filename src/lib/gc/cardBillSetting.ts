/**
 * Pay by card's switch (GC mode, Owner Billing's O8c): the app_settings row `gc_card_bill_on_v1`, 'true' or 'false',
 * inserted 'false' by migration 20261010042000. The owner turns it on in Settings → Jobs & billing; dev and the owner
 * write it (a key-scoped UPDATE policy), everyone signed in reads it. `gc-card-bill`, `customer-portal`'s offer and
 * `gc-customer-email`'s card lines read the same row, and Bill the customer's hint reads it here. It replaced O8b's
 * env value `GC_CARD_BILL_ON`.
 */
import { supabase } from '../supabase'
import { GC_CARD_BILL_SETTING_KEY, gcCardBillOn } from '../../../supabase/functions/_shared/gcCardBill'

/** On only when the row says 'true'. A missing row, or a read that fails, is off. */
export async function fetchGcCardBillOn(): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('value_text').eq('key', GC_CARD_BILL_SETTING_KEY).maybeSingle()
  if (error) return false
  return gcCardBillOn(data?.value_text ?? null)
}

/** Flip it. An UPDATE, not an upsert: the owner holds only the key-scoped UPDATE policy, and the row comes from the migration. */
export async function setGcCardBillOn(on: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ value_text: on ? 'true' : 'false' })
    .eq('key', GC_CARD_BILL_SETTING_KEY)
    .select('key')
  if (error) throw error
  if (!Array.isArray(data) || data.length === 0) throw new Error('Only the owner or a dev can turn this on.')
}
