import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared) — the pure card, tested here.
import { PORTAL_QR_CONTENT_ID, portalAccountCardHtml, portalAddressInWords } from '../../../supabase/functions/_shared/portalAccountCard'

const SHORT = 'https://my.clickplumbing.com/hartwell-homes-k7x2'
const TOKEN = `https://clicktooling.com/portal?t=${'7c1e09ab34f25d60'.repeat(4)}`

describe('portalAccountCardHtml ("Your account, any time")', () => {
  it('draws the code and the address in words, both linked to the statement', () => {
    const html = portalAccountCardHtml(SHORT, `cid:${PORTAL_QR_CONTENT_ID}`)
    expect(html).toContain('Your account, any time')
    expect(html).toContain('<img src="cid:portal-qr" width="120" height="120" alt="QR code for my.clickplumbing.com/hartwell-homes-k7x2"')
    expect(html).toContain('>my.clickplumbing.com/hartwell-homes-k7x2</a>')
    expect(html.split(`href="${SHORT}"`).length - 1).toBe(2)
    expect(html).toContain('Scan the code with your phone camera.')
  })

  it('keeps the address when there is no code, and says nothing about scanning', () => {
    for (const src of [null, undefined, ' ']) {
      const html = portalAccountCardHtml(SHORT, src)
      expect(html).not.toContain('<img')
      expect(html).not.toContain('Scan the code')
      expect(html).toContain('>my.clickplumbing.com/hartwell-homes-k7x2</a>')
    }
  })

  it('says "Open your statement" for a token address', () => {
    const html = portalAccountCardHtml(TOKEN, 'cid:portal-qr')
    expect(html).toContain('>Open your statement</a>')
    expect(html).toContain('alt="QR code for your statement"')
  })

  it('is nothing without a statement, whatever image it is handed', () => {
    for (const url of [null, undefined, '', '  ']) expect(portalAccountCardHtml(url, 'cid:portal-qr')).toBe('')
  })

  it('escapes the address', () => {
    expect(portalAccountCardHtml('https://my.clickplumbing.com/a"b', null)).toContain('href="https://my.clickplumbing.com/a&quot;b"')
  })
})

describe('portalAddressInWords', () => {
  it('drops the scheme and a trailing slash', () => {
    expect(portalAddressInWords('https://my.clickplumbing.com/knight-x7kq/')).toBe('my.clickplumbing.com/knight-x7kq')
  })
  it('is null for nothing, a token address and an address too long to read', () => {
    expect(portalAddressInWords(null)).toBeNull()
    expect(portalAddressInWords(' ')).toBeNull()
    expect(portalAddressInWords(TOKEN)).toBeNull()
    expect(portalAddressInWords(`https://my.clickplumbing.com/${'a'.repeat(60)}`)).toBeNull()
  })
})
