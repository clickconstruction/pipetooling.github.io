/**
 * The Vectors → Review door (v2.3366, step 2 of the Bridge ↔ Review fold).
 *
 * A person's row on the Bridge opens their People → Review panel for that
 * pay week: `/people?tab=review&review_person=<name>&review_from=<ymd>&review_to=<ymd>`
 * (namespaced: a bare `person=` is the Person desk's own door and gets consumed). The
 * Review tab reads the same three params once on mount, switches its period
 * to that custom range, and selects the person. Names travel as the account
 * name (`users.name`); Review keys people by pay-config `person_name`, which
 * payroll joins to the same name trimmed — so the match here is trimmed and
 * case-insensitive, like `lookupByPersonName` in the Team Summary kernel.
 * Pure.
 */

const YMD = /^\d{4}-\d{2}-\d{2}$/

export type ReviewDoor = { person: string; from: string; to: string }

/** The href a Vectors row links to. */
export function reviewDoorHref(door: ReviewDoor): string {
  const q = new URLSearchParams({ tab: 'review', review_person: door.person.trim(), review_from: door.from, review_to: door.to })
  return `/people?${q.toString()}`
}

/** The door's params from a search string, or null when any of the three is missing or malformed. */
export function parseReviewDoor(search: string): ReviewDoor | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (q.get('tab') !== 'review') return null
  const person = (q.get('review_person') ?? '').trim()
  const from = q.get('review_from') ?? ''
  const to = q.get('review_to') ?? ''
  if (!person || !YMD.test(from) || !YMD.test(to)) return null
  return from <= to ? { person, from, to } : { person, from: to, to: from }
}

/** Index of the door's person in Review's roster (trimmed, case-insensitive), or −1. */
export function reviewDoorPersonIndex(roster: ReadonlyArray<string>, person: string): number {
  const want = person.trim().toLowerCase()
  if (!want) return -1
  const exact = roster.findIndex((n) => n === person)
  if (exact >= 0) return exact
  return roster.findIndex((n) => n.trim().toLowerCase() === want)
}
