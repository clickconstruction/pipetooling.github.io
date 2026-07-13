import { describe, expect, it } from 'vitest'
import {
  buildHelpGuideRegistry,
  groupGuidesByCategory,
  guideIsRelevantForRole,
  helpGuideQuestionTitle,
  helpGuideSlugFromGlobPath,
  parseHelpGuideFrontmatter,
  type HelpGuide,
} from './helpGuides'

function guideSource(fields: Record<string, string>, body = 'Some body text.'): string {
  const block = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return `---\n${block}\n---\n${body}`
}

describe('helpGuideSlugFromGlobPath', () => {
  it('derives the slug from glob-style paths', () => {
    expect(helpGuideSlugFromGlobPath('../content/help/job-mode-clocking.md')).toBe('job-mode-clocking')
    expect(helpGuideSlugFromGlobPath('/src/content/help/quickfill.md')).toBe('quickfill')
  })
})

describe('parseHelpGuideFrontmatter', () => {
  it('parses key: value fields and returns the body after the closing fence', () => {
    const { fields, body } = parseHelpGuideFrontmatter(
      '---\ntitle: Quickfill\ncategory: Office\nroles: assistant\n---\n## Heading\nBody.',
    )
    expect(fields).toEqual({ title: 'Quickfill', category: 'Office', roles: 'assistant' })
    expect(body).toBe('## Heading\nBody.')
  })

  it('tolerates a missing frontmatter block', () => {
    const { fields, body } = parseHelpGuideFrontmatter('Just markdown.')
    expect(fields).toEqual({})
    expect(body).toBe('Just markdown.')
  })

  it('tolerates CRLF line endings and value colons', () => {
    const { fields } = parseHelpGuideFrontmatter(
      '---\r\ntitle: Ready to Bill: the pipeline\r\ncategory: Billing\r\n---\r\nBody.',
    )
    expect(fields.title).toBe('Ready to Bill: the pipeline')
  })

  it('treats an unterminated fence as body', () => {
    const { fields, body } = parseHelpGuideFrontmatter('---\ntitle: X\nno closing fence')
    expect(fields).toEqual({})
    expect(body).toContain('no closing fence')
  })
})

describe('buildHelpGuideRegistry', () => {
  it('builds and sorts by category, order, then title', () => {
    const guides = buildHelpGuideRegistry({
      'a/z-guide.md': guideSource({ title: 'Zeta', category: 'B Cat', roles: 'all' }),
      'a/second.md': guideSource({ title: 'Second', category: 'A Cat', roles: 'all', order: '20' }),
      'a/first.md': guideSource({ title: 'First', category: 'A Cat', roles: 'all', order: '10' }),
      'a/no-order.md': guideSource({ title: 'Alpha no order', category: 'A Cat', roles: 'all' }),
    })
    expect(guides.map((g) => g.slug)).toEqual(['first', 'second', 'no-order', 'z-guide'])
    expect(guides[3]!.order).toBe(999)
  })

  it('parses roles lists and keywords', () => {
    const [g] = buildHelpGuideRegistry({
      'x/g.md': guideSource({
        title: 'G',
        category: 'C',
        roles: 'subcontractor, helpers',
        keywords: 'clock in, time',
      }),
    })
    expect(g!.roles).toEqual(['subcontractor', 'helpers'])
    expect(g!.keywords).toEqual(['clock in', 'time'])
  })

  it('throws on missing title, missing category, missing roles, empty body', () => {
    expect(() =>
      buildHelpGuideRegistry({ 'x/a.md': guideSource({ category: 'C', roles: 'all' }) }),
    ).toThrow(/missing required frontmatter "title"/)
    expect(() =>
      buildHelpGuideRegistry({ 'x/a.md': guideSource({ title: 'T', roles: 'all' }) }),
    ).toThrow(/missing required frontmatter "category"/)
    expect(() =>
      buildHelpGuideRegistry({ 'x/a.md': guideSource({ title: 'T', category: 'C' }) }),
    ).toThrow(/missing required frontmatter "roles"/)
    expect(() =>
      buildHelpGuideRegistry({ 'x/a.md': guideSource({ title: 'T', category: 'C', roles: 'all' }, '  ') }),
    ).toThrow(/empty body/)
  })

  it('throws on unknown role slugs, naming the guide', () => {
    expect(() =>
      buildHelpGuideRegistry({ 'x/bad.md': guideSource({ title: 'T', category: 'C', roles: 'plumber' }) }),
    ).toThrow(/Help guide "bad": unknown role "plumber"/)
  })

  it('throws on duplicate slugs', () => {
    expect(() =>
      buildHelpGuideRegistry({
        'a/dup.md': guideSource({ title: 'T', category: 'C', roles: 'all' }),
        'b/dup.md': guideSource({ title: 'T2', category: 'C', roles: 'all' }),
      }),
    ).toThrow(/duplicate slug/)
  })
})

describe('guideIsRelevantForRole', () => {
  const guide = (roles: HelpGuide['roles']): HelpGuide => ({
    slug: 's',
    title: 'T',
    category: 'C',
    roles,
    keywords: [],
    order: 1,
    body: 'b',
  })

  it('always matches roles: all', () => {
    expect(guideIsRelevantForRole(guide('all'), 'helpers')).toBe(true)
  })

  it('matches listed roles only, except dev and null see everything', () => {
    const g = guide(['assistant'])
    expect(guideIsRelevantForRole(g, 'assistant')).toBe(true)
    expect(guideIsRelevantForRole(g, 'helpers')).toBe(false)
    expect(guideIsRelevantForRole(g, 'dev')).toBe(true)
    expect(guideIsRelevantForRole(g, null)).toBe(true)
  })
})

describe('helpGuideQuestionTitle', () => {
  it('renders the stored completion as a full question', () => {
    expect(helpGuideQuestionTitle('clock in and out with Job Mode')).toBe(
      'How do I clock in and out with Job Mode?',
    )
  })

  it('trims whitespace and never doubles the question mark', () => {
    expect(helpGuideQuestionTitle('  bill a customer?  ')).toBe('How do I bill a customer?')
  })
})

describe('groupGuidesByCategory', () => {
  it('groups a sorted registry preserving order', () => {
    const guides = buildHelpGuideRegistry({
      'a/a1.md': guideSource({ title: 'A1', category: 'Alpha', roles: 'all', order: '1' }),
      'a/a2.md': guideSource({ title: 'A2', category: 'Alpha', roles: 'all', order: '2' }),
      'a/b1.md': guideSource({ title: 'B1', category: 'Beta', roles: 'all' }),
    })
    const grouped = groupGuidesByCategory(guides)
    expect(grouped.map((g) => g.category)).toEqual(['Alpha', 'Beta'])
    expect(grouped[0]!.guides.map((g) => g.slug)).toEqual(['a1', 'a2'])
  })
})
