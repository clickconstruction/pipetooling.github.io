import { describe, expect, it } from 'vitest'
import { OFFLINE_ERROR_MESSAGE } from './networkErrorMessage'
import { DatabaseError, OperationTimeoutError } from '../utils/errorHandling'
import {
  BACK_ONLINE_AUTO_MESSAGE,
  BACK_ONLINE_MESSAGE,
  OFFLINE_AUTO_RETRY_CAP,
  offlineRecoveryState,
  recoveryFailureFromError,
  STILL_OFFLINE_SUFFIX,
} from './offlineRecoveryState'

const NETWORK = { kind: 'network' as const, message: OFFLINE_ERROR_MESSAGE }
const REFUSED = { kind: 'server' as const, message: "You don't have permission to clock in." }

describe('offlineRecoveryState', () => {
  it('is idle with no error', () => {
    const s = offlineRecoveryState({ online: true, lastError: null, attempts: 0 })
    expect(s).toEqual({ phase: 'idle', message: '', showRetry: false, retryLabel: 'Retry', autoRetry: false })
  })

  it('offline + network failure: the offline copy with a Retry button, never automatic', () => {
    const s = offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 0, idempotent: true })
    expect(s.phase).toBe('offline')
    expect(s.message).toBe(OFFLINE_ERROR_MESSAGE)
    expect(s.showRetry).toBe(true)
    expect(s.autoRetry).toBe(false)
  })

  it('a second failure while still offline says so', () => {
    const s = offlineRecoveryState({ online: false, lastError: NETWORK, attempts: 2 })
    expect(s.message).toBe(`${OFFLINE_ERROR_MESSAGE}${STILL_OFFLINE_SUFFIX}`)
  })

  it('browser says online but no online event arrived since the failure: still the offline copy + Retry', () => {
    const s = offlineRecoveryState({ online: true, lastError: NETWORK, attempts: 0, idempotent: true })
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

  it('a message override never changes the class', () => {
    const f = recoveryFailureFromError(new TypeError('Failed to fetch'), 'x', 'custom')
    expect(f).toEqual({ kind: 'network', message: 'custom' })
  })
})
