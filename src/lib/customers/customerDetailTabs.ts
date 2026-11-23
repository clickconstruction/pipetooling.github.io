/**
 * The customer page's tabs (`/customers/:id`, the tab in `?tab=`). Profile, Estimates, Jobs and
 * Invoices for everyone who reaches the page. Permits (v2.8302, the last thing punch list #307
 * left for this page) for the people who research permits, the same roles the bid window's
 * panel asks. A tab a role does not hold reads as Profile, so a link passed on never shows an
 * empty page. Pure: no React, no Supabase.
 */
import type { UserRole } from '../../hooks/useAuth'
import { canResearchPermits, nameKey } from '../research/permitResearch'

export type CustomerDetailTab = 'profile' | 'estimates' | 'jobs' | 'invoices' | 'permits'

export const CUSTOMER_TAB_LABELS: Record<CustomerDetailTab, string> = {
  profile: 'Profile',
  estimates: 'Estimates',
  jobs: 'Jobs',
  invoices: 'Invoices',
  permits: 'Permits',
}

const EVERYONE: readonly CustomerDetailTab[] = ['profile', 'estimates', 'jobs', 'invoices']

/** The tabs this role's strip draws, in order. Permits is last, and only for a role that researches permits. */
export function customerDetailTabs(role: UserRole | null): CustomerDetailTab[] {
  return canResearchPermits(role) ? [...EVERYONE, 'permits'] : [...EVERYONE]
}

/** The tab a `?tab=` value names, held to the tabs this role has. Anything else is Profile. */
export function parseCustomerTab(raw: string | null, tabs: readonly CustomerDetailTab[]): CustomerDetailTab {
  return tabs.find((t) => t === raw) ?? 'profile'
}

/**
 * One GC is sometimes under two customer rows of one name. The Permits tab reads them as one, as
 * the bid window does: this customer's id first, then every other row whose keyed name is the
 * same. A name with nothing to key (blank, or only "LLC") stands alone.
 */
export function sameNameCustomerIds(customerId: string, customerName: string | null | undefined, customers: ReadonlyArray<{ id: string; name: string | null }>): string[] {
  const key = nameKey(customerName)
  if (key == null) return [customerId]
  const others = customers.filter((c) => c.id !== customerId && nameKey(c.name) === key).map((c) => c.id)
  return [customerId, ...new Set(others)]
}

/** The line under the Permits tab's panel when other rows were read with this one. Null when the row stands alone. */
export function sameNameRowsWords(others: number): string | null {
  if (others <= 0) return null
  return `Read together with ${others} other customer row${others === 1 ? '' : 's'} of the same name.`
}
