/**
 * Empty words for Customers and a customer's page (punch list #184, sweep C): what the customer
 * list, a customer's bids window, the Customer Hub's cards and tabs and the customer notes say when
 * a list has no rows, in `EmptyState`'s shape (`main`, the press, `tail`). The rule is
 * `emptyWords.ts`'s: a list says what fills it and offers the press, a search with no match quotes
 * the search and offers Clear the search, and a list whose empty is the good state says so. Each
 * helper takes the page's own handler. `customersEmptyWords.test.ts` fires every press and holds
 * every sentence to plain words.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import { NEW_BID_PATH } from '../bids/bidPickerEmptyWords'
import { NEW_ESTIMATE_CONTROL, NEW_ESTIMATE_PATH } from '../estimates/estimatesEmptyWords'
import type { ActivityFamily } from './customerActivityFeed'

type Press = () => void

/** The Jobs page opens New Job on this link (`pages/Jobs.tsx`, the search doors' "New job"). */
export const NEW_JOB_PATH = '/jobs?tab=stages&newJob=true'

/** The Customers page's make button. */
export const ADD_CUSTOMER_CONTROL = 'Add customer'

/**
 * The customer list: no customer at all (Add customer), Show similar finding no pair (Show all),
 * a search with no match, or the type and lens chips hiding every customer.
 */
export function customersListEmptyWords(s: { total: number; similar: boolean; query: string; addCustomer: Press | null; clearSearch: Press; clearFilters: Press; showAll: Press }): EmptyStateWords {
  if (s.total === 0) {
    const words = emptyWords({ kind: 'make', noun: 'customers', control: ADD_CUSTOMER_CONTROL })
    return s.addCustomer ? emptyWordsWithPress(words, { onPress: s.addCustomer }) : { main: words.main }
  }
  if (s.similar) return { main: 'No two customers share a name, address, phone or email.', next: { label: 'Show all', onPress: s.showAll } }
  if (s.query.trim()) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'customers', query: s.query }), { onPress: s.clearSearch })
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'customers', query: '' }), { onPress: s.clearFilters })
}

/** A customer's bids window that came back empty: New Bid opens the bid form on the Bids page. */
export const CUSTOMER_BIDS_EMPTY: EmptyStateWords = { main: 'No bids for this customer yet.', next: { label: 'New Bid', to: NEW_BID_PATH }, tail: 'adds the first.' }

/** The Hub's Open jobs card: no job at all, or every job paid. */
export function customerOpenJobsEmptyWords(totalJobs: number): EmptyStateWords {
  return totalJobs === 0 ? { main: 'No jobs yet.' } : { main: 'Nothing open.', tail: 'Every job is paid.' }
}

/** The Hub's Activity feed: a filter chip hiding every event (All shows them), or nothing on the feed yet. */
export function customerFeedEmptyWords(filter: ActivityFamily | 'all', showAll: Press): EmptyStateWords {
  if (filter !== 'all') return { main: 'Nothing for this filter.', next: { label: 'All', onPress: showAll }, tail: 'shows every event.' }
  return { main: 'Nothing in the feed yet.', tail: 'Jobs, payments and notes land here as they happen.' }
}

/** The Hub's Estimates tab with none: New estimate opens a fresh draft on the Estimates page. */
export const CUSTOMER_ESTIMATES_EMPTY: EmptyStateWords = { main: 'No estimates for this customer yet.', next: { label: NEW_ESTIMATE_CONTROL, to: NEW_ESTIMATE_PATH }, tail: 'starts one.' }

/** The Hub's Jobs tab with none: New Job for a role that makes jobs, the sentence alone for the rest. */
export function customerJobsEmptyWords(canMakeJobs: boolean): EmptyStateWords {
  const main = 'No jobs for this customer yet.'
  return canMakeJobs ? { main, next: { label: 'New Job', to: NEW_JOB_PATH }, tail: 'adds the first.' } : { main }
}

/** The Hub's Invoices tab with none: billing a job fills it. */
export const CUSTOMER_INVOICES_EMPTY: EmptyStateWords = { main: 'No invoices for this customer yet.', tail: 'A bill lands here once one of their jobs is billed.' }

/** Customer notes with none: Add row opens the new-note row. */
export function customerNotesEmptyWords(addRow: Press): EmptyStateWords {
  return { main: 'No notes yet.', next: { label: 'Add row', onPress: addRow }, tail: 'adds the first.' }
}
