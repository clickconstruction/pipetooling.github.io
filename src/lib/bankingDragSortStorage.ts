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
