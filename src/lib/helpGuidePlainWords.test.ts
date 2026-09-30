/**
 * Every help guide not on `LEGACY_PLAIN_WORDS_GUIDES` reads by the plain-words rules
 * (`plainWords.ts`; the convention since v2.4233): one idea per sentence and none over 20
 * words, nothing glued together with dashes, semicolons, parentheses or dot lists. A new
 * guide is held from its first commit. A guide on the legacy list joins the moment a PR
 * touches it — `npm run check:plain-words` fails CI while a touched guide is still listed —
 * and a guide that fails here is rewritten, never exempted.
 *
 * Held: the body's paragraphs and list items. Not held: the frontmatter, the headings, the
 * `:::example` panels (they quote real bids), a mock-UI token (the control's exact name is
 * the rule) and an italic span (what the screen prints, quoted as printed).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { helpGuidePlainWordsFailures } from './plainWords'
import { LEGACY_PLAIN_WORDS_GUIDES } from './plainWordsLegacy'

const CONTENT_DIR = join(__dirname, '../content/help')

const slugs = readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.slice(0, -3))
const held = slugs.filter((s) => !LEGACY_PLAIN_WORDS_GUIDES.has(s))

describe('help guides written in plain words', () => {
  it('holds at least the guides rewritten so far', () => {
    expect(held).toContain('build-a-submittal-package')
  })

  it.each(held)('%s — short sentences, nothing glued', (slug) => {
    const failures = helpGuidePlainWordsFailures(readFileSync(join(CONTENT_DIR, `${slug}.md`), 'utf8'))
    expect(failures, `guide "${slug}" fails the plain-words rules (src/lib/plainWords.ts):\n  - ${failures.join('\n  - ')}`).toEqual([])
  })

  it('every legacy row names a guide that still exists (a deleted guide leaves the list)', () => {
    for (const slug of LEGACY_PLAIN_WORDS_GUIDES) {
      expect(existsSync(join(CONTENT_DIR, `${slug}.md`)), `LEGACY_PLAIN_WORDS_GUIDES names "${slug}", which is not a guide — remove its row`).toBe(true)
    }
  })
})
