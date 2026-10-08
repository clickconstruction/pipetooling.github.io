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

/** Follow up on the GC projects page: the companies to call about a quote (the Dashboard's Needs you line). */
export const GC_FOLLOW_UP_HREF = '/gc?view=followUp'

/** Pure: the view a `?view=` on the GC projects page opens on, or the board. A dev's own views open from their pills only. */
export function gcViewFromSearch(search: URLSearchParams): 'board' | 'partners' | 'followUp' {
  const view = search.get('view')
  return view === 'partners' || view === 'followUp' ? view : 'board'
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
