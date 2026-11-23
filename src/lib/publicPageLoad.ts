/**
 * What a public page says while its code loads, and when that load fails (v2.8306).
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
export const PUBLIC_PAGE_TRY_AGAIN = 'Try again'

/** How long the paper stays bare before *Loading…* shows, so a page already on the device never flashes the word. */
export const PUBLIC_PAGE_WORD_AFTER_MS = 250

/** How long the wait may run before the page offers a press. A hung fetch never fails, so nothing else would. */
export const PUBLIC_PAGE_SLOW_AFTER_MS = 10_000

export type PublicPageLostView = {
  words: string
  /** True when the press should reload. False when the browser says there is no network to reload from. */
  reload: boolean
}

/**
 * What the page says once its code did not come, and what **Try again** does. `online` is the browser's own
 * word (`navigator.onLine`): only a plain `false` counts as offline, since a browser that cannot say is
 * treated as online. `pressedOffline` is true once someone pressed while offline, so the press visibly answers.
 */
export function publicPageLostView(online: boolean | undefined, pressedOffline: boolean): PublicPageLostView {
  if (online === false) {
    return { words: pressedOffline ? PUBLIC_PAGE_STILL_OFFLINE_WORDS : PUBLIC_PAGE_OFFLINE_WORDS, reload: false }
  }
  return { words: PUBLIC_PAGE_LOST_WORDS, reload: true }
}
