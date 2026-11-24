/**
 * The cure for a window this page can no longer load (punch list #85, Diane's yes of 2026-11-24).
 *
 * A window whose code did not come says *The job could not open. Check your signal, then press it again.*
 * In Chromium the next press could not open it: the browser keeps the failed import for the life of the page
 * (`lazyWindow.ts`), so the press reloaded the app and a third press opened the job. Inside a minute of a
 * recovery reload it only said the line again.
 *
 * So the page mends itself before the next press. Once the signal is back, and only when nothing would be
 * lost, the app asks for its lost windows again (`rewarmLostWindows`). Safari and Firefox load them, and
 * nothing else happens. Chromium fails the ask, and that failure takes the road every lost chunk takes:
 * `main.tsx`'s handler starts the one guarded recovery reload. The page comes back whole and the next press
 * opens the window.
 *
 * **Nothing typed is ever lost to it** (Diane, 2026-11-24). Words someone typed and has not sent hold the
 * cure for as long as they are on the page (`typedText.ts`), and so do a focused field, an open window, a
 * component that holds unsaved work and a write in flight. A held cure looks again; it never gives up the
 * hold. The person's own next press is still there, and the recovery reload it may start holds for typed
 * words by the same rule (`chunkLoadRecovery.ts`).
 *
 * It asks the network first (`probeForSignal`), as every reload that empties the caches now does. And it
 * tries once in ten minutes: a window whose file is gone from the server would otherwise reload the page
 * every minute for as long as it sat quiet.
 */
import { CHUNK_RECOVERY_MIN_INTERVAL_MS } from './chunkLoadRecovery'

/** sessionStorage key: when this tab last tried the cure. It outlives the reload the cure may start. */
export const WINDOW_CURE_KEY = 'pipetooling-window-cure-last'

/** Never two cures inside this gap. The reload empties the caches, and the precache is tens of megabytes. */
export const WINDOW_CURE_MIN_GAP_MS = 10 * 60_000

/** A held cure looks again this often. Nothing tells it when a field is cleared or a window closes. */
export const WINDOW_CURE_LOOK_AGAIN_MS = 15_000

/** After an ask nothing answered, the wait before the next one. */
export const WINDOW_CURE_NO_ANSWER_MS = 60_000

export type WindowCureSnapshot = {
  /** Windows this page failed to load and has not loaded since (`lostWindowCount`). */
  lostWindows: number
  /** The browser's own word that there is no network. Its `online` event wakes the cure. */
  browserOffline: boolean
  /** Drawn inside an iframe (Settings → What customers see): the top window owns reloads. */
  framed: boolean
  /** Time since this tab last tried the cure, null when it never did. */
  msSinceLastCure: number | null
  /** Time since the last automatic recovery reload, null when there was none. Inside its minute a new one is refused. */
  msSinceLastRecovery: number | null
  /** The page holds words someone typed and has not sent. */
  typedText: boolean
  /** The cursor is in a field: someone is about to type. */
  editableFocused: boolean
  /** A window is open over the page. */
  dialogOpen: boolean
  /** Components holding unsaved work (`useHoldsUnsavedWork`). */
  unsavedHolds: number
  /** Writes still waiting for their answer. */
  inFlightWrites: number
}

export type WindowCure =
  /** Nothing to do, and no reason to look again until something changes. */
  | { act: 'none'; reason: string }
  /** Held. Look again in `lookAgainInMs`, or sooner when something changes. */
  | { act: 'wait'; reason: string; lookAgainInMs: number }
  /** Quiet and online by the browser's word: ask the network, and cure on its answer. */
  | { act: 'ask'; reason: string }

const hold = (reason: string): WindowCure => ({ act: 'wait', reason, lookAgainInMs: WINDOW_CURE_LOOK_AGAIN_MS })

/**
 * May the page cure its lost windows now? Asked when a window is lost, when the browser says the signal is
 * back, when the tab is looked at again, and again after every hold. The same question is asked a second
 * time when the network has answered, since the ask can take five seconds and someone may have typed.
 */
export function decideWindowCure(s: WindowCureSnapshot): WindowCure {
  if (s.lostWindows <= 0) return { act: 'none', reason: 'no window is lost' }
  if (s.framed) return { act: 'none', reason: 'framed: the top window owns reloads' }
  if (s.msSinceLastCure != null && s.msSinceLastCure < WINDOW_CURE_MIN_GAP_MS) {
    return { act: 'none', reason: 'the cure was tried less than ten minutes ago' }
  }
  if (s.browserOffline) return { act: 'none', reason: 'the browser says it is offline' }
  // Words first: they are the one thing a reload cannot give back.
  if (s.typedText) return hold('words typed on the page')
  if (s.unsavedHolds > 0) return hold(`${s.unsavedHolds} component(s) hold unsaved work`)
  if (s.inFlightWrites > 0) return hold(`${s.inFlightWrites} write(s) in flight`)
  if (s.editableFocused) return hold('a field is focused')
  if (s.dialogOpen) return hold('a window is open')
  if (s.msSinceLastRecovery != null && s.msSinceLastRecovery < CHUNK_RECOVERY_MIN_INTERVAL_MS) {
    return {
      act: 'wait',
      reason: 'a recovery reload ran less than a minute ago',
      lookAgainInMs: CHUNK_RECOVERY_MIN_INTERVAL_MS - s.msSinceLastRecovery + 500,
    }
  }
  return { act: 'ask', reason: 'a window is lost, the page is quiet' }
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

/** Time since this tab last tried the cure, null when it never did or the storage cannot be read. */
export function msSinceWindowCure(now: number, storage: Pick<Storage, 'getItem'> | null | undefined): number | null {
  try {
    const last = Number.parseInt(storage?.getItem(WINDOW_CURE_KEY) ?? '', 10)
    return Number.isFinite(last) ? now - last : null
  } catch {
    return null
  }
}

/** Writes down that the cure is being tried now. A storage that refuses is let be: the recovery's own guard still holds. */
export function stampWindowCure(now: number, storage: StorageLike | null | undefined): void {
  try {
    storage?.setItem(WINDOW_CURE_KEY, String(now))
  } catch {
    // private mode or a full quota
  }
}
