import { errorKindOf, formatErrorMessage, isAuthLockStolenError, type DatabaseErrorKind } from '../utils/errorHandling'
import { OFFLINE_ERROR_MESSAGE } from './networkErrorMessage'

/**
 * The same lost signal on a read (punch list #224). A read saved nothing, so
 * the write sentence's *nothing was saved* is wrong for it, and on a crew
 * screen it can sit beside a press kept on the phone and seem to say the press
 * failed (#163's live test, 2026-10-30). `offlineRecoveryState` draws this one
 * for an `idempotent` panel instead; the words follow `plainWords.ts` and say
 * the read runs again by itself, which the panel does on the `online` event.
 * It lives here, not beside `OFFLINE_ERROR_MESSAGE`, because `networkErrorMessage.ts`
 * is copied into the edge functions' kernels and only the client draws this one.
 */
export const OFFLINE_READ_MESSAGE = 'No connection, so this could not load. Nothing was lost. It loads again when the signal is back.'

/**
 * Offline recovery state (J2-F3, journey-map Tier-1 #6b).
 *
 * The genuine offline path used to render "No connection … Check your signal
 * and try again." as a bare paragraph: the copy said "try again" and offered
 * no way to, and nothing listened for the signal coming back — the tab stayed
 * dead until the tech bounced to another tab (`visibilitychange` refetches on
 * phone unlock, but a continuously visible tab never recovers).
 *
 * This kernel turns (browser online flag, last error's class, attempts so far)
 * into what the panel shows. Only a `network`-kind error (the fetch layer never
 * reached the server — v2.2843's class, never message text) gets the offline
 * treatment; any other failure renders its own sentence with no Retry, because
 * a refused write or a broken link does not heal by trying again. The one
 * exception is a request that was never sent (`neverSent`, punch list #406): the
 * sign-in lock was taken first, its words end *Try again*, and it gets a Retry
 * with no offline words. Auto-retry is
 * offered ONLY for idempotent actions (reads): a clock punch or a report
 * submit that failed at the fetch layer never reached the server, but the
 * person should still be the one who re-sends it.
 */

export type OfflineRecoveryPhase =
  /** No error to recover from. */
  | 'idle'
  /** The last attempt failed at the network layer and the browser still reports offline (or does not know). */
  | 'offline'
  /** The last attempt failed at the network layer and the signal has since come back (an `online` event). */
  | 'back-online'
  /** The last attempt failed for a non-network reason — shown as-is, no Retry. */
  | 'failed'

export type OfflineRecoveryLastError = {
  kind: DatabaseErrorKind
  /** The already-formatted, user-facing sentence (from `formatErrorMessage`). */
  message: string
  /**
   * The request never left this device: the sign-in lock was taken before it was sent
   * (`isAuthLockStolenError`). Sending it again is safe, so the panel offers Retry. It is not a lost
   * signal, so the kind stays what `errorKindOf` says and no offline words are drawn.
   */
  neverSent?: boolean
}

export type OfflineRecoveryInput = {
  /** `navigator.onLine` (true when the browser does not know — it only ever proves offline). */
  online: boolean
  lastError: OfflineRecoveryLastError | null
  /** Retries already made for this failure (0 on the first failure). */
  attempts: number
  /** An `online` event arrived AFTER this failure — the signal actually came back, not merely "the browser says online". */
  reconnected?: boolean
  /**
   * Re-running the action is safe (a read). Writes must leave `false` (the default). A read's lost signal
   * reads `OFFLINE_READ_MESSAGE` (punch list #224), never the write sentence's *nothing was saved*.
   */
  idempotent?: boolean
  /**
   * A caller's own words for a lost signal, in place of the shared sentence for its kind: the clock's
   * (v2.6198, where the write sentence under a press kept on the phone read as the press failing).
   */
  offlineMessage?: string
  /**
   * The automatic try for this return of the signal was made, and `AUTO_TRY_WAIT_MS` later the failure still stands
   * (finding 308, a walk of 2026-11-27: the line read *trying again…* for 17 seconds with nothing being tried). The
   * line then stops saying it is trying and hands the press back. A new return of the signal is a new try.
   */
  autoTrySpent?: boolean
}

export type OfflineRecoveryState = {
  phase: OfflineRecoveryPhase
  /** The sentence to render; `''` when idle. */
  message: string
  /** Whether a Retry control renders at all. */
  showRetry: boolean
  /** Label for that control. */
  retryLabel: string
  /** Fire the retry without a tap: the signal came back AND idempotent AND under the auto-retry cap. */
  autoRetry: boolean
}

/** Auto-retries stop after this many so a flapping connection cannot loop a read forever. */
export const OFFLINE_AUTO_RETRY_CAP = 3

export const BACK_ONLINE_MESSAGE = 'Back online — tap Retry to try again.'
export const BACK_ONLINE_AUTO_MESSAGE = 'Back online — trying again…'
/** After the automatic try did not land: the line no longer says it is trying. */
export const BACK_ONLINE_TRIED_MESSAGE = 'Back online, but this did not load. Tap Retry to try again.'
/** How long the line says *trying again…* after an automatic try, before it hands the press back. */
export const AUTO_TRY_WAIT_MS = 8000
export const STILL_OFFLINE_SUFFIX = ' Still no connection.'

export function offlineRecoveryState(input: OfflineRecoveryInput): OfflineRecoveryState {
  const { online, lastError, attempts } = input
  const idempotent = input.idempotent === true
  const reconnected = input.reconnected === true
  if (!lastError) return { phase: 'idle', message: '', showRetry: false, retryLabel: 'Retry', autoRetry: false }
  if (lastError.kind !== 'network') {
    // A request that was never sent gets its Retry. It does not run again by itself: the words draw only after
    // the caller's own retries ran out, and a read that clears its error as it starts would loop on a held lock.
    return { phase: 'failed', message: lastError.message, showRetry: lastError.neverSent === true, retryLabel: 'Retry', autoRetry: false }
  }
  // The browser flag only ever proves offline; a fetch that failed while the
  // flag said "online" (dead wifi, unreachable server) is still offline until
  // an `online` event says the signal came back.
  if (!online || !reconnected) {
    // A read saved nothing, so it never says *nothing was saved* (#224); a caller's own words still win.
    const offline = input.offlineMessage ?? (idempotent ? OFFLINE_READ_MESSAGE : OFFLINE_ERROR_MESSAGE)
    return {
      phase: 'offline',
      message: attempts > 0 ? `${offline}${STILL_OFFLINE_SUFFIX}` : offline,
      showRetry: true,
      retryLabel: 'Retry',
      autoRetry: false,
    }
  }
  const spent = input.autoTrySpent === true
  const autoRetry = idempotent && attempts < OFFLINE_AUTO_RETRY_CAP && !spent
  return {
    phase: 'back-online',
    message: autoRetry ? BACK_ONLINE_AUTO_MESSAGE : spent ? BACK_ONLINE_TRIED_MESSAGE : attempts > 0 ? `${BACK_ONLINE_MESSAGE}${STILL_OFFLINE_SUFFIX}` : BACK_ONLINE_MESSAGE,
    showRetry: true,
    retryLabel: 'Retry',
    autoRetry,
  }
}

/**
 * Build the panel's `lastError` from a thrown value: class by
 * `errorKindOf` (never message text), sentence by `formatErrorMessage`.
 * A direct supabase call's plain result error reads by its code too, with
 * the caller's own sentence leading (v2.5935): *Couldn't load your requests.
 * You don't have access to this record.*, one line for the panel's
 * paragraph. Callers with bespoke copy (the clock punch's "may or may not
 * have saved" timeout sentence) pass `message` to keep it.
 */
export function recoveryFailureFromError(
  error: unknown,
  fallbackMessage: string,
  message?: string,
): OfflineRecoveryLastError {
  const kind = errorKindOf(error)
  const neverSent = isAuthLockStolenError(error) ? { neverSent: true as const } : {}
  if (message != null) return { kind, message, ...neverSent }
  return { kind, message: formatErrorMessage(error, fallbackMessage), ...neverSent }
}
