import { describe, expect, it } from 'vitest'
import { buildBidPackageMailtoUrl } from './bidPackageMailto'

describe('buildBidPackageMailtoUrl', () => {
  it('encodes subject and body', () => {
    const url = buildBidPackageMailtoUrl({
      recipientEmail: 'robert@example.com',
      bidLabel: 'BE249 Project A&B',
      plainTextBody: 'Hello\nWorld',
    })
    expect(url.startsWith('mailto:robert%40example.com')).toBe(true)
    expect(url).toContain('subject=Pricing%20%E2%80%94%20BE249%20Project%20A%26B')
    expect(url).toContain('body=Hello%0AWorld')
  })

  it('uses the plain-text body verbatim (does not prepend a Job plans line)', () => {
    const url = buildBidPackageMailtoUrl({
      recipientEmail: 'a@b.co',
      bidLabel: 'BE1',
      plainTextBody: 'Bid: BE1\n\nJob plans: https://example.com/plans?a=b&c=d\n\nBody',
    })
    const decoded = decodeURIComponent(url.split('&body=')[1] ?? '')
    // Plain-text body owns the Job plans line; the helper must NOT prepend a duplicate.
    expect(decoded.split('\n')[0]).toBe('Bid: BE1')
    expect((decoded.match(/Job plans:/g) ?? []).length).toBe(1)
    expect(decoded).toContain('Body')
  })

  it('throws on bad email', () => {
    expect(() =>
      buildBidPackageMailtoUrl({
        recipientEmail: 'not-an-email',
        bidLabel: 'BE1',
        plainTextBody: 'x',
      }),
    ).toThrow(/Invalid recipient email/)
  })

  it('trims surrounding whitespace on email', () => {
    const url = buildBidPackageMailtoUrl({
      recipientEmail: '  a@b.co  ',
      bidLabel: 'BE1',
      plainTextBody: 'x',
    })
    expect(url.startsWith('mailto:a%40b.co')).toBe(true)
  })

  it('handles special characters in bid label without breaking the URL', () => {
    const url = buildBidPackageMailtoUrl({
      recipientEmail: 'a@b.co',
      bidLabel: 'BE1 "Quote" & <Bad> #1',
      plainTextBody: 'x',
    })
    expect(url).not.toContain('"')
    expect(url).not.toContain('<')
    expect(url).not.toContain('#')
    expect(url).not.toContain('&Bad')
  })
})
