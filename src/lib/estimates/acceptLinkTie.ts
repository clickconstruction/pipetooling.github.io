/**
 * The tie between an estimate and the texts that carried its link (v2.5697, punch list #139 PR 6). An outbound text
 * is not stamped with its estimate (`messages.estimate_id` means a customer's message that became a line on one), but
 * its body holds the accept link, `…/estimate/accept?t=<token>`, and the estimate row keeps `public_token_hash`, the
 * SHA-256 hex of that token as `send-estimate-to-customer` mints it. Hashing the token in the browser the same way
 * names the estimate exactly — a body match by itself let an older estimate claim any later one's text (#164 read
 * #166's, the walk of 2026-10-20). A resend re-mints the hash, so the texts a card shows are the ones carrying the
 * estimate's live link. Pure apart from Web Crypto; no client import, so it tests under Node.
 */

/** The `t=` tokens of every accept link in a body, in order, as the link carries them. */
export function acceptTokensIn(body: string): string[] {
  return Array.from(body.matchAll(/\/estimate\/accept\?t=([A-Za-z0-9._~%-]+)/g), (m) => decodeURIComponent(m[1] ?? ''))
}

/** SHA-256 of a string's UTF-8 bytes as lowercase hex — the edge's `sha256HexFromString`. Null where Web Crypto is missing. */
export async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** The texts whose link is this estimate's live one: any token in the body hashing to `tokenHash`. None without a hash. */
export async function textsCarryingLink<T extends { body: string }>(texts: readonly T[], tokenHash: string | null): Promise<T[]> {
  if (!tokenHash) return []
  const want = tokenHash.toLowerCase()
  const kept: T[] = []
  for (const t of texts) {
    for (const token of acceptTokensIn(t.body)) {
      if ((await sha256Hex(token)) === want) {
        kept.push(t)
        break
      }
    }
  }
  return kept
}
