import { describe, expect, it } from 'vitest'
import type { HelpGuide } from './helpGuides'
import { searchHelpGuides } from './helpGuideSearch'

function guide(partial: Partial<HelpGuide> & { slug: string }): HelpGuide {
  return {
    title: partial.slug,
    category: 'General',
    roles: 'all',
    keywords: [],
    order: 1,
    body: '',
    ...partial,
  }
}

const GUIDES: HelpGuide[] = [
  guide({ slug: 'clocking', title: 'Job Mode & Clocking', keywords: ['time tracking'], body: 'Tap Clock In.' }),
  guide({ slug: 'billing', title: 'Ready to Bill', category: 'Billing & Money', body: 'Clock sessions feed hours.' }),
  guide({ slug: 'quickfill', title: 'Quickfill', keywords: ['daily rhythm'], body: 'Office morning routine.' }),
]

describe('searchHelpGuides', () => {
  it('returns no matches for empty or whitespace queries', () => {
    expect(searchHelpGuides('', GUIDES).matches).toEqual([])
    expect(searchHelpGuides('   ', GUIDES).normalizedQuery).toBe('')
  })

  it('ranks title hits above keyword, category, and body hits', () => {
    const { matches } = searchHelpGuides('clock', GUIDES)
    // 'clocking' matches in title (100); 'billing' only in body (10).
    expect(matches.map((m) => m.slug)).toEqual(['clocking', 'billing'])
    expect(matches[0]!.score).toBeGreaterThan(matches[1]!.score)
  })

  it('scores keyword above category above body', () => {
    const guides = [
      guide({ slug: 'kw', keywords: ['widget'], title: 'A' }),
      guide({ slug: 'cat', category: 'Widget Ops', title: 'B' }),
      guide({ slug: 'body', body: 'about widgets', title: 'C' }),
    ]
    const { matches } = searchHelpGuides('widget', guides)
    expect(matches.map((m) => m.slug)).toEqual(['kw', 'cat', 'body'])
  })

  it('requires every token to match somewhere (AND)', () => {
    const { matches } = searchHelpGuides('clock office', GUIDES)
    expect(matches).toEqual([])
    const both = searchHelpGuides('quickfill morning', GUIDES)
    expect(both.matches.map((m) => m.slug)).toEqual(['quickfill'])
  })

  it('is case-insensitive and breaks ties by input order', () => {
    const guides = [
      guide({ slug: 'first', title: 'Dispatch One' }),
      guide({ slug: 'second', title: 'Dispatch Two' }),
    ]
    const { matches } = searchHelpGuides('DISPATCH', guides)
    expect(matches.map((m) => m.slug)).toEqual(['first', 'second'])
  })
})
