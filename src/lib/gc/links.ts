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

/** Money on the GC projects page, the money team's lens: the Monday money email's Open Money (O7b). */
export const GC_MONEY_HREF = '/gc?view=money'

/** Messages on the GC projects page (cut 1): every person the office talks with, and their threads. */
export const GC_MESSAGES_HREF = '/gc?view=messages'

/**
 * One person's thread over Messages, opened at a line when one is named (`useThreadWindow`'s `?thread=` and `?at=`).
 * A line in a Pipeline job's Job activity opens it (cut 10).
 */
export function messagesThreadHref(contactId: string, messageId?: string | null): string {
  const at = messageId ? `&at=${encodeURIComponent(messageId)}` : ''
  return `${GC_MESSAGES_HREF}&thread=${encodeURIComponent(contactId)}${at}`
}

/** The GC projects page's views, one pill each. */
export type GcView = 'board' | 'partners' | 'customers' | 'followUp' | 'money' | 'messages'

/**
 * Money → Bill day → From the trades for one job (Messages cut 9): the trades' draws against the bill day. Follow up's
 * trades-not-in head, the flow's pay application round and By step's Draws row open it here.
 */
export function billDayHref(projectId: string): string {
  return `/gc?view=money&billday=${encodeURIComponent(projectId)}`
}

/** Pure: the job a `?billday=` opens Bill day's From the trades on, or null. */
export function billDayFromSearch(search: URLSearchParams): string | null {
  const id = search.get('billday')?.trim()
  return id ? id : null
}

/**
 * Pure: the view a `?view=` on the GC projects page opens on, or the board. A dev's own views open from their pills
 * only. Money opens for the money team; the page shows anyone else Follow up in its place.
 */
export function gcViewFromSearch(search: URLSearchParams): GcView {
  const view = search.get('view')
  return view === 'partners' || view === 'customers' || view === 'followUp' || view === 'money' || view === 'messages' ? view : 'board'
}

/** Customers on the GC projects page (Messages cut 4): every customer by step, or one row each. */
export const GC_CUSTOMERS_HREF = '/gc?view=customers'

/** How Trade partners or Customers shows its companies (Messages cut 4): the list as it was, or a board. */
export type BoardBy = 'list' | 'step' | 'company' | 'trade'

const BOARD_BYS: readonly string[] = ['list', 'step', 'company', 'trade'] satisfies BoardBy[]

/** Pure: the board a `?by=` asks for, or null for the view's first. */
export function gcBoardByFromSearch(search: URLSearchParams): BoardBy | null {
  const by = search.get('by')
  return by && BOARD_BYS.includes(by) ? (by as BoardBy) : null
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
