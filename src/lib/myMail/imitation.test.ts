import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  IMITATION_SKEW_SECONDS,
  IMITATION_WINDOW_SECONDS,
  MAGIC_LINK_METHODS,
  MY_MAIL_NOT_SIGN_IN_WORDS,
  imitationsSince,
  isSignInAddress,
  openedByImitation,
  sessionLinkAt,
} from './imitation'

/** base64url of a string's UTF-8 bytes, as a JWT carries each part. */
const b64url = (text: string): string => {
  let bin = ''
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
/** A token shaped as GoTrue signs one; the signature is never read here. */
const jwt = (payload: unknown): string => `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.not-a-real-signature`

// A real session on prod opened by a magic link (the dev-login flow, 2026-11-01) carried this amr, its timestamp the
// sign-in in seconds, kept across a refresh at a later iat and exp.
const SIGNED_IN = 1793549406
const iso = (secondsSinceEpoch: number) => new Date(secondsSinceEpoch * 1000).toISOString()

describe('sessionLinkAt: when a session signed in by a magic link', () => {
  it('reads GoTrue’s otp entry, the shape a magic link verified on the page leaves, past a later refresh', () => {
    const token = jwt({ sub: 'u-1', role: 'authenticated', aal: 'aal1', amr: [{ method: 'otp', timestamp: SIGNED_IN }], iat: SIGNED_IN + 7200, exp: SIGNED_IN + 43200, session_id: 's-1' })
    expect(sessionLinkAt(token)).toBe(SIGNED_IN)
  })

  it('reads a magiclink entry too, the shape GoTrue’s own redirect may leave, in any case', () => {
    expect(sessionLinkAt(jwt({ amr: [{ method: 'magiclink', timestamp: SIGNED_IN }] }))).toBe(SIGNED_IN)
    expect(sessionLinkAt(jwt({ amr: [{ method: ' OTP ', timestamp: SIGNED_IN }] }))).toBe(SIGNED_IN)
    expect(MAGIC_LINK_METHODS).toEqual(['magiclink', 'otp'])
  })

  it('answers the newest magic-link entry of several, and never another method’s time', () => {
    const amr = [
      { method: 'totp', timestamp: SIGNED_IN + 900 },
      { method: 'otp', timestamp: SIGNED_IN - 60 },
      { method: 'magiclink', timestamp: SIGNED_IN },
      { method: 'password', timestamp: SIGNED_IN + 600 },
    ]
    expect(sessionLinkAt(jwt({ amr }))).toBe(SIGNED_IN)
  })

  it('answers null for a session that never used a magic link', () => {
    expect(sessionLinkAt(jwt({ amr: [{ method: 'password', timestamp: SIGNED_IN }], iat: SIGNED_IN }))).toBeNull()
    expect(sessionLinkAt(jwt({ amr: [{ method: 'oauth', timestamp: SIGNED_IN }, { method: 'totp', timestamp: SIGNED_IN }] }))).toBeNull()
    expect(sessionLinkAt(jwt({ amr: [], iat: SIGNED_IN }))).toBeNull()
    expect(sessionLinkAt(jwt({ sub: 'u-1', iat: SIGNED_IN }))).toBeNull()
  })

  it('reads an amr of plain method names, which carry no time, at the token’s own iat', () => {
    expect(sessionLinkAt(jwt({ amr: ['otp'], iat: SIGNED_IN }))).toBe(SIGNED_IN)
    expect(sessionLinkAt(jwt({ amr: ['pwd', 'magiclink'], iat: SIGNED_IN }))).toBe(SIGNED_IN)
    expect(sessionLinkAt(jwt({ amr: ['pwd', 'mfa'], iat: SIGNED_IN }))).toBeNull()
    expect(sessionLinkAt(jwt({ amr: ['otp'] }))).toBeNull()
    // A magic-link entry with no usable time of its own falls back the same way; a dated one wins over it.
    expect(sessionLinkAt(jwt({ amr: [{ method: 'otp' }], iat: SIGNED_IN }))).toBe(SIGNED_IN)
    expect(sessionLinkAt(jwt({ amr: [{ method: 'otp', timestamp: 'yesterday' }, { method: 'magiclink', timestamp: SIGNED_IN - 5 }], iat: SIGNED_IN }))).toBe(SIGNED_IN - 5)
  })

  it('answers null for a token that is not a JWT', () => {
    for (const bad of [null, undefined, '', '   ', 'marisol-jwt', 'a.', 'a.%%%.c', `a.${b64url('not json')}.c`, `a.${b64url('[1,2]')}.c`, `a.${b64url('"otp"')}.c`]) {
      expect(sessionLinkAt(bad), String(bad)).toBeNull()
    }
    expect(sessionLinkAt(jwt({ amr: 'otp', iat: SIGNED_IN }))).toBeNull()
    expect(sessionLinkAt(jwt({ amr: { method: 'otp', timestamp: SIGNED_IN } }))).toBeNull()
  })

  it('reads a payload with words beyond ASCII in it', () => {
    expect(sessionLinkAt(jwt({ user_metadata: { name: 'José Núñez' }, amr: [{ method: 'otp', timestamp: SIGNED_IN }] }))).toBe(SIGNED_IN)
  })
})

describe('openedByImitation: an imitation of this person before the sign-in', () => {
  it('counts one made shortly before, and none at all is no imitation', () => {
    expect(openedByImitation(SIGNED_IN, [{ created_at: iso(SIGNED_IN - 30) }])).toBe(true)
    expect(openedByImitation(SIGNED_IN, [])).toBe(false)
  })

  it('counts back 24 hours to the second, and not one second more', () => {
    expect(IMITATION_WINDOW_SECONDS).toBe(86400)
    expect(openedByImitation(SIGNED_IN, [{ created_at: iso(SIGNED_IN - IMITATION_WINDOW_SECONDS) }])).toBe(true)
    expect(openedByImitation(SIGNED_IN, [{ created_at: iso(SIGNED_IN - IMITATION_WINDOW_SECONDS - 1) }])).toBe(false)
  })

  it('counts 5 minutes after the sign-in for the clocks, and not one second more', () => {
    expect(IMITATION_SKEW_SECONDS).toBe(300)
    expect(openedByImitation(SIGNED_IN, [{ created_at: iso(SIGNED_IN + IMITATION_SKEW_SECONDS) }])).toBe(true)
    expect(openedByImitation(SIGNED_IN, [{ created_at: iso(SIGNED_IN + IMITATION_SKEW_SECONDS + 1) }])).toBe(false)
  })

  it('reads Postgres’s own timestamps, and finds the one row in the window among others', () => {
    expect(openedByImitation(SIGNED_IN, [{ created_at: '2026-10-29T08:00:00.123456+00:00' }, { created_at: iso(SIGNED_IN - 4).replace('Z', '+00:00') }])).toBe(true)
    expect(openedByImitation(SIGNED_IN, [{ created_at: iso(SIGNED_IN - 3 * 86400) }, { created_at: iso(SIGNED_IN + 3600) }])).toBe(false)
  })

  it('counts a row whose time cannot be read, and any row for a sign-in with no time', () => {
    expect(openedByImitation(SIGNED_IN, [{ created_at: null }])).toBe(true)
    expect(openedByImitation(SIGNED_IN, [{ created_at: 'not a time' }])).toBe(true)
    expect(openedByImitation(Number.NaN, [{ created_at: iso(SIGNED_IN - 3 * 86400) }])).toBe(true)
    expect(openedByImitation(Number.NaN, [])).toBe(false)
  })
})

describe('imitationsSince: where the read of imitations starts', () => {
  it('starts 24 hours before the sign-in, and at the start of time when the sign-in is past what a date holds', () => {
    expect(imitationsSince(SIGNED_IN)).toBe(iso(SIGNED_IN - 86400))
    expect(imitationsSince(1e20)).toBe('1970-01-01T00:00:00.000Z')
  })
})

describe('isSignInAddress: the address the person signs in with, and no other', () => {
  it('matches trimmed and in any case', () => {
    expect(isSignInAddress('marisol@clickplumbing.example', 'marisol@clickplumbing.example')).toBe(true)
    expect(isSignInAddress('  Marisol@ClickPlumbing.example ', 'marisol@clickplumbing.EXAMPLE')).toBe(true)
  })

  it('refuses another address, and an address missing on either side', () => {
    expect(isSignInAddress('owner@clickplumbing.example', 'marisol@clickplumbing.example')).toBe(false)
    expect(isSignInAddress('marisol@clickplumbing.example', null)).toBe(false)
    expect(isSignInAddress('marisol@clickplumbing.example', undefined)).toBe(false)
    expect(isSignInAddress('', '')).toBe(false)
    expect(isSignInAddress('no address', 'no address')).toBe(false)
  })

  it('says why in plain words', () => {
    expect(plainWordsFailures(MY_MAIL_NOT_SIGN_IN_WORDS)).toEqual([])
  })
})
