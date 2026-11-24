/**
 * A person's own press that reloads the app, asked first when the page holds words they typed (punch list #85,
 * Diane, 2026-11-24). v2.8499 did it for the update pill's **Reload**, inside the pill. Her yes of the same day
 * was to the same for the two presses left: the gear menu's **Hard Reload**, and **Reload** on a page that
 * could not load.
 *
 * Those two presses have no pill to turn into a warning, so they share one bar (`ReloadOverWordsBar`), mounted
 * once beside the update pill. A press calls `askReloadOverWords(reload)`:
 *
 * - nothing typed on the page: `reload()` runs at once, as the press always did;
 * - words typed: nothing reloads. The bar shows, the page is walked through each place that holds them
 *   (`typedTextTour.ts`), and **Reload anyway** runs `reload()`. **Not now**, or a touch off the bar, forgets it.
 *
 * With no bar mounted the press reloads at once. A press must never do nothing, and a page drawn without the
 * app's shell has no bar to ask with.
 *
 * One ask at a time. A second press while the bar is up keeps the walk and takes the newer reload.
 */
import { pageHoldsTypedText } from './typedText'

export type ReloadAsk = {
  /** Counts up with each new ask, so the bar can tell a new one from the one it is showing. */
  id: number
  reload: () => void
}

let hosts = 0
let ask: ReloadAsk | null = null
let nextId = 1
const listeners = new Set<() => void>()

function tell(): void {
  for (const listener of [...listeners]) listener()
}

/** The bar says it is on the page. Returns its leaving, which also forgets an ask nobody can answer now. */
export function mountReloadAskHost(): () => void {
  hosts += 1
  let here = true
  return () => {
    if (!here) return
    here = false
    hosts = Math.max(0, hosts - 1)
    if (hosts === 0 && ask) {
      ask = null
      tell()
    }
  }
}

/**
 * A press that reloads. `reloaded`: it ran at once. `asked`: the bar has it, and nothing has reloaded.
 * `typed` is the page as it is at the press.
 */
export function askReloadOverWords(reload: () => void, typed: () => boolean = pageHoldsTypedText): 'reloaded' | 'asked' {
  if (hosts === 0 || !typed()) {
    reload()
    return 'reloaded'
  }
  ask = ask ? { id: ask.id, reload } : { id: nextId++, reload }
  tell()
  return 'asked'
}

/** The ask the bar is showing, or null. */
export function currentReloadAsk(): ReloadAsk | null {
  return ask
}

export function subscribeReloadAsk(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** **Not now**, or a touch off the bar: the ask is forgotten and nothing reloads. */
export function endReloadAsk(): void {
  if (!ask) return
  ask = null
  tell()
}

/** **Reload anyway**: the ask is cleared first, then its reload runs once. */
export function confirmReloadAsk(): void {
  const asked = ask
  if (!asked) return
  ask = null
  tell()
  asked.reload()
}

/** Tests only. */
export function __resetReloadAskForTests(): void {
  hosts = 0
  ask = null
  nextId = 1
  listeners.clear()
}
