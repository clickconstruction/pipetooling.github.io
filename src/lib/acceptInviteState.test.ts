import { describe, expect, it } from 'vitest'
import {
  ACCEPT_INVITE_PENDING_KEY,
  clearInvitePending,
  markInvitePendingFromHash,
  parseAcceptInviteHash,
  readInvitePending,
  resolveAcceptInviteState,
  type StorageLike,
} from './acceptInviteState'

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { store: Record<string, string> } {
  const store = { ...initial }
  return {
    store,
    getItem: (k) => (k in store ? store[k] ?? null : null),
    setItem: (k, v) => {
      store[k] = v
    },
    removeItem: (k) => {
      delete store[k]
    },
  }
}

const INVITE_HASH = '#access_token=abc&expires_in=3600&refresh_token=r1&token_type=bearer&type=invite'
const ERROR_HASH = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'

describe('parseAcceptInviteHash', () => {
  it('recognises the invite link the invite email sends', () => {
    expect(parseAcceptInviteHash(INVITE_HASH)).toEqual({
      inviteHashPresent: true,
      errorHash: false,
      accessToken: 'abc',
      refreshToken: 'r1',
      type: 'invite',
    })
  })

  it('treats type=signup as an invite too, with or without the leading #', () => {
    expect(parseAcceptInviteHash('access_token=abc&type=signup').inviteHashPresent).toBe(true)
    expect(parseAcceptInviteHash('#access_token=abc&type=signup').inviteHashPresent).toBe(true)
  })

  it('does not arm on other token types or on a type with no token', () => {
    expect(parseAcceptInviteHash('#access_token=abc&type=recovery').inviteHashPresent).toBe(false)
    expect(parseAcceptInviteHash('#access_token=abc&type=magiclink').inviteHashPresent).toBe(false)
    expect(parseAcceptInviteHash('#type=invite').inviteHashPresent).toBe(false)
  })

  it('recognises the dead/used-link redirect', () => {
    const parsed = parseAcceptInviteHash(ERROR_HASH)
    expect(parsed.errorHash).toBe(true)
    expect(parsed.inviteHashPresent).toBe(false)
    expect(parseAcceptInviteHash('#error=access_denied').errorHash).toBe(true)
    expect(parseAcceptInviteHash('#error_code=otp_expired').errorHash).toBe(true)
  })

  it('is inert on an empty hash', () => {
    expect(parseAcceptInviteHash('')).toEqual({
      inviteHashPresent: false,
      errorHash: false,
      accessToken: null,
      refreshToken: null,
      type: null,
    })
    expect(parseAcceptInviteHash('#')).toMatchObject({ inviteHashPresent: false, errorHash: false })
  })
})

describe('resolveAcceptInviteState', () => {
  const base = { hasSession: null, inviteHashPresent: false, pendingInviteFlag: false, errorHash: false } as const

  it('error hash + no flag → invalid-link regardless of session', () => {
    expect(resolveAcceptInviteState({ ...base, errorHash: true, hasSession: null })).toBe('invalid-link')
    expect(resolveAcceptInviteState({ ...base, errorHash: true, hasSession: true })).toBe('invalid-link')
    expect(resolveAcceptInviteState({ ...base, errorHash: true, hasSession: false })).toBe('invalid-link')
  })

  it('error hash + flag: the live invite session may still set its password (J24-N3)', () => {
    expect(resolveAcceptInviteState({ ...base, errorHash: true, pendingInviteFlag: true, hasSession: null })).toBe('loading')
    expect(resolveAcceptInviteState({ ...base, errorHash: true, pendingInviteFlag: true, hasSession: true })).toBe('set-password')
    expect(resolveAcceptInviteState({ ...base, errorHash: true, pendingInviteFlag: true, hasSession: false })).toBe('invalid-link')
  })

  it('waits while the session check runs', () => {
    expect(resolveAcceptInviteState({ ...base, hasSession: null })).toBe('loading')
    expect(resolveAcceptInviteState({ ...base, hasSession: null, inviteHashPresent: true })).toBe('loading')
    expect(resolveAcceptInviteState({ ...base, hasSession: null, pendingInviteFlag: true })).toBe('loading')
  })

  it('no session → invalid-link, with or without invite evidence', () => {
    expect(resolveAcceptInviteState({ ...base, hasSession: false })).toBe('invalid-link')
    expect(resolveAcceptInviteState({ ...base, hasSession: false, inviteHashPresent: true })).toBe('invalid-link')
    expect(resolveAcceptInviteState({ ...base, hasSession: false, pendingInviteFlag: true })).toBe('invalid-link')
  })

  it('invite hash + session → set-password (the genuine first open)', () => {
    expect(resolveAcceptInviteState({ ...base, hasSession: true, inviteHashPresent: true })).toBe('set-password')
    expect(resolveAcceptInviteState({ ...base, hasSession: true, inviteHashPresent: true, pendingInviteFlag: true })).toBe('set-password')
  })

  it('no hash + flag + session → set-password (hash already consumed by supabase-js)', () => {
    expect(resolveAcceptInviteState({ ...base, hasSession: true, pendingInviteFlag: true })).toBe('set-password')
  })

  it('no hash + no flag + session → already-set-up (J24-F1: the bare-URL revisit never arms)', () => {
    expect(resolveAcceptInviteState({ ...base, hasSession: true })).toBe('already-set-up')
  })
})

describe('pending-invite flag helpers', () => {
  it('marks only on an invite hash', () => {
    const s = memoryStorage()
    expect(markInvitePendingFromHash('', s)).toBe(false)
    expect(markInvitePendingFromHash(ERROR_HASH, s)).toBe(false)
    expect(markInvitePendingFromHash('#access_token=abc&type=recovery', s)).toBe(false)
    expect(readInvitePending(s)).toBe(false)
    expect(markInvitePendingFromHash(INVITE_HASH, s)).toBe(true)
    expect(s.store[ACCEPT_INVITE_PENDING_KEY]).toBe('1')
    expect(readInvitePending(s)).toBe(true)
  })

  it('clears', () => {
    const s = memoryStorage({ [ACCEPT_INVITE_PENDING_KEY]: '1' })
    clearInvitePending(s)
    expect(readInvitePending(s)).toBe(false)
  })

  it('is safe with no storage and with a throwing storage', () => {
    expect(markInvitePendingFromHash(INVITE_HASH, null)).toBe(false)
    expect(readInvitePending(null)).toBe(false)
    expect(() => clearInvitePending(null)).not.toThrow()
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
    }
    expect(markInvitePendingFromHash(INVITE_HASH, throwing)).toBe(false)
    expect(readInvitePending(throwing)).toBe(false)
    expect(() => clearInvitePending(throwing)).not.toThrow()
  })
})
