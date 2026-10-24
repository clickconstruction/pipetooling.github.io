/**
 * Quickfill views (punch list #147): the same page laid out more than one way, chosen by a
 * switch beside the title and remembered per person. v2.5778 adds Focus — only the groups
 * with work stay open; a station at zero, a station marked today and a door with no mark
 * each fold to one line under a small heading. v2.5787 adds the Roller — one group at a time
 * on a desktop, the phone round's own screens with Previous and Next, a strip of dots and the
 * Board as the index. v2.5813 makes the Roller the view the page opens in when nobody chose
 * one. Pure: counts, marks and flags in, buckets and decks out.
 */

import type { RoundRow } from './round'
import { roundChipColor } from './round'

export type QuickfillView = 'page' | 'focus' | 'roller'

export const QUICKFILL_VIEWS: ReadonlyArray<{ view: QuickfillView; label: string; title: string }> = [
  { view: 'page', label: 'Page', title: 'Every station open, top to bottom' },
  { view: 'focus', label: 'Focus', title: 'Only the groups with work open; the rest one line each' },
  { view: 'roller', label: 'Roller', title: 'One group at a time, with Previous and Next' },
]

export function isQuickfillView(v: unknown): v is QuickfillView {
  return v === 'page' || v === 'focus' || v === 'roller'
}

/** `?view=focus` on the URL opens that view for the visit and does not change the saved one. */
export function parseQuickfillViewRequest(search: string): QuickfillView | null {
  const q = search.startsWith('?') ? search.slice(1) : search
  const v = new URLSearchParams(q).get('view')
  return isQuickfillView(v) ? v : null
}

/** localStorage key for the per-person view (the Needs you card's Cards / Walk precedent). */
export function quickfillViewStorageKey(userId: string): string {
  return `pipetooling_quickfill_view_${userId}`
}

export function readStoredQuickfillView(userId: string | null | undefined): QuickfillView | null {
  if (!userId || typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(quickfillViewStorageKey(userId))
    return isQuickfillView(v) ? v : null
  } catch {
    return null
  }
}

export function writeQuickfillView(userId: string | null | undefined, view: QuickfillView): void {
  if (!userId || typeof window === 'undefined') return
  try {
    localStorage.setItem(quickfillViewStorageKey(userId), view)
  } catch {
    /* per-device nicety only */
  }
}

/**
 * The view the page opens in when the URL asks for none and the person has chosen none: the
 * Roller since v2.5813 (the owner, 2026-10-24: "I would like roller to be the default from now
 * on"); the whole page before. A saved choice still wins, so whoever picked Page or Focus on
 * their device keeps it. The phone ignores the view: under 640 px the page is the round.
 */
export const QUICKFILL_DEFAULT_VIEW: QuickfillView = 'roller'

/** The view a visit opens in: `?view=` for the visit, else the person's saved choice, else the default. */
export function quickfillOpeningView(search: string, userId: string | null | undefined): QuickfillView {
  return parseQuickfillViewRequest(search) ?? readStoredQuickfillView(userId) ?? QUICKFILL_DEFAULT_VIEW
}

/**
 * Where a station sits in Focus: open (the body), zero (one line with its ✓), fresh (the
 * marked strip the page already draws) or door (one line, no mark).
 */
export type FocusBucket = 'open' | 'zero' | 'fresh' | 'door'

export type FocusInput = {
  /** The count the station reports; null while nothing is reported. */
  count: number | null
  /** True while the station's reporter is still loading — never fold on a count that is not in yet. */
  loading: boolean
  /** Marked within the last 12 h: the page already folds it to the green strip. */
  collapsed: boolean
  /** A personal door (My Inbox, Schedule, Tomorrow's schedule): no org mark. */
  personal: boolean
  /** Open now, or a station deep link: the person asked for the body. */
  forced: boolean
}

export function focusBucket(s: FocusInput): FocusBucket {
  if (s.forced) return 'open'
  if (s.collapsed) return 'fresh'
  if (s.personal) return 'door'
  if (s.loading) return 'open'
  if (s.count === 0) return 'zero'
  // null with nothing loading = no reporter: the page cannot say it is empty, so it stays open.
  return 'open'
}

export type FocusGroups<T> = { open: T[]; zero: T[]; fresh: T[]; door: T[] }

/** The page's stations, in the page's order, split into the four buckets. */
export function focusGroups<T extends { sectionId: string }>(sections: ReadonlyArray<T>, bucketOf: (sectionId: string) => FocusBucket): FocusGroups<T> {
  const out: FocusGroups<T> = { open: [], zero: [], fresh: [], door: [] }
  for (const s of sections) out[bucketOf(s.sectionId)].push(s)
  return out
}

/** The one line under the search: "13 groups with work · 7 at zero · 5 marked today · 3 doors". */
export function focusHeadline(g: FocusGroups<unknown>): string {
  const parts = [`${g.open.length} group${g.open.length === 1 ? '' : 's'} with work`]
  if (g.zero.length) parts.push(`${g.zero.length} at zero`)
  if (g.fresh.length) parts.push(`${g.fresh.length} marked today`)
  if (g.door.length) parts.push(`${g.door.length} door${g.door.length === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

/** The small heading over each folded run. */
export function focusHeading(bucket: Exclude<FocusBucket, 'open'>, n: number): string {
  if (bucket === 'zero') return `${n} at zero · still get a ✓`
  if (bucket === 'fresh') return `${n} marked today`
  return `${n} door${n === 1 ? '' : 's'} · no mark`
}

// ---------- The Roller (v2.5787)

/** A row with work: it reports a count above zero and is not a door. */
export function rollerHasWork(row: Pick<RoundRow, 'count' | 'personal'>): boolean {
  return !row.personal && typeof row.count === 'number' && row.count > 0
}

/**
 * The deck: the round's rows in the round's order (due first, the doors last), without the
 * stations marked today unless `showDone`. The round's own queue holds only the due ones;
 * the Roller walks everything not yet looked at today, which is what "scroll through the
 * groups" means on a desk.
 */
export function rollerDeck<T extends Pick<RoundRow, 'state' | 'personal'>>(rows: ReadonlyArray<T>, showDone: boolean): T[] {
  return rows.filter((r) => showDone || r.personal || r.state !== 'fresh')
}

/** "7 of 23 · 12 left with work" — the groups with work from this one on, this one included. */
export function rollerWords(deck: ReadonlyArray<Pick<RoundRow, 'count' | 'personal'>>, index: number): string {
  if (deck.length === 0) return 'Round done ✓'
  const i = Math.min(Math.max(index, 0), deck.length - 1)
  const left = deck.slice(i).filter(rollerHasWork).length
  return `${i + 1} of ${deck.length} · ${left} left with work`
}

export type RollerDot = 'red' | 'amber' | 'green' | 'grey' | 'hollow'

/** The strip's dot: the chip rule's colour, grey when not yet due, hollow for a door. */
export function rollerDot(row: Pick<RoundRow, 'state' | 'personal'>): RollerDot {
  if (row.personal) return 'hollow'
  if (row.state === 'not_yet') return 'grey'
  const c = roundChipColor(row.state)
  return c === 'yellow' ? 'amber' : c
}

/** The station after `currentId` in the deck, or null at the end; the first when `currentId` is not in it. */
export function rollerNext<T extends { sectionId: string }>(deck: ReadonlyArray<T>, currentId: string | null): string | null {
  const i = currentId ? deck.findIndex((r) => r.sectionId === currentId) : -1
  if (i < 0) return deck[0]?.sectionId ?? null
  return deck[i + 1]?.sectionId ?? null
}

export function rollerPrev<T extends { sectionId: string }>(deck: ReadonlyArray<T>, currentId: string | null): string | null {
  const i = currentId ? deck.findIndex((r) => r.sectionId === currentId) : -1
  return i > 0 ? deck[i - 1]!.sectionId : null
}

/** localStorage key for "Show the N marked today" on the Roller, per person. */
export function rollerShowDoneStorageKey(userId: string): string {
  return `pipetooling_quickfill_roller_show_done_${userId}`
}

export function readStoredRollerShowDone(userId: string | null | undefined): boolean {
  if (!userId || typeof window === 'undefined') return false
  try {
    return localStorage.getItem(rollerShowDoneStorageKey(userId)) === '1'
  } catch {
    return false
  }
}

export function writeRollerShowDone(userId: string | null | undefined, on: boolean): void {
  if (!userId || typeof window === 'undefined') return
  try {
    localStorage.setItem(rollerShowDoneStorageKey(userId), on ? '1' : '0')
  } catch {
    /* per-device nicety only */
  }
}
