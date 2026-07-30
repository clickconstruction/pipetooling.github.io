import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { StripeBillingMode } from './stripeSecrets.ts'

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

/** A4: per-mode Stripe customer id columns on `customers` (migration 20260730173258). */
export function stripeCustomerIdColumnForMode(
  mode: StripeBillingMode,
): 'stripe_customer_id' | 'stripe_customer_id_test' {
  return mode === 'test' ? 'stripe_customer_id_test' : 'stripe_customer_id'
}

/** Clears ONLY the given mode's column — a cross-mode stale id must never wipe the other mode's link (A4). */
export async function clearCustomerStripeCustomerId(
  admin: SupabaseClient,
  pipetoolingCustomerId: string,
  mode: StripeBillingMode,
): Promise<void> {
  await admin
    .from('customers')
    .update({ [stripeCustomerIdColumnForMode(mode)]: null })
    .eq('id', pipetoolingCustomerId)
}
