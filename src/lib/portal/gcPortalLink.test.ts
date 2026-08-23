import { describe, expect, it } from 'vitest'
import { gcPortalLinkCaption, resolveGcPortalLink, type PortalLinkRow, type PortalSlugRow } from './gcPortalLink'

const O = 'https://pipetooling.com'
const link = (customer_id: string, audience: string, token: string | null, revoked_at: string | null = null): PortalLinkRow => ({ customer_id, audience, token, revoked_at })
const slug = (customer_id: string, s: string, locked_at: string | null = null): PortalSlugRow => ({ customer_id, slug: s, locked_at })

describe('resolveGcPortalLink', () => {
  it('prefers an active GC-scoped link (token URL, "GC bills only")', () => {
    const r = resolveGcPortalLink('c1', [link('c1', 'all', 'A'), link('c1', 'gc', 'G')], [slug('c1', 'rmc-dudley-mason', '2026-08-01')], O)
    expect(r).toEqual({ url: 'https://pipetooling.com/portal?t=G', view: 'gc', short: false, slug: null, slugLocked: false })
    expect(gcPortalLinkCaption(r!)).toBe('GC bills only')
  })

  it('falls back to the main link as the short address when a slug exists', () => {
    const r = resolveGcPortalLink('c1', [link('c1', 'all', 'A')], [slug('c1', 'rmc-dudley-mason')], O)
    expect(r).toEqual({ url: 'https://my.clickplumbing.com/rmc-dudley-mason', view: 'all', short: true, slug: 'rmc-dudley-mason', slugLocked: false })
    expect(gcPortalLinkCaption(r!)).toBe('full account')
  })

  it('uses the main token link when there is no slug', () => {
    expect(resolveGcPortalLink('c1', [link('c1', 'all', 'A')], [], 'https://pipetooling.com/')?.url).toBe('https://pipetooling.com/portal?t=A')
  })

  it('ignores revoked links, other customers, and tokenless rows → null', () => {
    expect(resolveGcPortalLink('c1', [link('c1', 'all', 'A', '2026-08-02'), link('c2', 'all', 'B'), link('c1', 'gc', null)], [slug('c1', 'x')], O)).toBeNull()
    expect(resolveGcPortalLink(null, [link('c1', 'all', 'A')], [], O)).toBeNull()
  })

  it('a revoked gc link does not shadow the main link', () => {
    expect(resolveGcPortalLink('c1', [link('c1', 'gc', 'G', '2026-08-02'), link('c1', 'all', 'A')], [], O)?.view).toBe('all')
  })
})
