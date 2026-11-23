/**
 * What an on-demand window does when its code does not come (punch list #85, the main chunk's split).
 *
 * A window held through `lazyWindow` is a chunk of its own. When that chunk cannot arrive the load
 * throws, and until now nothing stood between the window and the boundary around the routes, which
 * drew its fallback in place of the whole signed-in app. `WindowLoadBoundary` draws what this decides:
 * only the window gives up, with one line of words, and the page behind it stays.
 *
 * The boundary starts no reload of its own. In the built app every dynamic import passes through
 * Vite's preload helper, so `main.tsx`'s `vite:preloadError` handler has already had its one guarded
 * try (`chunkLoadRecovery`) by the time the failure reaches a boundary. What reaches this one is what
 * that try refused: the phone is offline, or a recovery reload ran inside the last minute.
 */
import { isChunkLoadError } from './chunkLoadRecovery'

/** What the boundary draws: the window, a note while a reload is on its way, nothing, or not its error. */
export type WindowLoadView = 'window' | 'updating' | 'gave-up' | 'broken'

/**
 * What a window's boundary does with the error it holds. While a recovery reload is on its way the
 * answer is `updating` whatever the error says: the preload handler cancelled Vite's throw, the
 * window's import resolved to nothing, and the error names no chunk. A lost chunk with no reload
 * coming is `gave-up`: the window closes with its line. Any other error is not this boundary's and
 * goes to the one above, as it did before.
 */
export function windowLoadView(error: unknown, reloadOnItsWay: boolean): WindowLoadView {
  if (error == null) return 'window'
  if (reloadOnItsWay) return 'updating'
  return isChunkLoadError(error) ? 'gave-up' : 'broken'
}

/** The note over the page while the recovery reload is on its way. The words the routes' boundary uses. */
export const WINDOW_UPDATING_WORDS = 'Updating app…'

/** How long the line stays: two short sentences, read once. */
export const WINDOW_LOST_LINE_MS = 8000

/**
 * The one line a window leaves when it gives up. `what` is the window as its host names it, with its
 * article: "The job", "The bid". It names the next press, since the line has none of its own.
 */
export function windowLostWords(what: string): string {
  return `${what} could not open. Check your signal, then press it again.`
}

/** The windows the app holds on demand, by the name each one's line carries. */
export const WINDOW_NAMES = {
  job: 'The job',
  jobForm: 'The job form',
  bid: 'The bid',
  customer: 'The customer',
  customerForm: 'The customer form',
  review: 'The review',
  personDesk: 'The desk',
  map: 'The map',
} as const
