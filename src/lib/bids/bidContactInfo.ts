/**
 * Pure contact/address helpers for the Bids page, extracted from `src/pages/Bids.tsx`.
 */

import type { Json } from '../../types/database'

export function extractContactInfo(ci: Json | null): { phone: string; email: string } {
  if (ci == null) return { phone: '', email: '' }
  if (typeof ci === 'object' && ci !== null) {
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }
  return { phone: '', email: '' }
}

export function formatAddressWithoutZip(address: string | null): string {
  if (!address) return ''
  const parts = address.split(',')
  if (parts.length === 0) return address

  const lastIndex = parts.length - 1
  const lastPart = parts[lastIndex]?.trim()
  if (!lastPart) return address

  const tokens = lastPart.split(/\s+/)
  const lastToken = tokens[tokens.length - 1]
  if (!lastToken) return address

  // If the last token is mostly numeric (zip-like), drop it
  if (/^\d{3,}$/.test(lastToken)) {
    tokens.pop()
    parts[lastIndex] = tokens.join(' ')
    return parts.map((p) => p.trim()).filter(Boolean).join(', ')
  }

  return address
}
