/**
 * What the **Reload** press on a route's fallback does (punch list #85, the live look of 2026-11-24).
 *
 * A signed-in page whose code did not come draws *This page could not load…* with **Reload**
 * (`RouteChunkBoundary`). The press ran `hardReloadFromRoot` at once. That unregisters the service worker and
 * empties every cache before it navigates, so with no network there was nothing left to draw: the look
 * pressed it offline on `bills-sent` and ended on the browser's own error page, with the installed app gone
 * from the phone until the signal came back.
 *
 * So the press asks first, as a customer's **Try again** does (`probeForSignal`, v2.8379): one small request
 * no cache can answer. Only an answer reloads. It asks whatever the browser says about the network, since a
 * browser can say it is online with nothing behind it, and the ask is cheap where the network is whole.
 */
import { PUBLIC_PAGE_CHECKING_WORDS } from './publicPageLoad'

/**
 * Where the press stands: ready, asking the network, answered no, or answered yes with a reload that never
 * landed. `stalled` is punch list #406: on a yes the press stays dead while the page leaves, and a page that
 * never left kept it dead for good, with *Checking for a signal…* under it.
 */
export type RouteReloadState = 'ready' | 'checking' | 'no-signal' | 'stalled'

export const ROUTE_RELOAD_PRESS = 'Reload'
/** The words while the ask is out. A customer's page says the same. */
export const ROUTE_RELOAD_CHECKING_WORDS = PUBLIC_PAGE_CHECKING_WORDS
/** The words after an ask nothing answered. They name the press, since it is the next thing to do. */
export const ROUTE_RELOAD_NO_SIGNAL_WORDS = 'No signal, so nothing was reloaded. Press Reload when the signal is back.'

/** The words when the reload was started and the page is still here. They name the press, the next thing to do. */
export const ROUTE_RELOAD_STALLED_WORDS = 'The reload did not finish. Press Reload to try again.'
/**
 * How long the press stays dead after a yes before it comes back. The reload leaves in three seconds at
 * most (`WIPE_DEADLINE_MS` in `hardReload.ts`), and the rest is the new page's own load.
 */
export const ROUTE_RELOAD_LAND_MAX_MS = 10_000

/** A press should be this tall on a phone. The fallback's was 36. */
export const ROUTE_RELOAD_PRESS_MIN_HEIGHT = 44

export type RouteReloadView = {
  /** The line under the press, null while there is nothing to say. */
  words: string | null
  /** True while the ask is out, so a second press cannot send a second ask. */
  pressDead: boolean
}

export function routeReloadView(state: RouteReloadState): RouteReloadView {
  if (state === 'checking') return { words: ROUTE_RELOAD_CHECKING_WORDS, pressDead: true }
  if (state === 'no-signal') return { words: ROUTE_RELOAD_NO_SIGNAL_WORDS, pressDead: false }
  if (state === 'stalled') return { words: ROUTE_RELOAD_STALLED_WORDS, pressDead: false }
  return { words: null, pressDead: false }
}

/** What follows the ask's answer. A no never reloads, however many times the press is pressed. */
export function routeReloadAfterAsk(answered: boolean): 'reload' | 'no-signal' {
  return answered ? 'reload' : 'no-signal'
}
