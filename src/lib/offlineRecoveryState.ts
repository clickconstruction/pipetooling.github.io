import {
  errorKindOf,
  formatErrorMessage,
  formatPostgrestOrUnknownError,
  type DatabaseErrorKind,
} from '../utils/errorHandling'
import { OFFLINE_ERROR_MESSAGE } from './networkErrorMessage'

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
 * a refused write or a broken link does not heal by trying again. Auto-retry is
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
}

export type OfflineRecoveryInput = {
  /** `navigator.onLine` (true when the browser does not know — it only ever proves offline). */
  online: boolean
  lastError: OfflineRecoveryLastError | null
  /** Retries already made for this failure (0 on the first failure). */
  attempts: number
  /** An `online` event arrived AFTER this failure — the signal actually came back, not merely "the browser says online". */
  reconnected?: boolean
  /** Re-running the action is safe (a read). Writes must leave `false` (the default). */
  idempotent?: boolean
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
export const STILL_OFFLINE_SUFFIX = ' Still no connection.'

export function offlineRecoveryState(input: OfflineRecoveryInput): OfflineRecoveryState {
  const { online, lastError, attempts } = input
  const idempotent = input.idempotent === true
  const reconnected = input.reconnected === true
  if (!lastError) return { phase: 'idle', message: '', showRetry: false, retryLabel: 'Retry', autoRetry: false }
  if (lastError.kind !== 'network') {
    return { phase: 'failed', message: lastError.message, showRetry: false, retryLabel: 'Retry', autoRetry: false }
  }
  // The browser flag only ever proves offline; a fetch that failed while the
  // flag said "online" (dead wifi, unreachable server) is still offline until
  // an `online` event says the signal came back.
  if (!online || !reconnected) {
    return {
      phase: 'offline',
      message: attempts > 0 ? `${OFFLINE_ERROR_MESSAGE}${STILL_OFFLINE_SUFFIX}` : OFFLINE_ERROR_MESSAGE,
      showRetry: true,
      retryLabel: 'Retry',
      autoRetry: false,
    }
  }
  const autoRetry = idempotent && attempts < OFFLINE_AUTO_RETRY_CAP
  return {
    phase: 'back-online',
    message: autoRetry ? BACK_ONLINE_AUTO_MESSAGE : attempts > 0 ? `${BACK_ONLINE_MESSAGE}${STILL_OFFLINE_SUFFIX}` : BACK_ONLINE_MESSAGE,
    showRetry: true,
    retryLabel: 'Retry',
    autoRetry,
  }
}

/**
 * Build the panel's `lastError` from a thrown value: class by
 * `errorKindOf` (never message text), sentence by `formatErrorMessage`.
 * Callers with bespoke copy (the clock punch's "may or may not have saved"
 * timeout sentence) pass `message` to keep it.
 */
export function recoveryFailureFromError(
  error: unknown,
  fallbackMessage: string,
  message?: string,
): OfflineRecoveryLastError {
  const kind = errorKindOf(error)
  if (message != null) return { kind, message }
  // A direct supabase call rejects with a plain PostgrestError object, which
  // `formatErrorMessage` cannot read — the PostgREST formatter can.
  const isPlainErrorObject = error != null && typeof error === 'object' && !(error instanceof Error)
  return {
    kind,
    message: isPlainErrorObject
      ? formatPostgrestOrUnknownError(error, fallbackMessage)
      : formatErrorMessage(error, fallbackMessage),
  }
}
