/**
 * The Document builder's link (punch list #404, steps 4 and 8): the rules both the edge function and the app keep.
 * A link is a second way in to a published sheet or builder, for someone with no page of their own. No imports, so
 * the app's tests import it as the function does (`src/lib/documentBuilder/link.ts` re-exports it).
 *
 * Only the SHA-256 of a link's code is kept. The row also keeps a random nonce, and the code is made from the row's
 * id, the nonce and a secret only the function holds. So the function can make the same code again for a dev who
 * asks, and the database alone cannot. The only thing here that is not plain arithmetic is Web Crypto, which the
 * function's runtime and the tests' both have.
 */

/** No letter or number that reads as another: no 0, 1, i, l or o. The painted map link's alphabet. */
export const DOCUMENT_BUILDER_LINK_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const DOCUMENT_BUILDER_LINK_CODE_LENGTH = 16
export const DOCUMENT_BUILDER_LINK_PATH = '/d'

export const DOCUMENT_BUILDER_LINK_WORDS = {
  /** A wrong code, a link switched off and a link a new one replaced all read the same: nothing is told apart. */
  gone: 'This link is no longer open. Ask for a new one.',
  /** A link whose sheet or builder has nothing published to show. */
  nothing: 'Nothing is published on this link yet.',
  failed: 'Something went wrong. Try again in a moment.',
  notYours: 'Only a dev manages a link for now.',
  training: 'A training account and a twin make no link.',
  notPublished: 'Publish it first. A link then opens it.',
} as const

/**
 * A code out of bytes: one letter a byte, skipping the few bytes that would lean toward the alphabet's first letters.
 * Null when the bytes run out before the code is whole, so the caller hands in more.
 */
export function documentBuilderLinkCode(bytes: Uint8Array): string | null {
  const n = DOCUMENT_BUILDER_LINK_ALPHABET.length
  const fair = 256 - (256 % n)
  let out = ''
  for (const b of bytes) {
    if (b >= fair) continue
    out += DOCUMENT_BUILDER_LINK_ALPHABET[b % n]
    if (out.length === DOCUMENT_BUILDER_LINK_CODE_LENGTH) return out
  }
  return null
}

/** A code as a person might paste it: trimmed and lowercased, or null when it is not shaped like one. */
export function documentBuilderLinkCodeFrom(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toLowerCase()
  if (code.length !== DOCUMENT_BUILDER_LINK_CODE_LENGTH) return null
  for (const ch of code) if (!DOCUMENT_BUILDER_LINK_ALPHABET.includes(ch)) return null
  return code
}

/** What the code is made from. The secret is the function's and is never in the database. */
export function documentBuilderLinkSeed(linkId: string, nonce: string, round: number): string {
  return `document-builder-link:${linkId}:${nonce}:${round}`
}

/**
 * The secrets a link's code may have been made under, the one a new link is made under first. The link's own secret
 * leads when it is set. The service role key follows: it stood in for it before the secret was set, so a link made
 * then is still made again here. Each is trimmed, and one that is empty or said twice is left out.
 */
export function documentBuilderLinkSecrets(own: string | null | undefined, serviceKey: string | null | undefined): string[] {
  const out: string[] = []
  for (const raw of [own, serviceKey]) {
    const secret = (raw ?? '').trim()
    if (secret && !out.includes(secret)) out.push(secret)
  }
  return out
}

/** A link's code under one secret: HMAC-SHA256 of the row's id and nonce, written in the link alphabet. */
export async function documentBuilderLinkCodeUnder(secret: string, linkId: string, nonce: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  // One round is 32 bytes and nearly always enough. A few more are joined on the rare run of skipped bytes.
  let bytes = new Uint8Array(0)
  for (let round = 0; round < 8; round++) {
    const more = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(documentBuilderLinkSeed(linkId, nonce, round))))
    const joined = new Uint8Array(bytes.length + more.length)
    joined.set(bytes)
    joined.set(more, bytes.length)
    bytes = joined
    const code = documentBuilderLinkCode(bytes)
    if (code) return code
  }
  throw new Error('the link code could not be made')
}

/** SHA-256 of a code, as the row keeps it. */
export async function documentBuilderLinkHash(code: string): Promise<string> {
  return documentBuilderHexOf(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code))))
}

/**
 * The code of a link that exists, made again from its row. Each secret is tried in turn, and the code is the one
 * whose hash is the row's own: a link is made again under the secret it was made under, whichever leads today. Null
 * when no secret this side holds makes it. The link then still opens for anyone who has it, since an open reads the
 * hash alone, but nobody can be shown its address again.
 */
export async function documentBuilderLinkCodeAgain(secrets: ReadonlyArray<string>, row: { id: string; nonce: string; code_hash: string }): Promise<string | null> {
  for (const secret of secrets) {
    const code = await documentBuilderLinkCodeUnder(secret, row.id, row.nonce)
    if ((await documentBuilderLinkHash(code)) === row.code_hash) return code
  }
  return null
}

/**
 * Said on the builder's link card for a link that is on and whose address cannot be made again. The link is not
 * broken for the people who hold it, so the card says so before it offers a new one.
 */
export const DOCUMENT_BUILDER_LINK_ADDRESS_LOST = 'This link is on, but its address can no longer be shown here. It still opens for anyone who has it. Make a new link to get one you can copy. The old one then stops.'

export function documentBuilderLinkUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}${DOCUMENT_BUILDER_LINK_PATH}/${code}`
}

export function documentBuilderHexOf(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** True while a link opens: it has not been switched off or replaced. */
export function documentBuilderLinkOpen(row: { ended_at: string | null }): boolean {
  return row.ended_at == null
}

/** What a link opens, as the page reads it. */
export type DocumentBuilderLinkAnswer =
  | { kind: 'sheet'; revision: number; sheet: unknown; job: string }
  | { kind: 'builder'; revision: number; builder: string; contents: unknown }

/**
 * A link as the tab shows it: on with its code, or off. The code is null for a link that is on and whose address
 * cannot be made again (`documentBuilderLinkCodeAgain`).
 */
export type DocumentBuilderLinkState = { on: true; code: string | null; madeAt: string; opened: number; lastOpenedAt: string | null } | { on: false }
