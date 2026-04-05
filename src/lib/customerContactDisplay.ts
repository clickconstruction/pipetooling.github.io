import type { Tables } from '../types/database'

export type CustomerRow = Tables<'customers'>

export function getCustomerDisplay(c: Pick<CustomerRow, 'name' | 'address'>): string {
  if (c.address) return `${c.name} - ${c.address}`
  return c.name
}

export function extractContactFromCustomer(c: Pick<CustomerRow, 'contact_info'>): {
  phone: string
  email: string
} {
  const ci = c.contact_info
  if (ci == null || typeof ci !== 'object') return { phone: '', email: '' }
  const obj = ci as Record<string, unknown>
  return {
    phone: typeof obj.phone === 'string' ? obj.phone : '',
    email: typeof obj.email === 'string' ? obj.email : '',
  }
}

/** Secondary line for search dropdowns: email · phone (with em dash for missing). */
export function formatCustomerSecondaryLine(c: Pick<CustomerRow, 'contact_info'>): string {
  const { email, phone } = extractContactFromCustomer(c)
  const e = email.trim() || '—'
  const p = phone.trim() || '—'
  return `${e} · ${p}`
}

/** Short pill label for customer type in compact lists; null = omit chip (unknown/unset). */
export function customerTypeChipLabel(c: Pick<CustomerRow, 'customer_type'>): string | null {
  const t = c.customer_type
  if (t === 'commercial') return 'Comm'
  if (t === 'residential') return 'Res'
  return null
}

export function customerMatchesSearch(c: CustomerRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const { email, phone } = extractContactFromCustomer(c)
  return (
    (c.name ?? '').toLowerCase().includes(q) ||
    (c.address ?? '').toLowerCase().includes(q) ||
    email.toLowerCase().includes(q) ||
    phone.toLowerCase().includes(q)
  )
}
