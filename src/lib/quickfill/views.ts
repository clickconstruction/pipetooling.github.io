/**
 * Quickfill views (punch list #147): the same page laid out more than one way, chosen by a
 * switch beside the title and remembered per person. v2.5778 adds Focus — only the groups
 * with work stay open; a station at zero, a station marked today and a door with no mark
 * each fold to one line under a small heading. Pure: counts, marks and flags in, buckets out.
 */

export type QuickfillView = 'page' | 'focus'

export const QUICKFILL_VIEWS: ReadonlyArray<{ view: QuickfillView; label: string; title: string }> = [
  { view: 'page', label: 'Page', title: 'Every station open, top to bottom' },
  { view: 'focus', label: 'Focus', title: 'Only the groups with work open; the rest one line each' },
]

export function isQuickfillView(v: unknown): v is QuickfillView {
  return v === 'page' || v === 'focus'
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
