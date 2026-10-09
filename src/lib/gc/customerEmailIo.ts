/**
 * GC mode, Owner Billing's O4b: the one call Bill the customer makes to `gc-customer-email`. It never throws for a
 * refusal: the answer carries the key, and the window says it with `gcCustomerEmailRefusal`.
 */
import { supabase } from '../supabase'
import type { GcCustomerEmailRequest } from '../../../supabase/functions/_shared/gcCustomerEmails'
import { readCustomerEmailAnswer, type CustomerEmailAnswer } from './customerEmail'

export async function sendGcCustomerEmail(req: GcCustomerEmailRequest): Promise<CustomerEmailAnswer> {
  try {
    const r = await supabase.functions.invoke('gc-customer-email', { body: req })
    const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
    const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
    return readCustomerEmailAnswer(r.data, errorBody)
  } catch (e) {
    return { ok: false, key: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
}

/** The form's PDF as base64 for the email, a chunk at a time so a long file never overflows the call stack. */
export function pdfBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
