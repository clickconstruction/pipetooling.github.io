import {
  DEFAULT_MERCURY_LEDGER_SORT,
  parseMercuryLedgerSortJson,
  type MercuryLedgerSortState,
} from './bankingMercuryLedgerTableSort'

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

/**
 * Per-user: Banking Accounting tab auto-runs the Apply rules flow on every
 * transaction load (mount, Refresh from Mercury, Backfill, Reload table, and
 * the silent reload after `onAfterAssignmentChange`). Default **off**:
 * presence of `'1'` = on, anything else = off — opt-in for safety so flipping
 * it on doesn't silently spawn pending suggestions on first visit.
 *
 * When on, `BankingMercuryAccountingTab` skips the 200-match confirm modal
 * and goes straight to `executeApplyRules`, which still respects the
 * `APPLY_RULES_PER_CLICK_CAP = 500` per-pass cap and toasts the
 * `Created N. M more match — apply again after reviewing.` cue.
 */
const ACCOUNTING_APPLY_RULES_DEFAULT_PREFIX = 'banking_accounting_apply_rules_default_v1_'

export function readAccountingApplyRulesByDefault(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ACCOUNTING_APPLY_RULES_DEFAULT_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function writeAccountingApplyRulesByDefault(userId: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(ACCOUNTING_APPLY_RULES_DEFAULT_PREFIX + userId, '1')
    else window.localStorage.removeItem(ACCOUNTING_APPLY_RULES_DEFAULT_PREFIX + userId)
  } catch {
    /* quota or private mode */
  }
}

/**
 * Per-user: Banking Accounting tab auto-runs the **Approve all** flow on
 * every refresh of the pending-approvals list. Default **off**: presence of
 * `'1'` = on, anything else = off — opt-in for safety because approving
 * commits the rule's suggested label to `mercury_transaction_drag_sort_assignments`
 * (single source of truth for accounting labels), so flipping the toggle on
 * effectively trusts the rules engine to label without per-row review.
 *
 * Pairs with `Apply rules by default` (v2.580) to close the loop: rules
 * create pending suggestions automatically, and approve-by-default commits
 * them automatically. Internal Transfers conflicts (job-split rows) are
 * still skipped by the underlying `handleApproveAll`, so those persist in
 * the pending list and surface a manual review prompt.
 */
const ACCOUNTING_APPROVE_BY_DEFAULT_PREFIX = 'banking_accounting_approve_by_default_v1_'

export function readAccountingApproveByDefault(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ACCOUNTING_APPROVE_BY_DEFAULT_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function writeAccountingApproveByDefault(userId: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(ACCOUNTING_APPROVE_BY_DEFAULT_PREFIX + userId, '1')
    else window.localStorage.removeItem(ACCOUNTING_APPROVE_BY_DEFAULT_PREFIX + userId)
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

/** Per-user JSON for Accounting Sorting Ledger column sort (`MercuryLedgerSortState`). */
const ACCOUNTING_LEDGER_SORT_PREFIX = 'banking_accounting_ledger_sort_v1_'

export function readAccountingLedgerSort(userId: string): MercuryLedgerSortState {
  if (typeof window === 'undefined') return DEFAULT_MERCURY_LEDGER_SORT
  try {
    return parseMercuryLedgerSortJson(
      window.localStorage.getItem(ACCOUNTING_LEDGER_SORT_PREFIX + userId),
    )
  } catch {
    return DEFAULT_MERCURY_LEDGER_SORT
  }
}

export function writeAccountingLedgerSort(userId: string, state: MercuryLedgerSortState): void {
  if (typeof window === 'undefined') return
  const key = ACCOUNTING_LEDGER_SORT_PREFIX + userId
  try {
    if (
      state.key === DEFAULT_MERCURY_LEDGER_SORT.key &&
      state.dir === DEFAULT_MERCURY_LEDGER_SORT.dir
    ) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, JSON.stringify(state))
    }
  } catch {
    /* quota or private mode */
  }
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

/** Per-user: Banking Mercury Accounting **Approvals** section groups pending suggestions by suggested label. Default **off** (flat list): presence of `'1'` = grouped. Same opt-in pattern as **`readAccountingApplyRulesByDefault`**. */
const ACCOUNTING_APPROVALS_GROUP_BY_LABEL_PREFIX = 'banking_accounting_approvals_group_by_label_v1_'

export function readAccountingApprovalsGroupByLabel(userId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(ACCOUNTING_APPROVALS_GROUP_BY_LABEL_PREFIX + userId) === '1'
  } catch {
    return false
  }
}

export function writeAccountingApprovalsGroupByLabel(userId: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (value) window.localStorage.setItem(ACCOUNTING_APPROVALS_GROUP_BY_LABEL_PREFIX + userId, '1')
    else window.localStorage.removeItem(ACCOUNTING_APPROVALS_GROUP_BY_LABEL_PREFIX + userId)
  } catch {
    /* quota or private mode */
  }
}

/** Banking Mercury User Review view mode: pivot **table** (default) or **pie** chart. Device-global (matches this tab's other prefs). */
export type UserReviewChartView = 'table' | 'pie'
const USER_REVIEW_CHART_VIEW_KEY = 'banking_mercury_user_review_chart_view_v1'

export function readUserReviewChartView(): UserReviewChartView {
  if (typeof window === 'undefined') return 'table'
  try {
    return window.localStorage.getItem(USER_REVIEW_CHART_VIEW_KEY) === 'pie' ? 'pie' : 'table'
  } catch {
    return 'table'
  }
}

export function writeUserReviewChartView(value: UserReviewChartView): void {
  if (typeof window === 'undefined') return
  try {
    if (value === 'pie') window.localStorage.setItem(USER_REVIEW_CHART_VIEW_KEY, 'pie')
    else window.localStorage.removeItem(USER_REVIEW_CHART_VIEW_KEY)
  } catch {
    /* quota or private mode */
  }
}
