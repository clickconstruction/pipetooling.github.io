import { describe, expect, it } from 'vitest'
import { impersonationReturnPath, readImpersonationStash } from './impersonationSession'

describe('impersonationReturnPath (v2.3606)', () => {
  const origin = 'https://clicktooling.com'
  it('returns to the page the operator left, on this origin, with its query and hash', () => {
    expect(impersonationReturnPath({ returnTo: 'https://clicktooling.com/prospects?tab=team#hiring' }, origin)).toBe('/prospects?tab=team#hiring')
  })
  it('falls back to the dashboard for an older stash, a foreign origin, or a sign-in page', () => {
    expect(impersonationReturnPath({ access_token: 'a' }, origin)).toBe('/dashboard')
    expect(impersonationReturnPath(null, origin)).toBe('/dashboard')
    expect(impersonationReturnPath({ returnTo: 'https://evil.example/x' }, origin)).toBe('/dashboard')
    expect(impersonationReturnPath({ returnTo: 'https://clicktooling.com/sign-in' }, origin)).toBe('/dashboard')
    expect(impersonationReturnPath({ returnTo: 'not a url' }, origin)).toBe('/dashboard')
  })
  it('reads the stash fail-soft', () => {
    expect(readImpersonationStash('{"access_token":"a","returnTo":"/x"}')).toEqual({ access_token: 'a', returnTo: '/x' })
    expect(readImpersonationStash('junk')).toBeNull()
    expect(readImpersonationStash(null)).toBeNull()
  })
})
