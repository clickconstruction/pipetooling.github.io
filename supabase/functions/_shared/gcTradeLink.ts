/**
 * GC mode, the trade partner portal: how a link becomes its company, for the read (`gc-trade-portal`) and the
 * writes (`submit-gc-trade-portal`) alike (P2b-i, to-dos/gc-mode/mockups/portal-p2b.md). The raw token first, the
 * way the office copies it again, then its SHA-256 hash, the sub portal's way; a link turned off is no link.
 * Pure but for the lookup it is handed, so the rule is tested once (`src/lib/gc/gcTradeLink.test.ts`).
 */

export interface TradeLinkRow {
  company_id: string
  revoked_at: string | null
}

/** One lookup in `gc_trade_portal_links` by a column, the caller's query. */
export type FindTradeLink = (column: 'token' | 'token_hash', value: string) => Promise<TradeLinkRow | null>

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** The company's link that is on, or null: unknown, or turned off. */
export async function resolveTradeLink(token: string, find: FindTradeLink): Promise<TradeLinkRow | null> {
  const link = (await find('token', token)) ?? (await find('token_hash', await sha256Hex(token)))
  return link && !link.revoked_at ? link : null
}
