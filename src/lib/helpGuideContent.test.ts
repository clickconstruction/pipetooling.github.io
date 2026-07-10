/**
 * Conformance test over the REAL guide content in src/content/help/ — any PR
 * that adds or edits a guide with bad frontmatter (missing title/category/roles,
 * unknown role, duplicate slug, empty body) fails here in CI.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildHelpGuideRegistry } from './helpGuides'

const CONTENT_DIR = join(__dirname, '../content/help')

function loadContent(): Record<string, string> {
  const record: Record<string, string> = {}
  for (const file of readdirSync(CONTENT_DIR)) {
    if (!file.endsWith('.md')) continue
    record[`../content/help/${file}`] = readFileSync(join(CONTENT_DIR, file), 'utf8')
  }
  return record
}

describe('help guide content', () => {
  it('every guide has valid frontmatter and a body', () => {
    const guides = buildHelpGuideRegistry(loadContent())
    expect(guides.length).toBeGreaterThanOrEqual(8)
  })

  it('guides use h2+ headings (h1 is the page title from frontmatter)', () => {
    const guides = buildHelpGuideRegistry(loadContent())
    for (const g of guides) {
      expect(/^# /m.test(g.body), `guide "${g.slug}" uses a top-level # heading`).toBe(false)
    }
  })

  it('titles are completions of "How do I…" (no leading "how", no trailing "?")', () => {
    const guides = buildHelpGuideRegistry(loadContent())
    for (const g of guides) {
      expect(/^how\b/i.test(g.title), `guide "${g.slug}" title starts with "how"`).toBe(false)
      expect(g.title.endsWith('?'), `guide "${g.slug}" title ends with "?"`).toBe(false)
      expect(/^[a-z]/.test(g.title), `guide "${g.slug}" title should start lowercase`).toBe(true)
    }
  })
})
