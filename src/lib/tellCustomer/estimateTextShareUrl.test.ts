import { describe, expect, it } from 'vitest'
import { estimateTextShareUrl } from './estimateTextLink'
import { ESTIMATE_SHORT_ORIGIN, estimateShortUrl } from '../portal/portalShortOrigin'

const CODE = 'k7mnp2qrst'

describe('the estimate text’s link on the Click Plumbing host (#281 PR 3)', () => {
  it('rides my.clickplumbing.com/e/<code>: 41 characters with a ten-letter code', () => {
    expect(ESTIMATE_SHORT_ORIGIN).toBe('https://my.clickplumbing.com')
    expect(estimateTextShareUrl(CODE)).toBe('https://my.clickplumbing.com/e/k7mnp2qrst')
    expect(estimateTextShareUrl(CODE).length).toBe(41)
    expect(estimateShortUrl(CODE, 'https://my.clickplumbing.com/')).toBe('https://my.clickplumbing.com/e/k7mnp2qrst')
  })

  it('with no short host it is the accept page on the app’s own origin, as before PR 3', () => {
    expect(estimateTextShareUrl(CODE, null)).toBe('https://clicktooling.com/estimate/accept?t=k7mnp2qrst')
  })

  it('a code made before the ten letters still rides the host, and a blank code is no link', () => {
    const old = 'AbC-_' + 'x'.repeat(27)
    expect(estimateTextShareUrl(old)).toBe(`https://my.clickplumbing.com/e/${old}`)
    expect(estimateTextShareUrl('  ')).toBe('')
  })
})
