/**
 * Follow Up calling order (v2.2301).
 *
 * "Never called" means no `didnt_answer` / `answered` interaction has ever
 * been recorded on the prospect — the two calling buttons. A site-visit note
 * or email sets `last_contact` but is not a call, which is why never-called
 * prospects were sinking into the coldest-first backlog.
 *
 * `never_called_first` is a re-order, not a filter: never-called prospects
 * lead (oldest entry first), everyone else follows in the caller-supplied
 * order (coldest first from the query), so the queue never runs dry.
 *
 * Punch list #184 sweep B: every mode keeps its order (the modes reorder on
 * purpose); the row's age words carry the fresh / amber / red state on the
 * `PROSPECT_CALL_AGE` scale instead of a flat amber at any age.
 */
import { ageStateForDays, PROSPECT_CALL_AGE, type AgeState } from '../ageState'

/** `by_need` (v2.5560) and `by_rank` (v2.5808) are the Subs lane's own orders; the deck orders them itself (`orderSubsByNeed`, `orderColumn`), so here they read as coldest. */
export type CallingOrderMode = 'coldest' | 'never_called_first' | 'by_need' | 'soonest_bid' | 'by_rank'

export const CALLING_ORDER_STORAGE_KEY = 'prospects_calling_order_v1'

export const CALL_INTERACTION_TYPES = ['didnt_answer', 'answered'] as const

export function readCallingOrderMode(raw: string | null | undefined): CallingOrderMode {
  if (raw === 'never_called_first') return 'never_called_first'
  if (raw === 'by_need') return 'by_need'
  if (raw === 'soonest_bid') return 'soonest_bid'
  if (raw === 'by_rank') return 'by_rank'
  return 'coldest'
}

type OrderableProspect = { id: string; created_at: string | null }

export function orderFollowUpProspects<T extends OrderableProspect>(
  prospects: readonly T[],
  calledIds: ReadonlySet<string>,
  mode: CallingOrderMode,
): T[] {
  if (mode !== 'never_called_first') return [...prospects]
  const never: T[] = []
  const called: T[] = []
  for (const p of prospects) (calledIds.has(p.id) ? called : never).push(p)
  never.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  return [...never, ...called]
}

export type QueueAge = {
  /** "called 5d ago" · "noted 180d ago" · "added 2d ago", or the bare verb when the stamp is missing. */
  label: string
  /** Whole days since the touch the label names; null when the stamp is missing. */
  days: number | null
  /** On the PROSPECT_CALL_AGE scale; a missing stamp is fresh, never shouted about. */
  state: AgeState
}

/**
 * Queue-row age: "added Nd ago" (never any contact), "noted Nd ago"
 * (touched but never called), "called Nd ago" (has call history), with the
 * state its days earn.
 */
export function queueAge(
  p: { id: string; created_at: string | null; last_contact: string | null },
  calledIds: ReadonlySet<string>,
  nowMs: number,
): QueueAge {
  const daysSince = (iso: string | null): number | null => {
    if (!iso) return null
    const t = new Date(iso).getTime()
    if (Number.isNaN(t)) return null
    return Math.max(0, Math.floor((nowMs - t) / 86_400_000))
  }
  const of = (verb: string, d: number | null): QueueAge => ({
    label: d == null ? verb : `${verb} ${d}d ago`,
    days: d,
    state: ageStateForDays(d, PROSPECT_CALL_AGE),
  })
  if (calledIds.has(p.id)) return of('called', daysSince(p.last_contact))
  if (p.last_contact) return of('noted', daysSince(p.last_contact))
  return of('added', daysSince(p.created_at))
}

/** The age words alone (the label of {@link queueAge}). */
export function queueAgeLabel(
  p: { id: string; created_at: string | null; last_contact: string | null },
  calledIds: ReadonlySet<string>,
  nowMs: number,
): string {
  return queueAge(p, calledIds, nowMs).label
}

/**
 * The queue once a card leaves it (an outcome, a landing, a delete): the list without the card, and where the
 * pointer lands. The pointer keeps its place, so the card that followed comes up; when the card that left was
 * the last one, the pointer steps back onto the new last card. `nextId` is the card now under the pointer, or
 * null when the queue is empty.
 *
 * Moved out of `src/pages/Prospects.tsx`, where six handlers each wrote it inline.
 */
export function queueAfterRemoval<T extends { id: string }>(
  queue: readonly T[],
  index: number,
  id: string,
): { queue: T[]; index: number; nextId: string | null } {
  const next = queue.filter((p) => p.id !== id)
  const nextIndex = Math.min(index, Math.max(0, next.length - 1))
  return { queue: next, index: nextIndex, nextId: next[nextIndex]?.id ?? null }
}

/**
 * Where the pointer sits when a row that is not the deck's card leaves the queue (a landing from the list or the
 * Board): one back when the row sat before the card, so the same card stays up; unchanged otherwise.
 */
export function indexAfterOtherRowLeft(queue: readonly { id: string }[], index: number, id: string): number {
  const wasAt = queue.findIndex((p) => p.id === id)
  return wasAt >= 0 && wasAt < index ? index - 1 : index
}

type ColdestRow = { id: string; last_contact: string | null; company_name: string | null }

/**
 * A row sent back into the queue (Send back on the Prospect List): added once, then the whole queue sorted
 * coldest first, never-contacted rows leading, ties by company name. A row already in the queue changes
 * nothing. The order is coldest whatever calling order the deck is on, until its next load.
 */
export function insertColdest<T extends ColdestRow>(queue: readonly T[], row: T): T[] {
  if (queue.some((x) => x.id === row.id)) return queue as T[]
  return [...queue, row].sort((a, b) => {
    const aLc = a.last_contact ? new Date(a.last_contact).getTime() : 0
    const bLc = b.last_contact ? new Date(b.last_contact).getTime() : 0
    if (aLc !== bLc) return aLc - bLc
    return (a.company_name ?? '').localeCompare(b.company_name ?? '')
  })
}

/**
 * The first row the queue peek shows: two rows above the card when there is room, never past the point where
 * the last `limit` rows fill the peek, never before the first row.
 */
export function queueWindowStart(index: number, length: number, limit: number): number {
  return Math.max(0, Math.min(index - 2, length - limit))
}
