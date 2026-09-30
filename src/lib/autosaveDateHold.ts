/**
 * Holding a half-typed date back from a form that saves itself on a debounce.
 *
 * A date box reports a date on every key that completes one (`dateBoxEntry.ts`), and a
 * debounced autosave writes whatever the form holds when the typist pauses: `0002-09-30` for a
 * pause after the first digit of the year, `0026-09-30` for a year typed as two digits. Each
 * autosave asks `isUnfinishedDate` which dates to hold. A held date is left out of the write, or
 * the write waits for it; it is never written as null, which would erase the saved date while
 * the new one is being typed.
 */
import { isPlausibleDate } from './dateBoxEntry'

/** Something is in the box and it is not a finished date. An empty box is a cleared date, not an unfinished one. */
export function isUnfinishedDate(value: string | null | undefined): boolean {
  const v = (value ?? '').trim()
  return v !== '' && !isPlausibleDate(v)
}

/**
 * Whether to say that a date was held. `held` names the boxes this save held back and `told`
 * the ones the save before it held: a box is said once, and again only after it was finished
 * or emptied in between — not on every pause of a slow typist.
 */
export function heldDatesToTell(told: readonly string[], held: readonly string[]): boolean {
  return held.some((box) => !told.includes(box))
}

/** The line a form shows while its whole draft waits on a date — a form whose dates cannot be left out of the write on their own. */
export function draftHeldByDateMessage(thisYear: number): string {
  return `Not saved: a date is not finished. Type the year in full, like ${thisYear}.`
}
