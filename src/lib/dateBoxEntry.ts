/**
 * Reading a date box (`<input type="date">`) that saves as you go.
 *
 * A browser reports a date on every key that completes one, so the year "2026" typed one
 * digit at a time arrives as `0002-…`, `0020-…`, `0202-…`, `2026-…`. A box that writes on
 * the change event saves the first of those. These readers say which value is a finished
 * date; `FinishedDateInput` is the box that uses them.
 */

/** The years a saved date may carry. A date box hands over `0002-09-30` while the year is still being typed. */
export const DATE_BOX_MIN_YEAR = 2000
export const DATE_BOX_MAX_YEAR = 2100

/** A finished, sensible date: a real `YYYY-MM-DD` day with its year in the window. */
export function isPlausibleDate(iso: string | null | undefined): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < DATE_BOX_MIN_YEAR || y > DATE_BOX_MAX_YEAR) return false
  const day = new Date(Date.UTC(y, mo - 1, d))
  return day.getUTCFullYear() === y && day.getUTCMonth() === mo - 1 && day.getUTCDate() === d
}

export type DateBoxEntry = { kind: 'save'; value: string | null } | { kind: 'unchanged' } | { kind: 'unfinished' }

/**
 * What a date box's value means against the date it showed: an empty box clears the date, a
 * plausible date saves, the shown date again is no change, and anything else (a year half
 * typed) is unfinished and never saved.
 */
export function readDateBoxEntry(raw: string, shown: string | null): DateBoxEntry {
  const v = raw.trim()
  if (v === (shown ?? '')) return { kind: 'unchanged' }
  if (v === '') return { kind: 'save', value: null }
  return isPlausibleDate(v) ? { kind: 'save', value: v } : { kind: 'unfinished' }
}

/**
 * Whether a change waits in the box instead of saving. A change that follows a key press is
 * typed — a day changed 30 → 15 passes through a plausible 01 — so it waits until the box is
 * left or Enter is pressed. A change with no key press is a pick from the calendar and saves
 * at once, unless it is unfinished.
 */
export function holdsDateBoxChange(typed: boolean, raw: string, shown: string | null): boolean {
  return typed || readDateBoxEntry(raw, shown).kind === 'unfinished'
}

/** The line shown when an unfinished date is dropped. */
export function unfinishedDateMessage(thisYear: number): string {
  return `That date was not finished, so it was not saved. Type the year in full, like ${thisYear}.`
}
