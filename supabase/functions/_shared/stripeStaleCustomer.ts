import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Stripe customer id exists in DB but not in this Stripe account (test/live mismatch, deleted customer, etc.). */
export function isMissingStripeCustomerError(e: unknown): boolean {
  if (e && typeof e === 'object') {
    const o = e as { code?: string; message?: string; raw?: { message?: string; param?: string } }
    const msg = (o.message ?? o.raw?.message ?? '').toLowerCase()
    if (msg.includes('no such customer')) return true
    if (o.code === 'resource_missing' && (msg.includes('customer') || o.raw?.param === 'customer')) {
      return true
    }
  }
  if (e instanceof Error && e.message.toLowerCase().includes('no such customer')) return true
  return false
}

export async function clearCustomerStripeCustomerId(
  admin: SupabaseClient,
  pipetoolingCustomerId: string,
): Promise<void> {
  await admin.from('customers').update({ stripe_customer_id: null }).eq('id', pipetoolingCustomerId)
}
