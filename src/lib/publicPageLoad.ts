/**
 * What a public page says while its code loads, and when that load fails (v2.8327).
 *
 * A page a customer, a sub, a GC or the law firm opens from a link is a chunk of its own, so the link no
 * longer downloads every other public page with it. The price is one more file to fetch before the page
 * draws, and on a phone with a weak signal that fetch can be slow or fail. `PublicPage` draws what this
 * decides: the page's own frame with *Loading…*, a line and a press once the wait is long, and words with
 * a press when the file did not come. Never an empty page.
 */

/** The frame a public page stands in, so the wait is drawn on the page's own ground. */
export type PublicPageTone =
  /** The photo and the white box: the estimate, the agreement, the sub's contract, the bid room. */
  | 'landing'
  /** The portal's paper: the account page, pay, the legal portal, the receipt and file links. */
  | 'paper'
  /** A plain light page: the rating, the terms, the submittal room, a supply house's quote. */
  | 'plain'

export const PUBLIC_PAGE_LOADING_WORDS = 'Loading…'
export const PUBLIC_PAGE_SLOW_WORDS = 'This is taking a while. Your signal may be weak.'
export const PUBLIC_PAGE_LOST_WORDS = 'This page did not load. Check your signal, then try again.'
export const PUBLIC_PAGE_OFFLINE_WORDS = 'You are offline. This page will load when you are back online.'
export const PUBLIC_PAGE_STILL_OFFLINE_WORDS = 'Still offline. Try again when you have a signal.'
export const PUBLIC_PAGE_CHECKING_WORDS = 'Checking for a signal…'
export const PUBLIC_PAGE_TRY_AGAIN = 'Try again'

/** How long the paper stays bare before *Loading…* shows, so a page already on the device never flashes the word. */
export const PUBLIC_PAGE_WORD_AFTER_MS = 250

/** How long the wait may run before the page offers a press. A hung fetch never fails, so nothing else would. */
export const PUBLIC_PAGE_SLOW_AFTER_MS = 10_000

export type PublicPageLostView = {
  words: string
  /** True when the press should reload. False when the browser says there is no network to reload from. */
  reload: boolean
  /** True while the page asks the network whether it is there. The press is dead until the answer. */
  checking: boolean
}

/**
 * What the page says once its code did not come, and what **Try again** does. `online` is the browser's own
 * word (`navigator.onLine`): only a plain `false` counts as offline, since a browser that cannot say is
 * treated as online. `pressedOffline` is true once someone pressed while offline, so the press visibly answers.
 * `checking` is true while a later press's ask is out (`probeForSignal`).
 */
export function publicPageLostView(online: boolean | undefined, pressedOffline: boolean, checking = false): PublicPageLostView {
  if (online === false) {
    if (checking) return { words: PUBLIC_PAGE_CHECKING_WORDS, reload: false, checking: true }
    return { words: pressedOffline ? PUBLIC_PAGE_STILL_OFFLINE_WORDS : PUBLIC_PAGE_OFFLINE_WORDS, reload: false, checking: false }
  }
  return { words: PUBLIC_PAGE_LOST_WORDS, reload: true, checking: false }
}

/** What one press on **Try again** does: reload, answer in words, or ask the network first. */
export type PublicPageTryAgainAct = 'reload' | 'answer' | 'ask'

/**
 * What a press on **Try again** does (the owner, 2026-11-23). Online, it reloads. On a phone that says it is
 * offline the first press answers in words, as it always has. A phone can say so wrongly, and then the customer
 * was held on this page for as long as it did. So the second press, and each one after it, asks the network
 * itself (`probeForSignal`), and the page reloads only when the network answers.
 *
 * It never reloads on the browser's word alone, nor on the count of presses alone. A reload with no network
 * empties the caches and lands on the browser's own error page, which is worse than this one.
 */
export function publicPageTryAgainAct(online: boolean | undefined, pressedOffline: boolean): PublicPageTryAgainAct {
  if (online !== false) return 'reload'
  return pressedOffline ? 'ask' : 'answer'
}

/**
 * The file the ask reads: the site's own icon, 2 kB, at an address that never changes. The icon is in the
 * service worker's precache, so the bare address is answered from the phone with no network at all. The key
 * `publicPageProbeUrl` puts on the address is what stops that: the precache matches an address exactly, but
 * for the campaign keys it is told to ignore (`src/sw.ts` names none of its own), so the ask reaches the
 * network or fails. Seen on the built app, 2026-11-23: offline, the bare icon answered and the ask failed.
 */
export const PUBLIC_PAGE_PROBE_PATH = '/favicon.svg'

/** How long the ask may take. A weak signal that cannot bring 2 kB in this time cannot bring the page either. */
export const PUBLIC_PAGE_PROBE_TIMEOUT_MS = 5000

/** The ask's address: the icon with the time on it, so neither the service worker nor any cache on the way has it. */
export function publicPageProbeUrl(nowMs: number): string {
  return `${PUBLIC_PAGE_PROBE_PATH}?signal=${nowMs}`
}

type ProbeResponse = { ok: boolean; headers: { get: (name: string) => string | null } }

/**
 * True when the answer is the site's own icon. A sign-in wall on a shop's or a hotel's network answers every
 * address with its own page, and that is not the network this page needs.
 */
export function probeAnswered(response: ProbeResponse): boolean {
  if (!response.ok) return false
  return (response.headers.get('content-type') ?? '').toLowerCase().startsWith('image/svg')
}

type ProbeFetch = (url: string, init: { cache: 'no-store'; credentials: 'omit'; signal: AbortSignal }) => Promise<ProbeResponse>

/**
 * Asks the network once whether it is there: one small request that no cache may answer, given up after
 * `timeoutMs`. True only when the site's own server answered with the file. It never throws.
 */
export async function probeForSignal(
  fetcher: ProbeFetch = (url, init) => fetch(url, init),
  nowMs: number = Date.now(),
  timeoutMs: number = PUBLIC_PAGE_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), timeoutMs)
  try {
    return probeAnswered(await fetcher(publicPageProbeUrl(nowMs), { cache: 'no-store', credentials: 'omit', signal: stop.signal }))
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
