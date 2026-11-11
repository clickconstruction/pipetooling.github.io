import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIEN_HELP_GUIDE_SLUG, lienHelpGuideCode, lienHelpGuideUrl } from './lienHelpGuideCode'

describe('the code a lien help sheet prints (punch list #314, change 11)', () => {
  it('points at a guide that exists, on its public share page', () => {
    expect(existsSync(`src/content/help/${LIEN_HELP_GUIDE_SLUG}.md`)).toBe(true)
    expect(lienHelpGuideUrl()).toBe(`https://clicktooling.com/g/${LIEN_HELP_GUIDE_SLUG}/`)
  })
  it('draws as an image the sheet can carry with no network, and is drawn once', () => {
    const code = lienHelpGuideCode()
    expect(code).toMatch(/^<img alt="" src="data:image\/png;base64,[A-Za-z0-9+/=]+"\/>$/)
    expect(lienHelpGuideCode()).toBe(code)
  })
})
