/**
 * The phone number we already have for a portal customer (Customer Waiting,
 * v2.3246). Two homes today, neither a column on `customers`:
 *   1. `customers.contact_info->>'phone'` — what the Customers page edits
 *      (`extractContactFromCustomer` on the client reads the same key);
 *   2. the newest `jobs_ledger.customer_phone` on one of the customer's jobs —
 *      what the Dashboard call buttons dial.
 * First non-blank wins. Returned raw (as typed by the office); the client
 * normalizes for tel:. Null when nothing is on file.
 */

// deno-lint-ignore no-explicit-any
type AdminClient = any

export async function resolvePortalCustomerPhone(admin: AdminClient, customerId: string): Promise<string | null> {
  try {
    const { data: customer } = await admin
      .from('customers')
      .select('contact_info')
      .eq('id', customerId)
      .maybeSingle()
    const ci = (customer as { contact_info?: unknown } | null)?.contact_info
    if (ci && typeof ci === 'object') {
      const phone = (ci as Record<string, unknown>).phone
      if (typeof phone === 'string' && phone.trim()) return phone.trim().slice(0, 40)
    }
  } catch (e) {
    console.warn('resolvePortalCustomerPhone: contact_info read failed', e)
  }
  try {
    const { data: job } = await admin
      .from('jobs_ledger')
      .select('customer_phone')
      .eq('customer_id', customerId)
      .not('customer_phone', 'is', null)
      .neq('customer_phone', '')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const phone = (job as { customer_phone?: string | null } | null)?.customer_phone
    if (typeof phone === 'string' && phone.trim()) return phone.trim().slice(0, 40)
  } catch (e) {
    console.warn('resolvePortalCustomerPhone: jobs_ledger read failed', e)
  }
  return null
}
