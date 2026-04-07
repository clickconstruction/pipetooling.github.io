import type { Database } from '../types/database'
import { formatMercuryKind } from './mercuryKindLabels'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from './mercuryRawDebitCard'
import { shortUuidPrefix } from './shortUuidPrefix'

export type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

function mercuryCategorySearchText(cat: MercuryTxRow['mercury_category']): string {
  if (cat == null) return ''
  if (typeof cat === 'object' && !Array.isArray(cat) && cat !== null && 'name' in cat) {
    const name = (cat as { name?: unknown }).name
    if (typeof name === 'string') return name
  }
  try {
    return JSON.stringify(cat)
  } catch {
    return String(cat)
  }
}

export type BankingMercurySearchNicknames = {
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
}

/** Single lowercased string with searchable fields joined (whitespace-separated). */
export function buildMercuryTxSearchHaystack(
  row: MercuryTxRow,
  ctx: BankingMercurySearchNicknames,
): string {
  const parts: string[] = []

  const cp = row.counterparty_name?.trim() ?? ''
  if (cp !== '') parts.push(cp)

  const note = row.note?.trim() ?? ''
  if (note !== '') parts.push(note)

  const ext = row.external_memo?.trim() ?? ''
  if (ext !== '') parts.push(ext)

  const st = row.status?.trim() ?? ''
  if (st !== '') parts.push(st)

  parts.push(row.kind, formatMercuryKind(row.kind))

  parts.push(row.mercury_id, row.id)
  if (row.counterparty_id) parts.push(row.counterparty_id)

  parts.push(row.mercury_account_id)
  const acctNick = ctx.nicknameByAccount[row.mercury_account_id]?.trim() ?? ''
  if (acctNick !== '') parts.push(acctNick)
  parts.push(shortUuidPrefix(row.mercury_account_id))

  const debitRaw = mercuryDebitCardIdFromRaw(row.raw)
  if (debitRaw) {
    parts.push(debitRaw, debitRaw.toLowerCase(), formatMercuryDebitCardIdCompact(debitRaw))
    const dn = ctx.nicknameByDebitCard[debitRaw.toLowerCase()]?.trim() ?? ''
    if (dn !== '') parts.push(dn)
  }

  const catTxt = mercuryCategorySearchText(row.mercury_category).trim()
  if (catTxt !== '' && catTxt !== '—') parts.push(catTxt)

  return parts.join(' ').toLowerCase()
}

/** Whitespace tokens; every token must appear as a substring of haystack (AND). Empty query matches. */
export function mercuryTxMatchesSearchQuery(haystackLower: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  for (const t of tokens) {
    if (!haystackLower.includes(t)) return false
  }
  return true
}
