/**
 * The tie between an estimate and the texts that carried its link (v2.5697, punch list #139 PR 6; the share link's
 * shape since v2.6725, punch list #281). An outbound text is not stamped with its estimate (`messages.estimate_id`
 * means a customer's message that became a line on one), but its body holds the link, and the row the link names
 * keeps the link's SHA-256 hex: the emailed link `…/estimate/accept?t=<token>` against `estimates.public_token_hash`
 * as `send-estimate-to-customer` mints it, and the texted share link `https://my.clickplumbing.com/e/<code>` (before
 * v2.6678 the same code, or a 32-character share token, on the accept page) against `estimate_share_links.token_hash`
 * as `share_estimate_link` stores it. Hashing the token in the browser the same way names the estimate exactly — a
 * body match by itself let an older estimate claim any later one's text (#164 read #166's, the walk of 2026-10-20).
 * A resend re-mints the emailed hash, so the emailed-link texts a card shows are the ones carrying the live link; a
 * share link stands for its own 14 days, so its text stays on the card (the walk of 2026-11-08 read *No text went*
 * under a text that went on the short link). Pure apart from Web Crypto; no client import, so it tests under Node.
 */

/** `…/estimate/accept?t=<token>`: the emailed link, or a share token on the accept page before v2.6678. */
const ACCEPT_LINK = /\/estimate\/accept\?t=([A-Za-z0-9._~%-]+)/g
/** `https://<host>/e/<code>`: the short link since v2.6678. A host is required, so a bare `/e/` in prose is no link. */
const SHORT_LINK = /https?:\/\/[^\s/]+\/e\/([A-Za-z0-9]+)/g
/** Either shape, in the order the body carries them: group 1 the accept token, group 2 the short code. */
const ANY_LINK = new RegExp(`${ACCEPT_LINK.source}|${SHORT_LINK.source}`, 'g')

/** The `t=` tokens of every accept link in a body, in order, as the link carries them. */
export function acceptTokensIn(body: string): string[] {
  return Array.from(body.matchAll(ACCEPT_LINK), (m) => decodeURIComponent(m[1] ?? ''))
}

/**
 * The codes of every short link in a body, in order, lower-cased as the `portal-link-shell` Worker forwards them
 * (`share_estimate_link` mints lowercase, so the row's hash is the lowercase code's).
 */
export function shortCodesIn(body: string): string[] {
  return Array.from(body.matchAll(SHORT_LINK), (m) => (m[1] ?? '').toLowerCase())
}

/** Every token a body's estimate links carry, both shapes, in the order they appear. */
export function linkTokensIn(body: string): string[] {
  return Array.from(body.matchAll(ANY_LINK), (m) => (m[1] != null ? decodeURIComponent(m[1]) : (m[2] ?? '').toLowerCase()))
}

/** SHA-256 of a string's UTF-8 bytes as lowercase hex — the edge's `sha256HexFromString`. Null where Web Crypto is missing. */
export async function sha256Hex(text: string): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) return null
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The texts whose link is this estimate's: any token in the body, either shape, hashing to the emailed link's
 * `tokenHash` or to one of the estimate's share links' `shareHashes`. None without any hash.
 */
export async function textsCarryingLink<T extends { body: string }>(texts: readonly T[], tokenHash: string | null, shareHashes: readonly string[] = []): Promise<T[]> {
  const want = new Set([tokenHash, ...shareHashes].filter((h): h is string => typeof h === 'string' && h.length > 0).map((h) => h.toLowerCase()))
  if (want.size === 0) return []
  const kept: T[] = []
  for (const t of texts) {
    for (const token of linkTokensIn(t.body)) {
      const hash = await sha256Hex(token)
      if (hash && want.has(hash)) {
        kept.push(t)
        break
      }
    }
  }
  return kept
}
