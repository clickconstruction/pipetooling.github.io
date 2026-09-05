import { describe, it, expect } from 'vitest'
// Deno edge module (supabase/functions/_shared) — the pure resolver, tested here.
import { resolvePortalReturnUrl, withPaidFlag } from '../../../supabase/functions/_shared/customerPortalReturnUrl'

const ORIGIN = 'https://clicktooling.com/'

describe('resolvePortalReturnUrl (which portal address the receipt points home to)', () => {
  it('main link + saved slug → the short custom address with paid=1', () => {
    expect(resolvePortalReturnUrl([{ audience: 'all', token: 'tok-all', revoked_at: null }], 'knight', ORIGIN)).toBe(
      'https://my.clickplumbing.com/knight?paid=1',
    )
  })

  it('main link, no slug → the token URL on the app origin (trailing slash trimmed), paid=1 appended with &', () => {
    expect(resolvePortalReturnUrl([{ audience: 'all', token: 'tok-all', revoked_at: null }], '  ', ORIGIN)).toBe(
      'https://clicktooling.com/portal?t=tok-all&paid=1',
    )
  })

  it('the main link wins over a GC-scoped one (the invoice is on the customer’s own job)', () => {
    expect(
      resolvePortalReturnUrl(
        [
          { audience: 'gc', token: 'tok-gc', revoked_at: null },
          { audience: 'all', token: 'tok-all', revoked_at: null },
        ],
        null,
        ORIGIN,
      ),
    ).toBe('https://clicktooling.com/portal?t=tok-all&paid=1')
  })

  it('only a GC-scoped link active → its token URL (never the slug: scoped views do not advertise the merged address)', () => {
    expect(resolvePortalReturnUrl([{ audience: 'gc', token: 'tok-gc', revoked_at: null }], 'knight', ORIGIN)).toBe(
      'https://clicktooling.com/portal?t=tok-gc&paid=1',
    )
  })

  it('revoked, blank-token, or no links → null (no line on the receipt)', () => {
    expect(resolvePortalReturnUrl([{ audience: 'all', token: 'tok', revoked_at: '2026-09-01T00:00:00Z' }], 'knight', ORIGIN)).toBeNull()
    expect(resolvePortalReturnUrl([{ audience: 'all', token: '  ', revoked_at: null }], 'knight', ORIGIN)).toBeNull()
    expect(resolvePortalReturnUrl([{ audience: 'customer', token: 'tok', revoked_at: null }], null, ORIGIN)).toBeNull()
    expect(resolvePortalReturnUrl([], 'knight', ORIGIN)).toBeNull()
  })

  it('withPaidFlag picks ? or & by whether a query already exists', () => {
    expect(withPaidFlag('https://a.b/c')).toBe('https://a.b/c?paid=1')
    expect(withPaidFlag('https://a.b/c?t=1')).toBe('https://a.b/c?t=1&paid=1')
  })
})
