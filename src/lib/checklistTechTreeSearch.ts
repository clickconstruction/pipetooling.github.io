/**
 * Client-side search for the Checklist Roadmap graph (group cards + task rows).
 * Matches: group title, task title, and assignee label text (case-insensitive substring).
 */

export type RoadmapSearchInputGroup = { id: string; title: string }
export type RoadmapSearchInputTask = {
  id: string
  groupId: string
  title: string
  /** Preformatted assignee list for display/search, e.g. "Alice, Bob" */
  assigneeLabel: string
}

export type RoadmapSearchResult = {
  /** Trimmed, lowercased, or "" when no effective query */
  normalizedQuery: string
  /** Group id when the group title matches */
  groupIdsWithTitleMatch: string[]
  /** Group with title match and/or a matching task in the group (for auto-expand) */
  groupIdsWithAnyMatch: string[]
  taskIdsMatching: string[]
  /** Count of "hits" for UI: 1 per title-matched group + 1 per matching task row */
  matchCount: number
}

export function computeRoadmapSearchMatches(
  query: string,
  input: { groups: RoadmapSearchInputGroup[]; tasks: RoadmapSearchInputTask[] },
): RoadmapSearchResult {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return {
      normalizedQuery: '',
      groupIdsWithTitleMatch: [],
      groupIdsWithAnyMatch: [],
      taskIdsMatching: [],
      matchCount: 0,
    }
  }

  const groupIdsWithTitleMatch: string[] = []
  for (const g of input.groups) {
    if (g.title.toLowerCase().includes(normalizedQuery)) {
      groupIdsWithTitleMatch.push(g.id)
    }
  }

  const taskIdsMatching: string[] = []
  const groupIdsFromTasks = new Set<string>()
  for (const t of input.tasks) {
    const tMatch = t.title.toLowerCase().includes(normalizedQuery)
    const aMatch = t.assigneeLabel.toLowerCase().includes(normalizedQuery)
    if (tMatch || aMatch) {
      taskIdsMatching.push(t.id)
      groupIdsFromTasks.add(t.groupId)
    }
  }

  const groupIdsWithAnyMatch = Array.from(
    new Set([...groupIdsWithTitleMatch, ...groupIdsFromTasks]),
  ).sort((a, b) => a.localeCompare(b))

  const matchCount = groupIdsWithTitleMatch.length + taskIdsMatching.length

  return {
    normalizedQuery,
    groupIdsWithTitleMatch,
    groupIdsWithAnyMatch,
    taskIdsMatching,
    matchCount,
  }
}

export type HighlightSegment = { text: string; hit: boolean }

/**
 * Split `text` into segments around every case-insensitive occurrence of
 * `normalizedQuery` (already trimmed + lowercased — pass
 * RoadmapSearchResult.normalizedQuery) so the canvas can wrap the exact
 * matching characters in a mark. Empty query, or no occurrence, returns the
 * whole text as one non-hit segment. Preserves the original casing.
 */
export function splitTextForHighlight(text: string, normalizedQuery: string): HighlightSegment[] {
  if (!normalizedQuery) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const segments: HighlightSegment[] = []
  let cursor = 0
  for (;;) {
    const at = lower.indexOf(normalizedQuery, cursor)
    if (at === -1) break
    if (at > cursor) segments.push({ text: text.slice(cursor, at), hit: false })
    segments.push({ text: text.slice(at, at + normalizedQuery.length), hit: true })
    cursor = at + normalizedQuery.length
  }
  if (segments.length === 0) return [{ text, hit: false }]
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}
