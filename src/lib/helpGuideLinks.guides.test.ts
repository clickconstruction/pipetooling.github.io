// @vitest-environment jsdom
/**
 * Every link in every REAL guide reaches the page alive (v2.4868). The sanitizer keeps an
 * href only when helpGuideHtml carries it through, so a link written in a form it does not
 * know comes out as a bare <a> that does nothing when tapped. Forty guides wrote theirs as
 * `?g=<slug>` and every one was dead until v2.4868. This renders each guide the way the Help
 * page does and fails on a link with no href, a guide link naming no guide, or a link to a
 * heading of another guide (`/help/<slug>#<anchor>`) naming no heading in it.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseHelpGuideFrontmatter } from './helpGuides'
import { helpGuideMarkdownToSafeHtml } from './helpGuideHtml'
import { applyHeadingAnchors } from './helpGuideAnchors'

const CONTENT_DIR = join(__dirname, '../content/help')

const slugs = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.slice(0, -3))

/** Each guide as the Help page draws it, with the heading ids the page stamps. */
const pages = new Map(
  slugs.map((slug) => {
    const { body } = parseHelpGuideFrontmatter(readFileSync(join(CONTENT_DIR, `${slug}.md`), 'utf8'))
    const doc = new DOMParser().parseFromString(helpGuideMarkdownToSafeHtml(body), 'text/html')
    return [slug, { links: [...doc.querySelectorAll('a')], anchors: new Set(applyHeadingAnchors(doc.body)) }]
  }),
)

describe('every link in every guide works (v2.4868)', () => {
  it.each(slugs)('%s — each link keeps its address and names a real guide and heading', (slug) => {
    const { links } = pages.get(slug)!
    const dead = links.filter((a) => !a.getAttribute('href')).map((a) => a.textContent?.trim() ?? '')
    expect(dead, `guide "${slug}" has links that do nothing when tapped. Write a guide link as /help/<slug>, a page of the app as its root path, a heading as #<anchor>`).toEqual([])
    const missing = links.map((a) => a.getAttribute('data-guide')).filter((g): g is string => g !== null && !pages.has(g))
    expect(missing, `guide "${slug}" links to guides that do not exist`).toEqual([])
    const noHeading = links
      .map((a) => ({ guide: a.getAttribute('data-guide'), anchor: a.getAttribute('data-guide-anchor') }))
      .filter((l) => l.guide && l.anchor && pages.has(l.guide) && !pages.get(l.guide)!.anchors.has(l.anchor))
      .map((l) => `/help/${l.guide}#${l.anchor}`)
    expect(noHeading, `guide "${slug}" links to headings that are not in the guide it names`).toEqual([])
  })
})
