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
