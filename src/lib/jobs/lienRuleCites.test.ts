import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIEN_RULES_DOOR, LIEN_RULES_GUIDE_SLUG, LIEN_RULE_CITES, lienRuleHref } from './lienRuleCites'

const guide = readFileSync(new URL(`../../content/help/${LIEN_RULES_GUIDE_SLUG}.md`, import.meta.url), 'utf8')
const headings = new Set(guide.split('\n').filter((l) => l.startsWith('## ')).map((l) => l.slice(3).trim()))

describe('LIEN_RULE_CITES (v2.3594)', () => {
  it('every cite points at a real heading in the guide', () => {
    for (const [cite, heading] of Object.entries(LIEN_RULE_CITES)) {
      expect(headings.has(heading), `${cite} → "${heading}"`).toBe(true)
    }
  })
  it('every door lands on a listed cite', () => {
    for (const cite of Object.values(LIEN_RULES_DOOR)) expect(cite in LIEN_RULE_CITES).toBe(true)
  })
  it('builds the in-app address with the anchor', () => {
    expect(lienRuleHref('§ 53.056')).toBe('/help?g=texas-lien-rules-the-app-follows#the-s-53-056-notice')
    expect(lienRuleHref('§ 28.004')).toBe('/help?g=texas-lien-rules-the-app-follows#interest-prompt-payment')
  })
})
