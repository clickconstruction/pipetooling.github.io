/** The line a forced sign-out leaves for the sign-in page: left once, taken once, never a throw. */
import { describe, expect, it } from 'vitest'
import { SIGN_IN_NOTICE_STORAGE_KEY, leaveSignInNotice, takeSignInNotice } from './signInNotice'

function memoryStore() {
  const rows = new Map<string, string>()
  return {
    rows,
    getItem: (k: string) => rows.get(k) ?? null,
    setItem: (k: string, v: string) => void rows.set(k, v),
    removeItem: (k: string) => void rows.delete(k),
  }
}

describe('the sign-in notice', () => {
  it('is taken once: the second read finds nothing', () => {
    const store = memoryStore()
    leaveSignInNotice('Sign in again.', store)
    expect(store.rows.get(SIGN_IN_NOTICE_STORAGE_KEY)).toBe('Sign in again.')
    expect(takeSignInNotice(store)).toBe('Sign in again.')
    expect(takeSignInNotice(store)).toBeNull()
  })

  it('reads nothing when nobody left a line', () => {
    expect(takeSignInNotice(memoryStore())).toBeNull()
  })

  it('keeps the key the session-expiry sign-out has always written', () => {
    expect(SIGN_IN_NOTICE_STORAGE_KEY).toBe('auth_error_message')
  })

  it('never throws when the browser refuses storage', () => {
    const refusing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(() => leaveSignInNotice('Sign in again.', refusing)).not.toThrow()
    expect(takeSignInNotice(refusing)).toBeNull()
    expect(() => leaveSignInNotice('Sign in again.', null)).not.toThrow()
    expect(takeSignInNotice(null)).toBeNull()
  })
})
