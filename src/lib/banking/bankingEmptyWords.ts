/**
 * What Banking's working tables say when they are empty (punch list #184, sweep C). The Accounting
 * and Drag Sort tabs read the rows the page's Banking filters let through: the account, the kind and
 * the search at the top of the page. When one of them hides every row, Clear the filters resets all
 * three. With no filter on, the Accounting tab's Hide labeled view holds only unlabeled rows, so an
 * empty table there is the good state.
 */
import type { EmptyStateWords } from '../emptyWords'

/** Accounting labels are made on the Drag Sort tab (Add Accounting Label). */
export const ACCOUNTING_LABELS_PATH = '/banking?tab=drag_sort'

export const BANKING_FILTERS_HIDE_ALL = 'No transactions match the Banking filters.'
export const NOTHING_WAITING_FOR_A_LABEL = 'Nothing waiting for a label. Every transaction has an Accounting label.'
export const NO_TRANSACTIONS_YET = 'No transactions yet.'

export function bankingTableEmptyWords(s: {
  /** Present only while a Banking filter is on: it clears the account, the kind and the search. */
  clearBankingFilters: (() => void) | null
  /** The table holds unlabeled rows only (Accounting with Hide labeled on). */
  unlabeledOnly: boolean
}): EmptyStateWords {
  if (s.clearBankingFilters) return { main: BANKING_FILTERS_HIDE_ALL, next: { label: 'Clear the filters', onPress: s.clearBankingFilters } }
  return { main: s.unlabeledOnly ? NOTHING_WAITING_FOR_A_LABEL : NO_TRANSACTIONS_YET }
}
