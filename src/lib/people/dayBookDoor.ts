/**
 * The Day book door (to-dos/day-book): `/people?tab=day_book&dayb_from=<ymd>&dayb_to=<ymd>[&dayb_person=<user id>]`.
 *
 * Namespaced like the Review door (`reviewDoor.ts`): a bare `person=` is the Person
 * desk's own param and gets consumed, so this one carries a `dayb_` prefix. A manager
 * can send a link to one person's week; the tab reads the params once on mount and
 * writes them back as the range or person changes, so the URL is always shareable.
 * Pure.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/

export type DayBookDoor = { from: string; to: string; person: string | null }

export function dayBookDoorHref(door: DayBookDoor): string {
  const q = new URLSearchParams({ tab: 'day_book', dayb_from: door.from, dayb_to: door.to })
  if (door.person) q.set('dayb_person', door.person)
  return `/people?${q.toString()}`
}

/** The door's params from a search string, or null when the range is missing or malformed. */
export function parseDayBookDoor(search: string): DayBookDoor | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (q.get('tab') !== 'day_book') return null
  const from = q.get('dayb_from') ?? ''
  const to = q.get('dayb_to') ?? ''
  if (!YMD.test(from) || !YMD.test(to)) return null
  const person = (q.get('dayb_person') ?? '').trim() || null
  return from <= to ? { from, to, person } : { from: to, to: from, person }
}
