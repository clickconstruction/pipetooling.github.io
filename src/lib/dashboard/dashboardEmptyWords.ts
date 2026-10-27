/**
 * Empty words for the Dashboard and its inboxes (punch list #184, sweep C): what each card,
 * section and window on the Dashboard says when its list has no rows, in `EmptyState`'s shape
 * (`main`, the press, `tail`). The rule is `emptyWords.ts`'s: a list says what fills it and offers
 * the press, a search with no match quotes the search and offers Clear the search, and a list
 * whose empty is the good state says so, in the Needs you card's voice (*Nothing waits on you.*).
 * Each helper takes the surface's own handler, so the words and the press travel together and the
 * component only wires them. `dashboardEmptyWords.test.ts` fires every press and holds every
 * sentence to plain words.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'

type Press = () => void

/** Jobs → Stages: every job by stage, where a job moves toward Ready to bill. */
export const JOBS_STAGES_PATH = '/jobs?tab=stages'

/** Jobs → Reports, where a report is written with New report. */
export const JOBS_REPORTS_PATH = '/jobs?tab=reports'

/** A list a search emptied, in the kernel's words: *No customers match ‘Ridgeway’. Clear the search ▸* */
export function searchEmptyWords(noun: string, query: string, clearSearch: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query }), { onPress: clearSearch })
}

/** A list the filters emptied, with no search typed: *No customers match the filters. Clear the filters ▸* */
export function filtersEmptyWords(noun: string, clearFilters: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query: '' }), { onPress: clearFilters })
}

// The good states: empty means nobody waits

/** The Needs you card with nothing of the viewer's own: the model words for the Dashboard. */
export const NEEDS_YOU_EMPTY: EmptyStateWords = { main: 'Nothing waits on you.' }

/** A queue the viewer clears, empty: My team's Pending approval, Field: Waiting for Approval. */
export const WAITING_ON_YOU_EMPTY: EmptyStateWords = { main: emptyWords({ kind: 'waiting', who: 'you' }).main }

/** The Dispatch inbox with no request, open or closed. */
export const DISPATCH_INBOX_EMPTY: EmptyStateWords = {
  main: emptyWords({ kind: 'waiting', who: 'dispatch' }).main,
  tail: 'A request lands here when someone presses Send to Dispatch.',
}

/** A closed-only Dispatch list with nothing in it. */
export const DISPATCH_CLOSED_EMPTY: EmptyStateWords = { main: 'Nothing closed yet.', tail: 'A request lands here once dispatch closes it.' }

/** The Estimator inbox with no request. */
export const ESTIMATOR_INBOX_EMPTY: EmptyStateWords = {
  main: emptyWords({ kind: 'waiting', who: 'an estimator' }).main,
  tail: 'A request lands here when someone presses Send to Estimator Inbox.',
}

/** The dev's Help feedback inbox with no feedback. */
export const HELP_FEEDBACK_EMPTY: EmptyStateWords = {
  main: emptyWords({ kind: 'waiting', who: 'you' }).main,
  tail: 'Feedback lands here when someone presses Send feedback on a help guide.',
}

/** Ready to bill with nothing ready: the jobs still in progress are on Jobs → Stages. */
export const READY_TO_BILL_EMPTY: EmptyStateWords = { main: 'Nothing is ready to bill.', next: { label: 'Stages', to: JOBS_STAGES_PATH }, tail: 'shows what is still in progress.' }

/** The Lien release queue with every cleared conditional answered. */
export const LIEN_RELEASE_QUEUE_EMPTY: EmptyStateWords = {
  main: emptyWords({ kind: 'waiting', who: 'you' }).main,
  tail: 'Every cleared conditional release has its unconditional version.',
}

/** Waivers to sign, none left. */
export const LIEN_WAIVERS_TO_SIGN_EMPTY: EmptyStateWords = { main: 'Nothing waits for your signature.' }

/** My bids with every bid sent: the sent ones sit below. */
export const MY_BIDS_UNSENT_EMPTY: EmptyStateWords = { main: 'Nothing unsent.', tail: 'Every bid went out.' }

/** My crew → Reports owed with nothing owed: the filed count when there are job-days, else the plain good state. */
export function supervisorReportsOwedEmptyWords(filed: number): EmptyStateWords {
  if (filed > 0) return { main: 'Every job-day you supervised has a report.', tail: `${filed} filed.` }
  return { main: 'Nothing owed.' }
}

// Facts: nobody did the thing yet, and the next step is someone else's

/** The team strip's Clocked in today with no session yet. */
export const TEAM_CLOCKED_IN_TODAY_EMPTY: EmptyStateWords = { main: 'Nobody has clocked in yet today.' }

/** My crew → My crew's hours with nobody on a supervised job-day. */
export const SUPERVISOR_CREW_EMPTY: EmptyStateWords = { main: 'Nobody clocked on a job-day you supervised.' }

// Lists with a press of their own

/**
 * AR by customer: a search with no match, the pace or lien lenses hiding every customer, or no
 * open bill at all. Collections sits outside the list, so *Every bill is paid.* is said only when
 * nothing is parked there either. No `clearSearch` (a host that owns no search) draws the sentence alone.
 */
export function arCustomersEmptyWords(s: { query: string; filtered: boolean; hasCollections: boolean; clearSearch: Press | null; clearFilters: Press }): EmptyStateWords {
  if (s.query.trim()) return s.clearSearch ? searchEmptyWords('customers', s.query, s.clearSearch) : { main: emptyWords({ kind: 'filter', noun: 'customers', query: s.query }).main }
  if (s.filtered) return filtersEmptyWords('customers', s.clearFilters)
  const waiting = emptyWords({ kind: 'waiting', who: 'a customer' }).main
  return s.hasCollections ? { main: waiting } : { main: waiting, tail: 'Every bill is paid.' }
}

/** The Financials drill window (AR, AP, Not billed): the search, or the age band, hides every item. */
export function financeDrillEmptyWords(s: { query: string; clearSearch: Press; clearFilters: Press }): EmptyStateWords {
  return s.query.trim() ? searchEmptyWords('items', s.query, s.clearSearch) : filtersEmptyWords('items', s.clearFilters)
}

/** My time with nothing clocked this week: Last week opens the week before, unless it is already open. */
export function myTimeWeekEmptyWords(showLastWeek: Press | null): EmptyStateWords {
  const main = 'Nothing clocked this week.'
  return showLastWeek ? { main, next: { label: 'Last week', onPress: showLastWeek }, tail: 'shows the week before.' } : { main }
}

/**
 * The stale purchases window: Stale hiding every purchase that is still to sort (To sort shows
 * them), or nothing at all waiting on the people the viewer follows up with.
 */
export function staleFollowUpEmptyWords(s: { staleOnly: boolean; anyRows: boolean; showToSort: Press }): EmptyStateWords {
  if (s.staleOnly && s.anyRows) return { main: 'Nothing overdue. Every purchase left is newer than the cutoff.', next: { label: 'To sort', onPress: s.showToSort }, tail: 'lists them.' }
  return { main: 'Nothing waiting on the people you follow up with.' }
}

/** Assigned jobs, after a search. */
export function assignedJobsSearchEmptyWords(query: string, clearSearch: Press): EmptyStateWords {
  return searchEmptyWords('assigned jobs', query, clearSearch)
}

/** Crew day with nothing on the day: the pager's Previous day shows the day before. */
export function crewDayEmptyWords(previousDay: Press): EmptyStateWords {
  return { main: 'No crew activity on this day.', next: { label: 'Previous day', onPress: previousDay }, tail: 'shows the day before.' }
}

/** Crew day for a superintendent whose day holds only office staff, folded away. */
export function crewDayOfficeOnlyEmptyWords(showOfficeStaff: Press): EmptyStateWords {
  return { main: 'Only office staff have activity on this day.', next: { label: 'Show office staff', onPress: showOfficeStaff } }
}

/** My Schedule's Today or Tomorrow with no block: + Add job puts a job on the viewer's day. */
export function myScheduleDayEmptyWords(day: 'today' | 'tomorrow', addJob: Press): EmptyStateWords {
  return { main: `Nothing scheduled ${day}.`, next: { label: '+ Add job', onPress: addJob }, tail: 'puts a job on your day.' }
}

/**
 * Recent Reports with no report yet. A person who only files reports writes them from the card
 * above; everyone else gets Jobs → Reports, where New report is.
 */
export function recentReportsEmptyWords(reportsOnly: boolean): EmptyStateWords {
  if (reportsOnly) return { main: 'No reports yet.', tail: 'Create one above.' }
  return { main: 'No reports yet.', next: { label: 'Reports', to: JOBS_REPORTS_PATH }, tail: 'is where you write one.' }
}
