/**
 * The plain-words rules, held over the help guides that were written by them (v2.4229,
 * punch list #58 — the Submittals walkthrough's rules from `submittalTour.test.ts`, applied
 * to prose): one idea per sentence and no sentence over 20 words; nothing glued together
 * with dashes, semicolons, parentheses or dot lists. A guide that fails here is rewritten,
 * never exempted.
 *
 * What is held: the body's paragraphs and list items. What is not: the frontmatter, the
 * headings, the `:::example` panels (kept as written — they quote real bids), the mock-UI
 * tokens (a button's exact name is the rule, whatever it contains) and italic spans (what
 * the screen prints is quoted as printed, `*57 of 75 on rows · 18 not used*`).
 *
 * Whether every guide is held to these rules is the to-do's item 3, an owner call; until
 * then the list below names the guides that are.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONTENT_DIR = join(__dirname, '../content/help')

/** The guides written by the plain-words rules. Add a slug when its rewrite ships. */
export const PLAIN_WORDS_GUIDES = ['build-a-submittal-package'] as const

const MAX_WORDS = 20
const GLUE = /[—;()·]/

/** The body's prose lines: no frontmatter, no headings, no example panels, no blank lines. */
export function plainWordsProseLines(source: string): string[] {
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, '')
  const lines: string[] = []
  let inExample = false
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    if (line.startsWith(':::')) {
      inExample = line.length > 3
      continue
    }
    if (inExample || !line || line.startsWith('#')) continue
    lines.push(line.replace(/^-\s+/, ''))
  }
  return lines
}

/** A token becomes its label for counting; bold marks go; an italic span is one quoted word. */
function forCounting(line: string): string {
  return line
    .replace(/\{\{[a-z]+:[a-z]+\|([^}]*)\}\}/g, '$1')
    .replace(/\{\{[a-z]+:[a-z]+\}\}/g, 'icon')
    .replace(/\*\*/g, '')
    .replace(/\*[^*]+\*/g, 'quoted')
}

/** Tokens and italic spans are quotes of the screen; the glue rule reads around them. */
function forGlue(line: string): string {
  return line
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*[^*]+\*/g, '')
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
}

describe('help guides written in plain words', () => {
  it.each(PLAIN_WORDS_GUIDES)('%s — short sentences, nothing glued', (slug) => {
    const source = readFileSync(join(CONTENT_DIR, `${slug}.md`), 'utf8')
    const lines = plainWordsProseLines(source)
    expect(lines.length).toBeGreaterThan(10)
    for (const line of lines) {
      expect(forGlue(line), line).not.toMatch(GLUE)
      for (const sentence of sentences(forCounting(line))) {
        expect(sentence.split(/\s+/).length, `${sentence}\n\n(in) ${line}`).toBeLessThanOrEqual(MAX_WORDS)
      }
    }
  })

  it('the prose reader keeps paragraphs and list items, and drops the rest', () => {
    const source = ['---', 'title: x', '---', 'First line.', '', '## Heading', '- an item', ':::example The bid', 'quoted (kept as is) — with glue', ':::', 'Last line.'].join('\n')
    expect(plainWordsProseLines(source)).toEqual(['First line.', 'an item', 'Last line.'])
  })

  it('a token is its label and an italic span is one word when counting; both are silent for glue', () => {
    expect(forCounting('Tap {{button:blue|Build Rev 1 from the picks}} and *a · b* stays. **Bold** too.')).toBe('Tap Build Rev 1 from the picks and quoted stays. Bold too.')
    expect(forGlue('Tap {{button:green|Confirm 14 · pick 2}} then *x · y*.')).not.toMatch(GLUE)
    expect(forGlue('A sentence — glued.')).toMatch(GLUE)
  })
})
