/**
 * People → HR's link to one person's file: `/people?tab=hr&person=<people.id>[&theme=<id>]`.
 *
 * The address keeps the person while the file is open, and a press on a name in the roster
 * writes it, so the link can be copied from the address bar. A link whose id matches no one
 * the reader can see lands on the roster with one plain line. Pure.
 */

export type HrPersonLink =
  | { kind: 'none' }
  | { kind: 'open'; personId: string }
  /** The id names no one on the roster this reader can see: gone, mistyped, or not theirs to read. */
  | { kind: 'unknown' }

export function readHrPersonLink(param: string | null | undefined, visiblePersonIds: Iterable<string>): HrPersonLink {
  const id = (param ?? '').trim()
  if (!id) return { kind: 'none' }
  for (const visible of visiblePersonIds) if (visible === id) return { kind: 'open', personId: id }
  return { kind: 'unknown' }
}

/**
 * The address for the file of `personId`, or for the roster when null. A different person
 * drops `theme`, which belongs to the file it was picked on. Returns a new object.
 */
export function hrPersonParams(prev: URLSearchParams, personId: string | null): URLSearchParams {
  const next = new URLSearchParams(prev)
  next.set('tab', 'hr')
  if (personId) {
    if (next.get('person') !== personId) next.delete('theme')
    next.set('person', personId)
  } else {
    next.delete('person')
    next.delete('theme')
  }
  return next
}

/**
 * Leaving HR for another tab of People: the file's person and theme leave the address with it,
 * so the next tab does not read a roster id as its own `person`. Mutates and returns `params`.
 */
export function dropHrPersonParams(params: URLSearchParams): URLSearchParams {
  params.delete('person')
  params.delete('theme')
  return params
}

export const HR_LINK_UNKNOWN_WORDS = 'No one you can see matches that link. Pick a person from the list.'
