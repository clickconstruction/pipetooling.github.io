/**
 * Client-side search over the bundled help guides (tokenized AND-match with
 * tiered field scoring). House-style pure kernel — substring matching like
 * checklistTechTreeSearch, plus a small rank so title hits beat body hits.
 */
import type { HelpGuide } from './helpGuides'

export type HelpGuideSearchMatch = { slug: string; score: number }

export type HelpGuideSearchResult = {
  /** Trimmed, lowercased, or "" when no effective query. */
  normalizedQuery: string
  /** Score desc; ties keep the registry (input) order. Empty when no query. */
  matches: HelpGuideSearchMatch[]
}

const TITLE_SCORE = 100
const KEYWORD_SCORE = 50
const CATEGORY_SCORE = 25
const BODY_SCORE = 10

/**
 * The page prompts "How do I…", so users often type the whole question —
 * strip the leading question phrase so tokens match guide titles (which are
 * stored as sentence completions).
 */
const LEADING_QUESTION_PHRASE =
  /^(?:how\s+(?:do|can|would|should)\s+(?:i|we|you)\s+|how\s+to\s+|how\s+do\s+i\s*)/i

export function searchHelpGuides(
  query: string,
  guides: readonly HelpGuide[],
): HelpGuideSearchResult {
  const normalizedQuery = query
    .trim()
    .replace(LEADING_QUESTION_PHRASE, '')
    .replace(/\?+\s*$/, '')
    .trim()
    .toLowerCase()
  if (!normalizedQuery) {
    return { normalizedQuery: '', matches: [] }
  }
  const tokens = normalizedQuery.split(/\s+/)

  const scored: Array<HelpGuideSearchMatch & { inputIndex: number }> = []
  guides.forEach((g, inputIndex) => {
    const title = g.title.toLowerCase()
    const keywords = g.keywords.join(' ').toLowerCase()
    const category = g.category.toLowerCase()
    const body = g.body.toLowerCase()
    let score = 0
    for (const token of tokens) {
      // Best field tier wins per token; a token matching nowhere excludes the guide (AND).
      if (title.includes(token)) score += TITLE_SCORE
      else if (keywords.includes(token)) score += KEYWORD_SCORE
      else if (category.includes(token)) score += CATEGORY_SCORE
      else if (body.includes(token)) score += BODY_SCORE
      else {
        score = -1
        break
      }
    }
    if (score > 0) scored.push({ slug: g.slug, score, inputIndex })
  })

  scored.sort((a, b) => b.score - a.score || a.inputIndex - b.inputIndex)
  return {
    normalizedQuery,
    matches: scored.map(({ slug, score }) => ({ slug, score })),
  }
}
