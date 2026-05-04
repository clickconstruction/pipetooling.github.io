/** Per-user preference: Drag Sort table hides rows that already have an Accounting Label. */
const STORAGE_PREFIX = 'banking_drag_sort_hide_labeled_v1_'

export function readDragSortHideLabeledTransactions(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function writeDragSortHideLabeledTransactions(userId: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(STORAGE_PREFIX + userId, '1')
    else window.localStorage.removeItem(STORAGE_PREFIX + userId)
  } catch {
    /* quota or private mode */
  }
}

/** Per-user preference: Drag Sort Accounting Labels sidebar cards expanded (default true). */
const LABELS_CARDS_EXPANDED_PREFIX = 'banking_drag_sort_labels_cards_expanded_v1_'

export function readDragSortLabelsCardsExpanded(userId: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(LABELS_CARDS_EXPANDED_PREFIX + userId) !== '0'
  } catch {
    return true
  }
}

export function writeDragSortLabelsCardsExpanded(userId: string, expanded: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (expanded) window.localStorage.removeItem(LABELS_CARDS_EXPANDED_PREFIX + userId)
    else window.localStorage.setItem(LABELS_CARDS_EXPANDED_PREFIX + userId, '0')
  } catch {
    /* quota or private mode */
  }
}

/** Per-user: Drag Sort Accounting Labels sidebar is in "reorder labels" mode (paused tx→label drops). */
const REORDER_LABELS_PREFIX = 'banking_drag_sort_reorder_labels_v1_'

export function readDragSortLabelsReorderMode(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(REORDER_LABELS_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function writeDragSortLabelsReorderMode(userId: string, reorder: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (reorder) window.localStorage.setItem(REORDER_LABELS_PREFIX + userId, '1')
    else window.localStorage.removeItem(REORDER_LABELS_PREFIX + userId)
  } catch {
    /* quota or private mode */
  }
}

/** Per-user: Banking Accounting tab hides rows that already have an Accounting Label (separate from Drag Sort). Default **on**: absence of key means hide; **`'0'`** = user turned hide off (mirrors labels-cards-expanded pattern). Legacy **`'1'`** still reads as hide on. */
const ACCOUNTING_HIDE_LABELED_PREFIX = 'banking_accounting_hide_labeled_v1_'

export function readAccountingHideLabeledTransactions(userId: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ACCOUNTING_HIDE_LABELED_PREFIX + userId) !== '0'
  } catch {
    return true
  }
}

export function writeAccountingHideLabeledTransactions(userId: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.removeItem(ACCOUNTING_HIDE_LABELED_PREFIX + userId)
    else window.localStorage.setItem(ACCOUNTING_HIDE_LABELED_PREFIX + userId, '0')
  } catch {
    /* quota or private mode */
  }
}

/** Per-user JSON for Banking Mercury Accounting ledger modal filters (`BankingAccountingLedgerFiltersV1`). */
const ACCOUNTING_LEDGER_FILTERS_PREFIX = 'banking_accounting_ledger_filters_v1_'

export function readAccountingLedgerFiltersRaw(userId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACCOUNTING_LEDGER_FILTERS_PREFIX + userId)
  } catch {
    return null
  }
}

export function writeAccountingLedgerFiltersRaw(userId: string, json: string | null): void {
  if (typeof window === 'undefined') return
  const key = ACCOUNTING_LEDGER_FILTERS_PREFIX + userId
  try {
    if (json == null || json === '') window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, json)
  } catch {
    /* quota or private mode */
  }
}

export function clearAccountingLedgerFiltersStorage(userId: string): void {
  writeAccountingLedgerFiltersRaw(userId, null)
}

/** Per-user: Banking Mercury Accounting **Rules** section shows the rules table (default expanded). **`'0'`** = collapsed body; header actions stay visible. Same pattern as **`readDragSortLabelsCardsExpanded`**. */
const ACCOUNTING_RULES_SECTION_EXPANDED_PREFIX = 'banking_accounting_rules_section_expanded_v1_'

export function readAccountingRulesSectionExpanded(userId: string): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ACCOUNTING_RULES_SECTION_EXPANDED_PREFIX + userId) !== '0'
  } catch {
    return true
  }
}

export function writeAccountingRulesSectionExpanded(userId: string, expanded: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (expanded) window.localStorage.removeItem(ACCOUNTING_RULES_SECTION_EXPANDED_PREFIX + userId)
    else window.localStorage.setItem(ACCOUNTING_RULES_SECTION_EXPANDED_PREFIX + userId, '0')
  } catch {
    /* quota or private mode */
  }
}
