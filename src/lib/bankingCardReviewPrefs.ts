/**
 * Pure helpers for the Banking → Card Review tab's device-local prefs (v2.2899).
 *
 * 1. **Kind filter** — the `user_review_rows` RPC returns every non-duplicate
 *    transaction in the window regardless of `kind`, so the pinned "Unassigned"
 *    row used to count transfers, payouts and fees alongside card charges. The
 *    filter narrows the rows *before* the pivot is built; the pivot kernel is
 *    unchanged.
 * 2. **Storage-key migration** — the tab was renamed "Card Review" in v2.1262
 *    but its localStorage keys (and the `?tab=` key) kept saying `user_review`.
 *    The keys now say `card_review`; a value stored under the old key is read
 *    once, copied to the new key and the old key removed, so nobody loses a pref.
 *
 * No React, no Supabase — unit-tested in `bankingCardReviewPrefs.test.ts`.
 */
import { formatMercuryKind } from './mercuryKindLabels'

// ————————————————————————————— kind filter —————————————————————————————

/** Sentinel: no kind filter (every row in the window). */
export const CARD_REVIEW_KIND_ALL = ''
/** Sentinel: only card charges (debit + credit card kinds). */
export const CARD_REVIEW_KIND_CARD_ONLY = '__card__'

/** Mercury `kind` strings that are card charges. */
export const CARD_REVIEW_CARD_KINDS: readonly string[] = ['debitCardTransaction', 'creditCardTransaction']

export type CardReviewKindOption = { value: string; label: string }

export function isCardReviewCardKind(kind: string | null | undefined): boolean {
  return kind != null && CARD_REVIEW_CARD_KINDS.includes(kind)
}

/**
 * Options for the Card Review kind `<select>`: "All kinds", "Card charges only"
 * (only when at least one card kind is present), then each distinct kind in the
 * rows, sorted by display label. Empty/null kinds are ignored.
 */
export function buildCardReviewKindOptions(rows: readonly { kind: string | null }[]): CardReviewKindOption[] {
  const distinct = new Set<string>()
  let anyCard = false
  for (const r of rows) {
    const k = r.kind?.trim() ?? ''
    if (!k) continue
    distinct.add(k)
    if (isCardReviewCardKind(k)) anyCard = true
  }
  const kinds = [...distinct]
    .map((value) => ({ value, label: formatMercuryKind(value) }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
  const out: CardReviewKindOption[] = [{ value: CARD_REVIEW_KIND_ALL, label: 'All kinds' }]
  if (anyCard) out.push({ value: CARD_REVIEW_KIND_CARD_ONLY, label: 'Card charges only' })
  return [...out, ...kinds]
}

/**
 * A stored filter that no longer matches any option (a kind that left the
 * window, or garbage) falls back to "All kinds" so the select never shows a
 * value with no option and the pivot never silently empties.
 */
export function normalizeCardReviewKindFilter(stored: string | null | undefined, options: readonly CardReviewKindOption[]): string {
  if (stored == null) return CARD_REVIEW_KIND_ALL
  return options.some((o) => o.value === stored) ? stored : CARD_REVIEW_KIND_ALL
}

/** Apply the kind filter. Returns the same array instance when nothing is filtered. */
export function filterCardReviewRowsByKind<T extends { kind: string | null }>(rows: readonly T[], filter: string): T[] {
  if (filter === CARD_REVIEW_KIND_ALL) return rows as T[]
  if (filter === CARD_REVIEW_KIND_CARD_ONLY) return rows.filter((r) => isCardReviewCardKind(r.kind))
  return rows.filter((r) => r.kind === filter)
}

// ————————————————————————— storage-key migration —————————————————————————

/** `card_review` localStorage keys with the `user_review` key each one replaces. */
export const CARD_REVIEW_STORAGE_KEYS = {
  hideEmpty: { key: 'banking_mercury_card_review_hide_empty_v1', legacy: 'banking_mercury_user_review_hide_empty_v1' },
  timeWindow: { key: 'banking_mercury_card_review_time_window_v1', legacy: 'banking_mercury_user_review_time_window_v1' },
  chartView: { key: 'banking_mercury_card_review_chart_view_v1', legacy: 'banking_mercury_user_review_chart_view_v1' },
  kindFilter: { key: 'banking_mercury_card_review_kind_filter_v1', legacy: null },
} as const

/** The subset of the DOM `Storage` interface the migration needs (injectable for tests). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Read `key`; when it is unset and `legacy` holds a value, move that value to
 * `key` (write new, remove old) and return it. Never throws — any storage error
 * reads as "unset". A value under the new key always wins over the legacy one.
 */
export function readMigratedStorageItem(storage: StorageLike | null | undefined, key: string, legacy: string | null): string | null {
  if (!storage) return null
  try {
    const current = storage.getItem(key)
    if (current != null) return current
    if (!legacy) return null
    const old = storage.getItem(legacy)
    if (old == null) return null
    storage.setItem(key, old)
    storage.removeItem(legacy)
    return old
  } catch {
    return null
  }
}
