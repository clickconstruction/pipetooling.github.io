import type { Json } from '../types/database'

/**
 * Mercury API `bankDescription` from stored sync payload (`mercury_transactions.raw`).
 */
export function mercuryBankDescriptionFromRaw(raw: Json | null): string | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const bd = (raw as Record<string, unknown>).bankDescription
  if (typeof bd !== 'string') return null
  const t = bd.trim()
  return t.length > 0 ? t : null
}
