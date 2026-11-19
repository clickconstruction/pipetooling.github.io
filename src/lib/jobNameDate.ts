/**
 * A date typed into a job's name, said the way a person says it (punch list #384, the look).
 *
 * Some jobs are named with the day they were made, as `2026-11-08`. On a phone that is ten characters of
 * digits a field person has to work out. The Job Mode page draws it as the day of the week and the month and
 * day, `Sun, Nov 8`. The name itself is untouched: this is for the words on the screen only, never for what
 * a window saves or a search reads.
 *
 * Only a real calendar date written year, month, day with dashes is rewritten. Anything else in the name,
 * a job number or a part number included, is left as it is.
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

// The character before the date is captured rather than looked behind for: an older phone's browser refuses
// a lookbehind at load, and that would take the whole app down with it.
const DATE_IN_NAME = /(^|[^\d-])(\d{4})-(\d{2})-(\d{2})(?![\d-])/g

/** `2026-11-08` as `Sun, Nov 8`, or null when the three numbers are not a day on the calendar. */
export function plainDateWords(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[month - 1]} ${day}`
}

/** A job's name for the screen: every date typed into it as the day of the week and the month and day. */
export function jobNameWithPlainDates(name: string | null | undefined): string {
  const raw = name ?? ''
  if (!raw.includes('-')) return raw
  return raw.replace(DATE_IN_NAME, (whole: string, before: string, y: string, m: string, d: string) => {
    const words = plainDateWords(Number(y), Number(m), Number(d))
    return words ? `${before}${words}` : whole
  })
}
