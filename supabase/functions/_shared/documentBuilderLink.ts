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

/** Why a link ended: a dev switched it off, a new link replaced it, or its sheet came off the last trade's page. */
export type DocumentBuilderLinkEndedWhy = 'off' | 'replaced' | 'last_send_off'

export function documentBuilderLinkEndedWhy(raw: unknown): DocumentBuilderLinkEndedWhy | null {
  return raw === 'off' || raw === 'replaced' || raw === 'last_send_off' ? raw : null
}

/** One open of a link, as the tab reads it. A person with an account is named. Someone with none is not. */
export type DocumentBuilderLinkOpen = {
  at: string
  viewer: 'outside' | 'staff' | 'preview'
  /** The account's name, for someone signed in. */
  name: string | null
  /** Where the open came from, for someone with no account. */
  ip: string | null
  /** The browser's own name for itself, for someone with no account. */
  agent: string | null
  /** What the page reported about the device, for someone with no account. */
  device: Record<string, string>
}

/**
 * A link as the tab shows it: on with its code, or off with when and why it ended. The code is null for a link that
 * is on and whose address cannot be made again (`documentBuilderLinkCodeAgain`). `opens` are the newest opens of the
 * link that is on, or of the last one that was, and `opensTotal` is how many there are in all.
 */
export type DocumentBuilderLinkState =
  | { on: true; code: string | null; madeAt: string; opened: number; lastOpenedAt: string | null; opens?: DocumentBuilderLinkOpen[]; opensTotal?: number }
  | { on: false; endedAt?: string | null; endedWhy?: DocumentBuilderLinkEndedWhy | null; opens?: DocumentBuilderLinkOpen[]; opensTotal?: number }

/** How many opens the tab is handed. The count beside them says how many there are in all. */
export const DOCUMENT_BUILDER_LINK_OPENS_SHOWN = 20

/** What a page may report about its device with an open: a few plain details the browser already tells every site. */
export const DOCUMENT_BUILDER_LINK_DEVICE_KEYS = ['language', 'timeZone', 'screen', 'platform', 'touch'] as const

/**
 * The device details kept from an open. Only the named keys, only short plain text, and never more: whatever else a
 * page sends is dropped. This is what the browser tells every site, not a fingerprint made by a script.
 */
export function documentBuilderLinkDevice(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out
  const bag = raw as Record<string, unknown>
  for (const key of DOCUMENT_BUILDER_LINK_DEVICE_KEYS) {
    const value = bag[key]
    if (typeof value !== 'string') continue
    const text = [...value].map((ch) => (ch < ' ' || ch === '\u007f' ? ' ' : ch)).join('').trim().slice(0, 80)
    if (text) out[key] = text
  }
  return out
}

/** A request's own text, cut to what the row keeps, or null when there is none. */
function keptText(raw: string | null | undefined, max: number): string | null {
  const text = (raw ?? '').trim().slice(0, max)
  return text || null
}

/**
 * The row one open writes (`document_builder_link_opens`). A person with an account is kept by the account alone.
 * Someone with no account is kept by where the open came from, the browser's name for itself and the device.
 */
export function documentBuilderLinkOpenRow(input: {
  linkId: string
  viewer: 'outside' | 'staff' | 'preview'
  userId: string | null
  revision: number
  ip: string | null
  agent: string | null
  device: unknown
}): { link_id: string; viewer: string; user_id: string | null; revision: number | null; client_ip: string | null; user_agent: string | null; device: Record<string, string> } {
  const hasAccount = input.userId != null
  return {
    link_id: input.linkId,
    viewer: input.viewer,
    user_id: input.userId,
    revision: Number.isInteger(input.revision) && input.revision >= 1 ? input.revision : null,
    client_ip: hasAccount ? null : keptText(input.ip, 64),
    user_agent: hasAccount ? null : keptText(input.agent, 400),
    device: hasAccount ? {} : documentBuilderLinkDevice(input.device),
  }
}

/**
 * True when a send makes a sheet's link again. Every link of the sheet has ended, and the newest ended because the
 * sheet came off the last trade's page. A link a dev switched off stays off: switching it on is the dev's own press.
 */
export function documentBuilderLinkSendRemakes(rows: ReadonlyArray<{ made_at: string; ended_at: string | null; ended_why?: string | null }>): boolean {
  if (rows.length === 0 || rows.some((r) => r.ended_at == null)) return false
  const newest = [...rows].sort((a, b) => b.made_at.localeCompare(a.made_at))[0]
  return newest?.ended_why === 'last_send_off'
}

/** A browser in a few words, from its own name for itself: *Safari on iPhone*. Empty when it says nothing we read. */
export function documentBuilderLinkAgentWords(agent: string | null | undefined): string {
  const ua = agent ?? ''
  if (!ua) return ''
  const on = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) || /CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return browser && on ? `${browser} on ${on}` : browser || on
}

/**
 * One open as the card reads it: who it was, and what is known of them. A person with an account is named. Someone
 * with none is said to have none, with where the open came from and their browser.
 */
export function documentBuilderLinkOpenWords(open: DocumentBuilderLinkOpen): { who: string; detail: string } {
  if (open.viewer === 'preview') return { who: open.name ? `${open.name}, in a preview` : "The office's preview", detail: '' }
  if (open.name) return { who: open.name, detail: 'Has an account' }
  if (open.viewer === 'staff') return { who: 'Someone signed in', detail: 'Has an account' }
  const detail = [open.ip ?? '', documentBuilderLinkAgentWords(open.agent), open.device.timeZone ?? ''].filter(Boolean).join(' · ')
  return { who: 'Someone with no account', detail }
}

/**
 * What the card says of a link that is off: when it ended and why. `day` is the day it ended in the office's words.
 * A link that never was, and one that ended before the why was kept, read as the card's own plain words (`base`).
 */
export function documentBuilderLinkOffWords(state: { endedAt?: string | null; endedWhy?: DocumentBuilderLinkEndedWhy | null }, day: string, base: string): string {
  if (!state.endedAt || !day) return base
  if (state.endedWhy === 'last_send_off') return `The link is off. It closed on ${day}, when the sheet came off the last trade's page. The next send switches it on again.`
  if (state.endedWhy === 'off') return `The link is off. It was switched off on ${day}.`
  return base
}

/**
 * The line on the send card that says what taking the sheet off a page does to the sheet's link (Taunya, 2026-11-21:
 * the link closes with the last trade, and the person sees where it stands at all times). `have` is how many trades
 * have the sheet now. Empty when none does.
 */
export function documentBuilderLinkWithSendsWords(have: number): string {
  if (have <= 0) return ''
  if (have === 1) return "1 trade has this sheet. Taking it off their page also switches the sheet's link off."
  return `${have} trades have this sheet. The sheet's link stays on until the sheet is off the last trade's page.`
}
