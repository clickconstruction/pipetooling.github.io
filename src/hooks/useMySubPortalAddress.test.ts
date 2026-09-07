import { describe, expect, it } from 'vitest'
import { mySubPortalUrl } from './useMySubPortalAddress'
import { portalShortUrl } from '../lib/portal/portalShortOrigin'

describe('mySubPortalUrl (SP-2)', () => {
  it('prefers the short address', () => {
    expect(mySubPortalUrl({ slug: 'kraja-mke8', token: 'abc' }, 'https://app.example')).toBe(portalShortUrl('kraja-mke8'))
  })
  it('falls back to the direct token link on the app origin', () => {
    expect(mySubPortalUrl({ slug: null, token: 'abc def' }, 'https://app.example')).toBe('https://app.example/sub?t=abc%20def')
  })
  it('is null with no address, or a hash-only link without a slug', () => {
    expect(mySubPortalUrl(null, 'https://app.example')).toBeNull()
    expect(mySubPortalUrl({ slug: null, token: null }, 'https://app.example')).toBeNull()
  })
})
