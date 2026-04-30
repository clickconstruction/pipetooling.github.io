import { formatClockSessionJobOrBidLabel, type ClockSessionRow } from '../types/clockSessions'
import type { LedgerPrefixMap } from './ledgerDisplayPrefixes'

/** Whitespace-separated tokens; every token must appear somewhere in the searchable text (case-insensitive). */
export function clockSessionMatchesSearch(s: ClockSessionRow, q: string, prefixMap: LedgerPrefixMap): boolean {
  const trimmed = q.trim()
  if (!trimmed) return true
  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  const haystack = [
    s.users?.name ?? '',
    s.notes ?? '',
    s.work_date,
    formatClockSessionJobOrBidLabel(s, prefixMap) ?? '',
  ]
    .join(' ')
    .toLowerCase()

  return tokens.every((t) => haystack.includes(t))
}
