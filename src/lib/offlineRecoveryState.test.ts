import { describe, expect, it } from 'vitest'
import { OFFLINE_ERROR_MESSAGE } from './networkErrorMessage'
import { plainWordsFailures } from './plainWords'
import { AUTH_LOCK_ERROR_MESSAGE, DatabaseError, OperationTimeoutError } from '../utils/errorHandling'
import {
  AUTO_TRY_WAIT_MS,
  BACK_ONLINE_AUTO_MESSAGE,
  BACK_ONLINE_TRIED_MESSAGE,
  BACK_ONLINE_MESSAGE,
  OFFLINE_AUTO_RETRY_CAP,
  offlineRecoveryState,
  recoveryFailureFromError,
  STILL_OFFLINE_SUFFIX,
  OFFLINE_READ_MESSAGE,
} from './offlineRecoveryState'

const NETWORK = { kind: 'network' as const, message: OFFLINE_ERROR_MESSAGE }
const REFUSED = { kind: 'server' as const, message: "You don't have permission to clock in." }

describe('offlineRecoveryState', () => {
  it('the read sentence (punch list #224) says No connection in plain words, never that something was saved, and that it loads again', () => {
    expect(OFFLINE_READ_MESSAGE).toMatch(/^No connection/)
    expect(OFFLINE_READ_MESSAGE).not.toMatch(/TypeError|fetch|saved/i)
    expect(OFFLINE_READ_MESSAGE).toMatch(/loads again/)
    expect(OFFLINE_READ_MESSAGE).not.toBe(OFFLINE_ERROR_MESSAGE)
    expect(plainWordsFailures(OFFLINE_READ_MESSAGE)).toEqual([])
  })

  it('is idle with no error', () => {
    const s = offlineRecoveryState({ online: true, lastError: null, attempts: 0 })
    expect(s).toEqual({ phase: 'idle', message: '', showRetry: false, retryLabel: 'Retry', autoRetry: false })
  })

  it('offline + network failure: the offline copy with a Retry button, never automatic', () => {
    const s = offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 0 })
    expect(s.phase).toBe('offline')
    expect(s.message).toBe(OFFLINE_ERROR_MESSAGE)
    expect(s.showRetry).toBe(true)
    expect(s.autoRetry).toBe(false)
  })

  it('a read (idempotent) says the read sentence, never nothing was saved; a write keeps the write sentence (punch list #224)', () => {
    const read = offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 0, idempotent: true })
    expect(read.phase).toBe('offline')
    expect(read.message).toBe(OFFLINE_READ_MESSAGE)
    expect(read.message).not.toMatch(/saved/i)
    expect(read.showRetry).toBe(true)
    expect(read.autoRetry).toBe(false)
    // A second failure while still offline says so, on the read sentence.
    expect(offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 1, idempotent: true }).message).toBe(`${OFFLINE_READ_MESSAGE}${STILL_OFFLINE_SUFFIX}`)
    // The browser flag alone never flips a read either.
    expect(offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, idempotent: true }).message).toBe(OFFLINE_READ_MESSAGE)
    // A write, with or without the flag, keeps the write sentence: the person re-sends it.
    expect(offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 0 }).message).toBe(OFFLINE_ERROR_MESSAGE)
    expect(offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, idempotent: false }).message).toBe(OFFLINE_ERROR_MESSAGE)
    // Back online reads as before for both.
    expect(offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, idempotent: true, reconnected: true }).message).toBe(BACK_ONLINE_AUTO_MESSAGE)
    expect(offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, reconnected: true }).message).toBe(BACK_ONLINE_MESSAGE)
    // A refusal on a read keeps its own sentence with no Retry.
    const refused = offlineRecoveryState({ online: false, lastError: REFUSED, attempts: 0, idempotent: true })
    expect(refused.message).toBe(REFUSED.message)
    expect(refused.showRetry).toBe(false)
  })

  it('a second failure while still offline says so', () => {
    const s = offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 2 })
    expect(s.message).toBe(`${OFFLINE_ERROR_MESSAGE}${STILL_OFFLINE_SUFFIX}`)
  })

  it('browser says online but no online event arrived since the failure: still the offline copy + Retry', () => {
    const s = offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0 })
    expect(s.phase).toBe('offline')
    expect(s.message).toBe(OFFLINE_ERROR_MESSAGE)
    expect(s.showRetry).toBe(true)
    expect(s.autoRetry).toBe(false)
  })

  it('back online + write (not idempotent): "Back online" with Retry left to the button', () => {
    const s = offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, reconnected: true })
    expect(s.phase).toBe('back-online')
    expect(s.message).toBe(BACK_ONLINE_MESSAGE)
    expect(s.showRetry).toBe(true)
    expect(s.autoRetry).toBe(false)
  })

  it('back online, the automatic try spent: the line stops saying it is trying and hands the press back (finding 308)', () => {
    const spent = offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 1, idempotent: true, reconnected: true, autoTrySpent: true })
    expect(spent.phase).toBe('back-online')
    expect(spent.message).toBe(BACK_ONLINE_TRIED_MESSAGE)
    expect(spent.message).not.toContain('trying')
    expect(spent.showRetry).toBe(true)
    // No second try by itself for the same return of the signal.
    expect(spent.autoRetry).toBe(false)
    // Not spent, it still tries by itself and says so.
    const trying = offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 1, idempotent: true, reconnected: true, autoTrySpent: false })
    expect(trying.autoRetry).toBe(true)
    expect(trying.message).toBe(BACK_ONLINE_AUTO_MESSAGE)
    // A write never tried by itself, so nothing of its line changes.
    expect(offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, reconnected: true, autoTrySpent: false }).message).toBe(BACK_ONLINE_MESSAGE)
    expect(AUTO_TRY_WAIT_MS).toBe(8000)
  })

  it('back online + idempotent read: retries by itself, up to the cap', () => {
    const first = offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, idempotent: true, reconnected: true })
    expect(first.autoRetry).toBe(true)
    expect(first.message).toBe(BACK_ONLINE_AUTO_MESSAGE)
    const capped = offlineRecoveryState({
      online: true,
      lastError: NETWORK,
      attempts: OFFLINE_AUTO_RETRY_CAP,
      idempotent: true,
      reconnected: true,
    })
    expect(capped.autoRetry).toBe(false)
    expect(capped.showRetry).toBe(true)
    expect(capped.message).toBe(`${BACK_ONLINE_MESSAGE}${STILL_OFFLINE_SUFFIX}`)
  })

  it('a server refusal renders its own sentence with no Retry, online or not', () => {
    for (const online of [true, false]) {
      const s = offlineRecoveryState({ online, lastError: REFUSED, attempts: 0, idempotent: true, reconnected: true })
      expect(s.phase).toBe('failed')
      expect(s.message).toBe(REFUSED.message)
      expect(s.showRetry).toBe(false)
      expect(s.autoRetry).toBe(false)
    }
  })

  it('an unknown-class failure is not offered a Retry either', () => {
    const s = offlineRecoveryState({ online: false, lastError: { kind: 'unknown', message: 'boom' }, attempts: 0 })
    expect(s.phase).toBe('failed')
    expect(s.showRetry).toBe(false)
  })

  it('a request that was never sent is offered a Retry, with its own words and no offline copy (punch list #406)', () => {
    const lock = { kind: 'unknown' as const, message: AUTH_LOCK_ERROR_MESSAGE, neverSent: true }
    for (const online of [true, false]) {
      for (const idempotent of [true, false]) {
        const s = offlineRecoveryState({ online, lastError: lock, attempts: 0, idempotent, reconnected: true })
        expect(s.phase).toBe('failed')
        expect(s.message).toBe(AUTH_LOCK_ERROR_MESSAGE)
        expect(s.showRetry).toBe(true)
        expect(s.retryLabel).toBe('Retry')
        // Never by itself: the caller's own retries ran out before these words drew.
        expect(s.autoRetry).toBe(false)
      }
    }
    // The second press is offered too.
    expect(offlineRecoveryState({ online: true, lastError: lock, attempts: 3, idempotent: true }).showRetry).toBe(true)
  })

  it('a read may say a lost signal in its own words, which win over the shared read sentence; Back online reads as before (v2.6198)', () => {
    const words = 'No connection, so the clock could not load. It loads again when the signal is back.'
    const first = offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 0, idempotent: true, offlineMessage: words })
    expect(first.phase).toBe('offline')
    expect(first.message).toBe(words)
    expect(first.message).not.toBe(OFFLINE_READ_MESSAGE)
    expect(first.showRetry).toBe(true)
    expect(offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 1, idempotent: true, offlineMessage: words }).message).toBe(`${words}${STILL_OFFLINE_SUFFIX}`)
    expect(offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, idempotent: true, reconnected: true, offlineMessage: words }).message).toBe(BACK_ONLINE_AUTO_MESSAGE)
    // A refusal keeps its own sentence.
    expect(offlineRecoveryState({ online: false, lastError: REFUSED, attempts: 0, idempotent: true, offlineMessage: words }).message).toBe(REFUSED.message)
  })
})

describe('recoveryFailureFromError', () => {
  it('classifies by class: a fetch-layer TypeError is network and renders the offline copy', () => {
    const f = recoveryFailureFromError(new TypeError('Failed to fetch'), 'Failed to clock in')
    expect(f).toEqual({ kind: 'network', message: OFFLINE_ERROR_MESSAGE })
  })

  it('a PostgREST result error from a direct insert (no code, fetch signature) is network', () => {
    const f = recoveryFailureFromError(
      { message: 'TypeError: Load failed', details: '', hint: '', code: '' },
      'Could not save the report',
    )
    expect(f.kind).toBe('network')
    expect(f.message).toBe(OFFLINE_ERROR_MESSAGE)
  })

  it('a coded refusal is server, and reads as a refusal (never "check your signal")', () => {
    const f = recoveryFailureFromError(
      new DatabaseError('Failed to clock in: permission denied', '42501', undefined, {
        operationName: 'clock in',
        serverMessage: 'permission denied',
        status: 403,
      }),
      'Failed to clock in',
    )
    expect(f.kind).toBe('server')
    expect(f.message).toBe("You don't have permission to clock in.")
  })

  it('a timeout keeps the caller\'s "may or may not have saved" copy and is not network', () => {
    const f = recoveryFailureFromError(
      new OperationTimeoutError('Clock in', 15000),
      'Failed to clock in',
      'The server is not responding. Your clock-in may or may not have saved.',
    )
    expect(f.kind).toBe('unknown')
    expect(f.message).toBe('The server is not responding. Your clock-in may or may not have saved.')
  })

  it('a plain result error with a code reads by its code, the screen\'s sentence first, on one line', () => {
    const refused = recoveryFailureFromError(
      { message: 'permission denied for table dispatch_requests', code: '42501', details: null, hint: null },
      "Couldn't load your requests",
    )
    expect(refused).toEqual({ kind: 'server', message: "Couldn't load your requests. You don't have access to this record." })
    const other = recoveryFailureFromError(
      { message: 'canceling statement due to statement timeout', code: '57014', details: null, hint: null },
      "Couldn't load your requests",
    )
    expect(other).toEqual({ kind: 'server', message: "Couldn't load your requests: canceling statement due to statement timeout" })
    expect(other.message).not.toContain('Code:')
  })

  it('a message override never changes the class', () => {
    const f = recoveryFailureFromError(new TypeError('Failed to fetch'), 'x', 'custom')
    expect(f).toEqual({ kind: 'network', message: 'custom' })
  })

  it('a stolen sign-in lock is marked never sent, keeps its class and reads in plain words (punch list #406)', () => {
    // As supabase-js hands it back from a result: a plain object, the thrown error written as name and message.
    const asResult = recoveryFailureFromError({ message: 'AbortError: Lock was stolen by another request', details: '', hint: '', code: '' }, 'The boxes on this job did not load.')
    expect(asResult).toEqual({ kind: 'unknown', message: AUTH_LOCK_ERROR_MESSAGE, neverSent: true })
    // As Chrome throws it.
    const thrown = recoveryFailureFromError(Object.assign(new Error("Lock broken by another request with the 'steal' option."), { name: 'AbortError' }), 'x')
    expect(thrown.neverSent).toBe(true)
    expect(thrown.message).toBe(AUTH_LOCK_ERROR_MESSAGE)
    expect(offlineRecoveryState({ online: true, lastError: asResult, attempts: 0, idempotent: true }).showRetry).toBe(true)
    // A caller's own words do not hide that it was never sent.
    expect(recoveryFailureFromError({ message: 'AbortError: Lock was stolen by another request' }, 'x', 'custom')).toEqual({ kind: 'unknown', message: 'custom', neverSent: true })
  })

  it('no other failure is marked never sent: a refusal, a lost signal, a plain abort', () => {
    expect('neverSent' in recoveryFailureFromError({ message: 'permission denied', code: '42501' }, 'x')).toBe(false)
    expect('neverSent' in recoveryFailureFromError(new TypeError('Failed to fetch'), 'x')).toBe(false)
    expect('neverSent' in recoveryFailureFromError(Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' }), 'x')).toBe(false)
  })
})
