import type { Json } from '../types/database'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Prefer API shape `details.debitCardInfo`, then legacy/root `debitCardInfo`. */
function debitCardInfoRecordFromRaw(o: Record<string, unknown>): Record<string, unknown> | null {
  const details = o.details
  if (details !== null && typeof details === 'object' && !Array.isArray(details)) {
    const d = details as Record<string, unknown>
    const fromDetails = d.debitCardInfo
    if (fromDetails !== null && typeof fromDetails === 'object' && !Array.isArray(fromDetails)) {
      return fromDetails as Record<string, unknown>
    }
  }
  const top = o.debitCardInfo
  if (top !== null && typeof top === 'object' && !Array.isArray(top)) {
    return top as Record<string, unknown>
  }
  return null
}

/**
 * Mercury debit card UUID from stored raw JSON:
 * `raw.details.debitCardInfo.id` (typical) or `raw.debitCardInfo.id` (fallback).
 */
export function mercuryDebitCardIdFromRaw(raw: Json | null): string | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const info = debitCardInfoRecordFromRaw(raw as Record<string, unknown>)
  if (info === null) return null
  const id = info.id
  if (typeof id !== 'string') return null
  const t = id.trim()
  if (t.length === 0 || !UUID_RE.test(t)) return null
  return t.toLowerCase()
}

/** Compact display when no nickname: first 3 + ... + last 3 hex chars (hyphens stripped). */
export function formatMercuryDebitCardIdCompact(id: string): string {
  const compact = id.replace(/-/g, '').toLowerCase()
  if (compact.length <= 6) return compact
  return `${compact.slice(0, 3)}...${compact.slice(-3)}`
}
