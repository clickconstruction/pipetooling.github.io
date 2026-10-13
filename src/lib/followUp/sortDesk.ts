/**
 * Messages, residential R7: **Sort all**, the desk behind the New lane's header (the customer Messages prototype v0.8,
 * screen 7, mockup C's `deskHtml`). It walks the lane's people one card at a time with nothing else on the screen, for a
 * day when New holds a backlog. Each card's presses are the lane's own sort card (`NewLaneSlot`); this says which
 * person is up, how far the desk has come, and what *Skip for now* does. Pure.
 *
 * A skipped person comes back after the rest, so a skip defers and never drops. When every person left was skipped, the
 * walk starts over from the top of the lane.
 */
import type { Contact } from '../contacts/kernel'
import type { FollowUpContact } from './followUpRows'
import { NEW_LANE_EMPTY } from './newLane'

/** The press on New's header, and the desk's title. */
export const SORT_ALL = 'Sort all'
/** The press shows from this many people in New, as the mockup has it: one person is a row's press, not a desk. */
export const SORT_ALL_MIN = 2
export const DESK_SKIP = 'Skip for now'
export const DESK_DONE = { title: 'All sorted.', note: NEW_LANE_EMPTY, back: 'Back to Follow up' } as const
/** A person the desk cannot draw a card for, as when the lane moved under it: their thread holds the sort card too. */
export const DESK_OPEN_THREAD = 'Open their thread'

export function canSortAll(laneLength: number): boolean {
  return laneLength >= SORT_ALL_MIN
}

/** Where the desk stands: whose card is up, the progress in parts, and how many wait after this one. */
export interface DeskStep {
  /** The contact whose card is up. Null: the lane is empty, so all are sorted. */
  current: string | null
  /** "New", "3 to sort", "2 of 4": parts the desk lays out side by side. */
  progress: string[]
  /** "2 more after this", or "The last one". Null when all are sorted. */
  more: string | null
}

/**
 * The desk's step over the lane as it stands now. `total` is how many were waiting when the desk opened; it grows if
 * more came in since, so the count never runs past it. The card up is the first person not skipped.
 */
export function deskStep(lane: readonly { contactId: string }[], skipped: ReadonlySet<string>, total: number): DeskStep {
  const left = lane.length
  if (left === 0) return { current: null, progress: [], more: null }
  const of = Math.max(total, left)
  const current = (lane.find((r) => !skipped.has(r.contactId)) ?? lane[0]!).contactId
  return {
    current,
    progress: ['New', `${left} to sort`, `${of - left + 1} of ${of}`],
    more: left > 1 ? `${left - 1} more after this` : 'The last one',
  }
}

/**
 * *Skip for now*: the person goes after the rest. Once every person left is skipped, the walk starts over with only
 * this one skipped, so the top of the lane comes back up next.
 */
export function skipOne(lane: readonly { contactId: string }[], skipped: ReadonlySet<string>, contactId: string): Set<string> {
  const next = new Set([...skipped].filter((id) => lane.some((r) => r.contactId === id)))
  next.add(contactId)
  return lane.every((r) => next.has(r.contactId)) ? new Set([contactId]) : next
}

/**
 * The sort card's person from Follow up's read. The card reads the fields `laneRowFor` and its presses take: id, kind,
 * name, company and jobs. Follow up has no record or channels for them, and the card never reads either.
 */
export function deskContact(c: FollowUpContact): Contact {
  return {
    id: c.id,
    kind: c.kind,
    name: c.name,
    goesBy: c.goesBy ?? null,
    company: c.company ?? '',
    record: null,
    channels: [],
    jobIds: c.jobIds ?? [],
    defaultJobId: c.defaultJobId ?? null,
  }
}
