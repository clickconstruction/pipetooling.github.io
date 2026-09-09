/**
 * People → Users on a phone (v2.3185): the directory treatment — one line per
 * person in a card per kind, the row is the door to the desk, and a left swipe
 * reveals Desk · Imitate · More. Pure helpers for the row and the toolbar; the
 * component owns pointer events and state.
 */
import type { RailRow } from './deskRailAttention'
import type { RowNeeds } from './rowNeeds'
import { rowMatchesFilter, type UsersTabFilter } from './usersTabRows'

/** Phone filter order: the two you reach for on a phone sit next to Everyone and carry counts. */
export const USERS_TAB_PHONE_FILTERS: ReadonlyArray<{ key: UsersTabFilter; label: string; counted: boolean }> = [
  { key: 'all', label: 'Everyone', counted: false },
  { key: 'attention', label: 'Needs you', counted: true },
  { key: 'hours', label: 'Hours', counted: true },
  { key: 'nologin', label: 'No login', counted: false },
  { key: 'field', label: 'Field', counted: false },
  { key: 'office', label: 'Office', counted: false },
]

/** How many rows a filter would show — the count on a phone chip. */
export function countUsersTabFilter(rows: readonly RailRow[], filter: UsersTabFilter): number {
  return rows.reduce((n, r) => n + (rowMatchesFilter(r, filter) ? 1 : 0), 0)
}

/** The avatar initial: first character of the first word, upper-cased; "?" for a blank name. */
export function personInitial(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  const ch = Array.from(first)[0]
  return ch ? ch.toUpperCase() : '?'
}

/** Digital-twin accounts sign in from the twins domain (`…@twins.pipetooling.local`). */
export function isTwinEmail(email: string | null | undefined): boolean {
  return /@twins\./i.test(email ?? '')
}

/** Counted needs (paperwork / account) — what the "Needs you N" pill says. Hours never count here. */
export function needsYouCount(rowNeeds: RowNeeds | undefined): number {
  if (!rowNeeds) return 0
  return rowNeeds.needs.filter((n) => n.tone !== 'fact').reduce((s, n) => s + Math.max(1, n.count), 0)
}

/** Width of one revealed swipe action, px. */
export const SWIPE_ACTION_WIDTH = 66

/** Movement past this many px decides whether a touch is a swipe or a scroll. */
export const SWIPE_SLOP = 6

/** A touch that has moved (dx, dy) from its start: horizontal swipe, vertical scroll, or not decided yet. */
export function classifySwipe(dx: number, dy: number, slop = SWIPE_SLOP): 'horizontal' | 'vertical' | 'undecided' {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < slop && ay < slop) return 'undecided'
  return ax > ay ? 'horizontal' : 'vertical'
}

/** Where the row sits during a drag: its resting offset plus the drag, never past the actions or past home. */
export function swipeOffset(dx: number, actionsWidth: number, open: boolean): number {
  const base = open ? -actionsWidth : 0
  return Math.min(0, Math.max(-actionsWidth, base + dx))
}

/**
 * Where the row settles when the finger lifts: a drag of a third of the actions'
 * width flips the state; anything less springs back to where it was.
 */
export function swipeSettles(dx: number, actionsWidth: number, open: boolean, threshold = actionsWidth / 3): boolean {
  if (open) return dx < threshold
  return dx <= -threshold
}

/** The account note as the row's second line; blank notes render nothing. */
export function phoneRowNote(notes: string | null | undefined): string | null {
  const t = (notes ?? '').trim()
  return t === '' ? null : t
}
