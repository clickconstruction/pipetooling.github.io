/**
 * Conformance test over the REAL guides in src/content/help/ for their share
 * pages (v2.4190): every guide gets a page and a card at /g/<slug>/ from its
 * frontmatter and first paragraph, with nothing to do per guide — as long as
 * the title reads on the card and the first paragraph reads as the card's
 * line. A guide whose title would not fit the card in four lines, or whose
 * first paragraph is empty, a token or a heading, fails here in CI.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseHelpGuideFrontmatter } from './helpGuides'
import { HELP_SHARE_CARD_HEIGHT, HELP_SHARE_CARD_WIDTH, helpShareCardFit, helpShareCardSvg, helpShareDescription, helpSharePageHtml, helpShareTitle } from './helpShareCard'

const CONTENT_DIR = join(__dirname, '../content/help')

function guides(): Array<{ slug: string; title: string; category: string; body: string }> {
  return readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { fields, body } = parseHelpGuideFrontmatter(readFileSync(join(CONTENT_DIR, f), 'utf8'))
      return { slug: f.replace(/\.md$/, ''), title: (fields.title ?? '').trim(), category: (fields.category ?? '').trim(), body }
    })
}

describe('every guide’s share page and card (v2.4190)', () => {
  it('the title reads as "How do I …?" and fits the card in four lines at 48 px or bigger', () => {
    for (const g of guides()) {
      expect(g.title, `guide "${g.slug}" has no title`).not.toBe('')
      expect(/^[a-z0-9]/.test(g.title), `guide "${g.slug}": the title completes "How do I…", so it starts lowercase — "${g.title}"`).toBe(true)
      const fit = helpShareCardFit(helpShareTitle(g.title))
      expect(fit.fontSize, `guide "${g.slug}": the title is too long for the card — shorten it below about 90 characters ("${g.title}")`).toBeGreaterThanOrEqual(48)
      expect(fit.lines.length).toBeLessThanOrEqual(4)
    }
  })

  it('the first paragraph is the card’s line: present, plain, and a sentence or two', () => {
    for (const g of guides()) {
      const d = helpShareDescription(g.body)
      expect(d.length, `guide "${g.slug}": the first paragraph is empty, a heading, a list or a token — the card would say only "A ClickTooling help guide." Open with a sentence.`).toBeGreaterThanOrEqual(20)
      expect(d.length).toBeLessThanOrEqual(200)
      expect(d, `guide "${g.slug}": a mock-UI token leaked into the card's line`).not.toMatch(/\{\{|\}\}|\*\*|:::/)
    }
  })

  it('the page and the card build for every guide without an escape hole', () => {
    for (const g of guides()) {
      const html = helpSharePageHtml({ slug: g.slug, title: g.title, category: g.category, description: helpShareDescription(g.body), origin: 'https://clicktooling.com', image: `/g/${g.slug}/card.png` })
      expect(html).toContain(`<meta property="og:url" content="https://clicktooling.com/g/${g.slug}/">`)
      expect(html).toContain(`<meta property="og:image" content="https://clicktooling.com/g/${g.slug}/card.png">`)
      expect(html).not.toContain('http-equiv="refresh"')
      const svg = helpShareCardSvg({ title: g.title, category: g.category, slug: g.slug })
      expect(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" width="${HELP_SHARE_CARD_WIDTH}" height="${HELP_SHARE_CARD_HEIGHT}"`)).toBe(true)
      expect(svg).not.toMatch(/<script|javascript:/i)
    }
  })
})
