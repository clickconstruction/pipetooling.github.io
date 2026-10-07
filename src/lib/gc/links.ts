/**
 * GC mode (v2.4846): where a GC project opens from anywhere in the app. Today its card on the GC
 * projects page, scrolled into view and outlined (`?focus=<id>`). When the board gives a project
 * its own page (B3-a), this is the one place that changes, and every link follows.
 */
export function gcProjectHref(projectId: string): string {
  return `/gc?focus=${encodeURIComponent(projectId)}`
}

/** Pure: the project a `?focus=` on the GC projects page asks for, or null. */
export function gcFocusFromSearch(search: URLSearchParams): string | null {
  const id = search.get('focus')?.trim()
  return id ? id : null
}

/** The words a GC project carries outside GC mode (the Projects page, the Workflow page, Edit project). */
export const GC_PROJECT_WORDS = {
  chip: 'GC',
  chipTitle: 'A GC project. It opens on GC projects.',
  rowTitle: 'Open on GC projects',
  workflowTitle: 'This is a GC project.',
  workflowBody: 'Its plans, trades and questions are on GC projects.',
  workflowButton: 'Open it on GC projects',
  deleteWarning: 'This is a GC project. Deleting it also deletes its trades, scope lines, sets of plans and questions.',
} as const
