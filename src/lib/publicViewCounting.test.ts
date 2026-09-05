import { describe, expect, it } from 'vitest'
import {
  PUBLIC_PREVIEW_PARAM,
  isPreviewFlag,
  shouldCountPublicView,
  userBearerToken,
  withPreviewFlag,
} from './publicViewCounting'
import { publicViewDecision, requestIsStaff } from '../../supabase/functions/_shared/publicViewCounting'

const ANON = 'anon-key-xyz'

function fakeReq(url: string, authorization?: string) {
  return {
    url,
    headers: { get: (name: string) => (name.toLowerCase() === 'authorization' ? (authorization ?? null) : null) },
  }
}

function verifier(valid: ReadonlySet<string>) {
  return {
    auth: {
      getUser: async (jwt: string) =>
        valid.has(jwt) ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: { message: 'bad jwt' } },
    },
  }
}

describe('shouldCountPublicView (journey-map #37)', () => {
  it('a plain customer open counts', () => {
    expect(shouldCountPublicView({ preview: false, isStaff: false })).toBe(true)
  })
  it('an office preview never counts', () => {
    expect(shouldCountPublicView({ preview: true, isStaff: false })).toBe(false)
  })
  it('a signed-in staff open never counts, flag or not', () => {
    expect(shouldCountPublicView({ preview: false, isStaff: true })).toBe(false)
    expect(shouldCountPublicView({ preview: true, isStaff: true })).toBe(false)
  })
})

describe('isPreviewFlag', () => {
  it.each(['1', 'true', 'TRUE', 'yes', ' 1 '])('%j reads as preview', (v) => expect(isPreviewFlag(v)).toBe(true))
  it.each(['0', 'false', '', 'no', null, undefined])('%j does not', (v) => expect(isPreviewFlag(v)).toBe(false))
})

describe('withPreviewFlag', () => {
  it('appends to a bare page URL', () => {
    expect(withPreviewFlag('https://app.test/portal')).toBe('https://app.test/portal?preview=1')
  })
  it('keeps the token and adds the flag', () => {
    expect(withPreviewFlag('https://app.test/portal?t=abc')).toBe('https://app.test/portal?t=abc&preview=1')
  })
  it('is idempotent and preserves a hash', () => {
    const once = withPreviewFlag('/sub?t=abc#pay')
    expect(once).toBe('/sub?t=abc&preview=1#pay')
    expect(withPreviewFlag(once)).toBe(once)
  })
  it('uses the shared param name', () => {
    expect(PUBLIC_PREVIEW_PARAM).toBe('preview')
    expect(withPreviewFlag('/x')).toContain(`${PUBLIC_PREVIEW_PARAM}=1`)
  })
  it('leaves an empty string alone', () => {
    expect(withPreviewFlag('')).toBe('')
  })
})

describe('userBearerToken', () => {
  it('returns a user token', () => {
    expect(userBearerToken('Bearer user.jwt.here', ANON)).toBe('user.jwt.here')
  })
  it('treats the anon key as no token — the public pages send it by default', () => {
    expect(userBearerToken(`Bearer ${ANON}`, ANON)).toBeNull()
  })
  it('ignores a missing or malformed header', () => {
    expect(userBearerToken(null, ANON)).toBeNull()
    expect(userBearerToken('', ANON)).toBeNull()
    expect(userBearerToken('Basic abc', ANON)).toBeNull()
    expect(userBearerToken('Bearer ', ANON)).toBeNull()
  })
})

describe('requestIsStaff / publicViewDecision', () => {
  const v = verifier(new Set(['good.staff.jwt']))

  it('a valid session is staff', async () => {
    expect(await requestIsStaff(fakeReq('https://f/x', 'Bearer good.staff.jwt'), v, ANON)).toBe(true)
  })
  it('the anon key, an invalid token, or no header is not staff', async () => {
    expect(await requestIsStaff(fakeReq('https://f/x', `Bearer ${ANON}`), v, ANON)).toBe(false)
    expect(await requestIsStaff(fakeReq('https://f/x', 'Bearer expired.or.junk'), v, ANON)).toBe(false)
    expect(await requestIsStaff(fakeReq('https://f/x'), v, ANON)).toBe(false)
  })
  it('a verifier that throws is not staff (fail toward counting)', async () => {
    const boom = { auth: { getUser: async () => { throw new Error('network') } } }
    expect(await requestIsStaff(fakeReq('https://f/x', 'Bearer any'), boom, ANON)).toBe(false)
  })
  it('the decision combines the flag and the session', async () => {
    expect(await publicViewDecision(fakeReq('https://f/customer-portal?token=t'), v, ANON)).toEqual({ preview: false, isStaff: false, count: true })
    expect(await publicViewDecision(fakeReq('https://f/customer-portal?token=t&preview=1'), v, ANON)).toEqual({ preview: true, isStaff: false, count: false })
    expect(await publicViewDecision(fakeReq('https://f/customer-portal?token=t', 'Bearer good.staff.jwt'), v, ANON)).toEqual({ preview: false, isStaff: true, count: false })
  })
})
