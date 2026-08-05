import { formatAppliedVersionPlainDate, isoToPlainDateInAppTz } from './personContractAppliedDate'

/**
 * Effective version-date resolution for Contract Book rows (v2.1399).
 *
 * A library document's displayed version date is its manually set
 * `book_version_date` when present, else the calendar day (app timezone) of
 * its `updated_at` last edit. Rows carry a DATE ('YYYY-MM-DD') and a
 * timestamptz respectively, so every comparison first normalizes both to the
 * plain-date form — never compare the raw strings across kinds.
 *
 * Person-level `applied_version_date` (v2.1398) sits ABOVE this resolution
 * and is handled by the caller.
 */

export type BookVersionDateSource = {
  book_version_date?: string | null
  updated_at?: string | null
}

const PLAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Effective 'YYYY-MM-DD' for a book row: custom date when set, else updated_at's app-tz day; null when neither. */
export function effectiveBookVersionPlainDate(row: BookVersionDateSource | null | undefined): string | null {
  if (!row) return null
  const custom = (row.book_version_date ?? '').trim()
  if (PLAIN_DATE_RE.test(custom)) return custom
  return isoToPlainDateInAppTz(row.updated_at ?? null)
}

/** True when the row's effective date comes from a manually set book_version_date. */
export function bookVersionDateIsCustom(row: BookVersionDateSource | null | undefined): boolean {
  return PLAIN_DATE_RE.test((row?.book_version_date ?? '').trim())
}

/** Display label ('Apr 20, 2026') for the effective version date; null when the row has no date at all. */
export function effectiveBookVersionLabel(row: BookVersionDateSource | null | undefined): string | null {
  return formatAppliedVersionPlainDate(effectiveBookVersionPlainDate(row))
}

/** The row with the latest effective version date (plain-date compare); rows without any date lose. */
export function maxEffectiveBookVersionRow<T extends BookVersionDateSource>(rows: readonly T[]): T | null {
  let best: T | null = null
  let bestDate = ''
  for (const row of rows) {
    const d = effectiveBookVersionPlainDate(row)
    if (d != null && d > bestDate) {
      best = row
      bestDate = d
    }
  }
  return best
}
