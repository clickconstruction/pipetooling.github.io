import { describe, expect, it } from 'vitest'

import {
  MAGIC_LINK_OFFER_AFTER,
  friendlyOtpError,
  normalizeSignInEmail,
  recordFailedSignIn,
  shouldOfferMagicLink,
} from './signInMagicLink'

describe('normalizeSignInEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeSignInEmail('  Wendi@ClickPlumbing.com ')).toBe('wendi@clickplumbing.com')
  })
})

describe('recordFailedSignIn / shouldOfferMagicLink', () => {
  it('offers only after the threshold on the same email', () => {
    let counts: Record<string, number> = {}
    counts = recordFailedSignIn(counts, 'a@x.com')
    expect(shouldOfferMagicLink(counts, 'a@x.com')).toBe(false)
    counts = recordFailedSignIn(counts, 'a@x.com')
    expect(shouldOfferMagicLink(counts, 'a@x.com')).toBe(true)
    expect(MAGIC_LINK_OFFER_AFTER).toBe(2)
  })

  it('counts per normalized email — a typo’d address does not qualify the corrected one', () => {
    let counts: Record<string, number> = {}
    counts = recordFailedSignIn(counts, 'typo@x.com')
    counts = recordFailedSignIn(counts, 'typo@x.com')
    expect(shouldOfferMagicLink(counts, 'typo@x.com')).toBe(true)
    expect(shouldOfferMagicLink(counts, 'right@x.com')).toBe(false)
  })

  it('case/whitespace variants hit the same counter', () => {
    let counts: Record<string, number> = {}
    counts = recordFailedSignIn(counts, ' A@X.com')
    counts = recordFailedSignIn(counts, 'a@x.com ')
    expect(shouldOfferMagicLink(counts, 'A@x.COM')).toBe(true)
  })

  it('empty email never counts and never offers', () => {
    let counts: Record<string, number> = {}
    counts = recordFailedSignIn(counts, '  ')
    expect(counts).toEqual({})
    expect(shouldOfferMagicLink(counts, '')).toBe(false)
  })

  it('does not mutate the input map', () => {
    const counts = { 'a@x.com': 1 }
    recordFailedSignIn(counts, 'a@x.com')
    expect(counts['a@x.com']).toBe(1)
  })
})

describe('friendlyOtpError', () => {
  it('translates "Signups not allowed" into no-account wording', () => {
    expect(friendlyOtpError('Signups not allowed for otp')).toMatch(/No account found/)
  })

  it('translates network failures', () => {
    expect(friendlyOtpError('TypeError: Failed to fetch')).toMatch(/connection/)
  })

  it('translates rate limits and bans', () => {
    expect(friendlyOtpError('email rate limit exceeded')).toMatch(/wait a few minutes/i)
    expect(friendlyOtpError('user is banned')).toMatch(/deactivated/)
  })

  it('passes other server messages through verbatim', () => {
    expect(friendlyOtpError('some other error')).toBe('some other error')
  })

  it('falls back for empty messages', () => {
    expect(friendlyOtpError(undefined)).toBe('Could not send the link')
  })
})
