import { NO_CUSTOMER_TYPE_LABEL } from '../../constants/customerTypeLabels'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/** "Name - Address" picker/search display for a customer row (name alone when no address). */
export function getCustomerDisplay(c: CustomerRow): string {
  if (c.address) return `${c.name} - ${c.address}`
  return c.name
}

/**
 * Phone/email out of the customers.contact_info JSON blob, tolerating null /
 * non-object / missing keys. (The job form's own reader — `lib/customerContactDisplay`
 * has a similar helper with different null semantics; not consolidated.)
 */
export function extractContactFromCustomer(c: CustomerRow): { phone: string; email: string } {
  const ci = c.contact_info
  if (ci == null || typeof ci !== 'object') return { phone: '', email: '' }
  const obj = ci as Record<string, unknown>
  return {
    phone: typeof obj.phone === 'string' ? obj.phone : '',
    email: typeof obj.email === 'string' ? obj.email : '',
  }
}

/** Dropdown row chip: "Residential"/"Commercial", the no-type label, or the raw custom value. */
export function customerTypeShortLabel(c: CustomerRow): string | null {
  const t = c.customer_type
  if (t === 'residential' || t === 'commercial') return t.charAt(0).toUpperCase() + t.slice(1)
  if (t == null || t === '') return NO_CUSTOMER_TYPE_LABEL
  return t
}

/**
 * The "Not in Customers" chip heuristic: an UNLINKED form customer name is
 * treated as matching an existing row when exactly one same-named row exists.
 * (Until v2.2972 the job's master broke ties; one company retired that.)
 */
export function customerListImpliesLinkedRow(
  customersList: CustomerRow[],
  _jobMasterUserId: string,
  customerNameTrimmed: string,
): boolean {
  const nameKey = customerNameTrimmed.trim().toLowerCase()
  if (!nameKey) return false
  const byName = customersList.filter((c) => (c.name ?? '').trim().toLowerCase() === nameKey)
  return byName.length === 1
}
