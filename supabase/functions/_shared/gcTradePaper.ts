/**
 * GC mode, the trade partner portal's P5b-1 (to-dos/gc-mode/mockups/portal-p5b.md): a company opens its master agreement
 * or its W-9 to sign on `/contract/accept`, the page the office's email opens. The function mints a fresh token as the
 * sub portal's `sign_link` does (`submit-sub-portal`), hands its SHA-256 to `gc_trade_paper_open` with the expiry, and
 * answers the page the path with the raw token, which never reaches the database. The newest link wins (decision B).
 * Pure, with only Web Crypto, so `src/lib/gc/gcTradePaper.test.ts` holds it.
 */

/** How long a signing link opened from the portal works, as the office's send and the sub portal's `sign_link` give it. */
export const PAPER_LINK_DAYS = 14

/** Where a paper is signed: the token follows. */
export const PAPER_SIGN_PATH = '/contract/accept?t='

/** A token's raw text, 64 hex characters from two random UUIDs, as `sign_link` and `send-contract-for-signature` mint it. */
export function paperTokenRaw(): string {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
}

/** The SHA-256 of a token, in hex: what `person_contract_documents.public_token_hash` keeps. */
export async function paperTokenHash(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** A fresh signing token: the raw text for the page, its hash and expiry for the verb. */
export async function mintPaperToken(now: Date = new Date()): Promise<{ raw: string; hash: string; expiresAt: string }> {
  const raw = paperTokenRaw()
  return { raw, hash: await paperTokenHash(raw), expiresAt: new Date(now.getTime() + PAPER_LINK_DAYS * 86_400_000).toISOString() }
}

/** The path the page goes to, to sign. */
export function paperSignPath(raw: string): string {
  return `${PAPER_SIGN_PATH}${raw}`
}
