/**
 * The address a person asked for before they signed in, kept across the sign-in (v2.7182).
 *
 * One rule decides what may be kept (`safeReturnAddress`): a path on this site, starting with one `/`. Anything else
 * reads as nothing, so the sign-in can never be used to send someone off the site.
 *
 * Two carriers hold it. The browser's storage (`POST_LOGIN_REDIRECT_KEY`) serves the password sign-in and an emailed
 * link opened in another tab. The emailed link also carries it as `/sign-in?next=…`, since a mail app may open the
 * link in a browser that shares no storage with the one that asked.
 *
 * Writers: the sign-in gate (`SignedOutGate`), the standalone /task launch, a box label's page and a file link, each
 * through `keepReturnAddress`, which also notes the time. A stored address is good for `RETURN_ADDRESS_KEEP_MS`: past
 * that it reads as nothing, so a scan somebody gave up on does not decide where the next sign-in lands (v2.7182).
 * Reader: `LeaveSignIn`, the one place a signed-in person leaves the sign-in page.
 */

import { POST_LOGIN_REDIRECT_KEY } from './iosPwa'

/** The longest address kept. A job's Lien window address is about 90 characters. */
export const RETURN_ADDRESS_MAX = 2000

/** How long a stored address is good for. An emailed sign-in link is good for an hour too. */
export const RETURN_ADDRESS_KEEP_MS = 60 * 60 * 1000

/** Where the time an address was stored is kept, beside `POST_LOGIN_REDIRECT_KEY`. */
export const POST_LOGIN_REDIRECT_AT_KEY = `${POST_LOGIN_REDIRECT_KEY}_at`

/** The sign-in page's own path. Never a place to return to. */
export const SIGN_IN_PATH = '/sign-in'

/** Where the emailed link lands when no address is waiting, as it has since v2.2524. */
export const MAGIC_LINK_DEFAULT_LANDING = '/dashboard'

/** The query key the emailed link carries the address under. */
export const RETURN_ADDRESS_PARAM = 'next'

/** An origin no address can name, to resolve a path against and see whether it stayed on the site. */
const PROBE_ORIGIN = 'https://return-address.invalid'

/** A heading's anchor (`#the-month-rule`). A sign-in token or an error rides in the hash too, and is never kept. */
const PLAIN_ANCHOR = /^#[A-Za-z0-9._~-]+$/

// A browser reads a backslash as a slash and drops tabs and line breaks, so `/\host` and `/<tab>/host` both leave the site.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/

function startsOnSite(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

/**
 * The address as it may be kept, or null. Kept: a same-site path with its query, and its hash when the hash is a plain
 * anchor. Refused: another site in any spelling (`https://…`, `//host`, `/\host`, a path whose dot segments resolve to
 * `//host`), control characters, an address past `RETURN_ADDRESS_MAX`, and the two addresses that mean "no place asked
 * for": the site's root and the sign-in page.
 */
export function safeReturnAddress(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > RETURN_ADDRESS_MAX) return null
  if (!startsOnSite(raw) || UNSAFE_CHARS.test(raw)) return null
  let url: URL
  try {
    url = new URL(raw, PROBE_ORIGIN)
  } catch {
    return null
  }
  if (url.origin !== PROBE_ORIGIN) return null
  const path = url.pathname
  // `/..//host` passes the first check and resolves to `//host`: the check runs again on what the browser would open.
  if (!startsOnSite(path)) return null
  const bare = path.replace(/\/+$/, '')
  if (bare === '' || bare === SIGN_IN_PATH) return null
  return `${path}${url.search}${PLAIN_ANCHOR.test(url.hash) ? url.hash : ''}`
}

/** A page's location as react-router or `window.location` gives it. */
export type AddressParts = { pathname: string; search?: string | null; hash?: string | null }

/** The address of a location, as it may be kept. */
export function returnAddressOf(loc: AddressParts): string | null {
  return safeReturnAddress(`${loc.pathname}${loc.search ?? ''}${loc.hash ?? ''}`)
}

/** What the gate does with the stored address when it turns a visitor away. */
export type GateMemory = { act: 'keep'; address: string } | { act: 'forget' } | { act: 'leave' }

/**
 * A visitor who arrives signed out asked for the page in the address bar: keep it. One who asked for the root asked
 * for the default page: forget an older address, so the newest ask wins. A person who was signed in on this visit and
 * is now signed out (a press on Sign out, a session that ended) asked for nothing: the stored address is left as it is,
 * so the next person at this browser does not land on the last one's page.
 */
export function gateMemory(loc: AddressParts, hadSessionThisVisit: boolean): GateMemory {
  if (hadSessionThisVisit) return { act: 'leave' }
  const address = returnAddressOf(loc)
  return address ? { act: 'keep', address } : { act: 'forget' }
}

/** The address the sign-in page's own query carries, when an emailed link put one there. */
export function returnAddressFromSignInSearch(search: string | null | undefined): string | null {
  if (!search) return null
  return safeReturnAddress(new URLSearchParams(search).get(RETURN_ADDRESS_PARAM))
}

/** The address waiting on the sign-in page: the link's own first, then the stored one. Each passes the one rule. */
export function waitingReturnAddress(args: { search?: string | null; stored?: string | null }): string | null {
  return returnAddressFromSignInSearch(args.search) ?? safeReturnAddress(args.stored)
}

/**
 * The sign-in page's own address, carrying a waiting address; null with none waiting. A signed-in person who loads it
 * is sent straight on. The password sign-in reloads the page onto it: a plain reload reloads whatever address the app
 * has already moved to, and a page that opens a one-shot door (`?lienwindow=`) has by then taken the door off it.
 */
export function signInHrefCarrying(returnAddress: string | null | undefined): string | null {
  const address = safeReturnAddress(returnAddress)
  return address ? `${SIGN_IN_PATH}?${RETURN_ADDRESS_PARAM}=${encodeURIComponent(address)}` : null
}

/**
 * Where an emailed sign-in link lands, as a path on this site. With an address waiting it lands on the sign-in page
 * carrying that address, and the page sends the signed-in person on. With none it lands where it always has.
 */
export function magicLinkLandingPath(returnAddress: string | null | undefined): string {
  return signInHrefCarrying(returnAddress) ?? MAGIC_LINK_DEFAULT_LANDING
}

/** Where a signed-in person leaves the sign-in page for: the waiting address, else the role's landing. */
export function signedInDestination(args: { search?: string | null; stored?: string | null; landing: string }): string {
  return waitingReturnAddress(args) ?? args.landing
}

// --- storage (each call is safe when storage is missing or refuses, as in a private window) ---

/** The part of `Storage` these helpers use, so a test hands in a plain object. */
export type ReturnAddressStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The browser's storage, or null where there is none. */
export function browserReturnAddressStore(): ReturnAddressStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * Whether an address stored at `storedAt` is still good at `now`. No time beside it reads as good: a build from before
 * this one stored the address alone. A time that is not a number, or one ahead of the clock, reads as not good.
 */
export function returnAddressIsFresh(storedAt: string | null | undefined, now: number): boolean {
  if (storedAt == null || storedAt === '') return true
  const at = Number(storedAt)
  if (!Number.isFinite(at)) return false
  const age = now - at
  return age >= 0 && age <= RETURN_ADDRESS_KEEP_MS
}

/**
 * Keep an address to come back to after the sign-in, with the time. The one writer: every door that sends a person to
 * sign in calls it. An address that fails the rule is not kept, and whatever was stored before it is forgotten.
 */
export function keepReturnAddress(store: ReturnAddressStore | null, address: string, now: number = Date.now()): void {
  const kept = safeReturnAddress(address)
  if (!kept) {
    forgetStoredReturnAddress(store)
    return
  }
  try {
    store?.setItem(POST_LOGIN_REDIRECT_KEY, kept)
    store?.setItem(POST_LOGIN_REDIRECT_AT_KEY, String(now))
  } catch {
    /* the sign-in still works; the person lands on the default page */
  }
}

/**
 * The stored address as written, or null when it has gone past its time. `waitingReturnAddress` holds it to the rule.
 * Reads only: the caller's render stays pure.
 */
export function readStoredReturnAddress(store: ReturnAddressStore | null, now: number = Date.now()): string | null {
  try {
    const address = store?.getItem(POST_LOGIN_REDIRECT_KEY) ?? null
    if (address === null) return null
    return returnAddressIsFresh(store?.getItem(POST_LOGIN_REDIRECT_AT_KEY), now) ? address : null
  } catch {
    return null
  }
}

/** The stored address is spent, or was never one. */
export function forgetStoredReturnAddress(store: ReturnAddressStore | null): void {
  try {
    store?.removeItem(POST_LOGIN_REDIRECT_KEY)
    store?.removeItem(POST_LOGIN_REDIRECT_AT_KEY)
  } catch {
    /* the sign-in still works; the address was one use either way */
  }
}

/** Carry out the gate's decision. */
export function applyGateMemory(store: ReturnAddressStore | null, memory: GateMemory, now: number = Date.now()): void {
  if (memory.act === 'leave') return
  if (memory.act === 'forget') forgetStoredReturnAddress(store)
  else keepReturnAddress(store, memory.address, now)
}
