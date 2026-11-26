import { describe, expect, it } from 'vitest'
import { googleAddressDiffers, googleWay, parseLoginWays, unlinkGoogleQuestion } from './loginWays'

describe("a login's ways in", () => {
  it('reads a login with a password and Google', () => {
    const ways = parseLoginWays({
      has_login: true,
      has_password: true,
      ways: [
        { provider: 'email', email: 'zz.test.estimator@example.com', last_sign_in_at: '2026-11-20T15:00:00Z', linked_at: '2026-10-01T12:00:00Z' },
        { provider: 'google', email: 'zz.test.estimator@example.com', last_sign_in_at: '2026-11-26T15:00:00Z', linked_at: '2026-11-26T14:00:00Z' },
      ],
    })
    expect(ways.hasLogin).toBe(true)
    expect(ways.hasPassword).toBe(true)
    expect(googleWay(ways)).toEqual({ provider: 'google', email: 'zz.test.estimator@example.com', lastSignInAt: '2026-11-26T15:00:00Z', linkedAt: '2026-11-26T14:00:00Z' })
  })

  it('reads a login with no Google, and an answer it cannot read as nothing known', () => {
    expect(googleWay(parseLoginWays({ has_login: true, has_password: false, ways: [{ provider: 'email', email: null }] }))).toBeNull()
    expect(parseLoginWays(null)).toEqual({ hasLogin: false, hasPassword: false, ways: [] })
    expect(parseLoginWays({ ways: [null, 7, { email: 'x' }] })).toEqual({ hasLogin: false, hasPassword: false, ways: [] })
  })

  it('notices a Google account on another address than the roster, whatever the case', () => {
    const way = { provider: 'google', email: 'ZZ.Test.Estimator@example.com', lastSignInAt: null, linkedAt: null }
    expect(googleAddressDiffers(way, 'zz.test.estimator@example.com')).toBe(false)
    expect(googleAddressDiffers(way, 'zz.other@example.com')).toBe(true)
    expect(googleAddressDiffers(null, 'zz.other@example.com')).toBe(false)
  })

  it('asks before a link goes, naming the act and what stays', () => {
    const q = unlinkGoogleQuestion('ZZ Test Estimator')
    expect(q.confirmLabel).toBe('Unlink Google')
    expect(q.message).toContain("Take Google off ZZ Test Estimator's login?")
    expect(q.message).toContain('Their password and the emailed sign-in link still work')
  })
})
