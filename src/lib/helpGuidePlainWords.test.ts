/**
 * Every help guide reads by the plain-words rules (`plainWords.ts`; the convention since
 * v2.4233): one idea per sentence and none over 20 words, nothing glued together with
 * dashes, semicolons, parentheses or dot lists. A new guide is held from its first commit,
 * and a guide that fails here is rewritten, never exempted. The guides written before the
 * rules were all rewritten by 2026-10-05 (punch list #75), so there is no exemption list.
 *
 * Held: the body's paragraphs, list items and table rows. Not held: the frontmatter, the
 * headings, the `:::example` panels (they quote real bids), a mock-UI token (the control's
 * exact name is the rule), an italic span (what the screen prints, quoted as printed), a
 * table row's pipes and a table cell holding only "—".
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { helpGuidePlainWordsFailures } from './plainWords'

const CONTENT_DIR = join(__dirname, '../content/help')

const slugs = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.slice(0, -3))

describe('help guides written in plain words', () => {
  it('reads every guide in src/content/help', () => {
    expect(slugs).toContain('build-a-submittal-package')
  })

  it.each(slugs)('%s — short sentences, nothing glued', (slug) => {
    const failures = helpGuidePlainWordsFailures(readFileSync(join(CONTENT_DIR, `${slug}.md`), 'utf8'))
    expect(failures, `guide "${slug}" fails the plain-words rules (src/lib/plainWords.ts):\n  - ${failures.join('\n  - ')}`).toEqual([])
  })
})
