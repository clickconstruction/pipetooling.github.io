/**
 * The bid marks store (v2.4287): the signed-in person's marks, loaded once from `bid_marks`
 * and kept in a module store every surface reads through `useBidMarks()` — the nine picker
 * lists, the Bid Board, the bid title. Same shape as the picker's sort view and folds, but
 * the truth is the table (per account, so the iPad and the desk agree), not localStorage.
 *
 * Writes are optimistic: the row changes at once, the insert or delete follows; on failure the
 * map is put back and the caller gets the rejection to show a toast. Until `loadBidMarks` has
 * run for a person, toggles stay in memory (render tests, a signed-out flash) and nothing is
 * written.
 *
 * `onlyMarked` is the *Marked* filter — one session-wide switch, not persisted: it is "show me
 * my marked bids right now", not a view.
 */
import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { EMPTY_BID_MARKS, removeBidMarks, toggleBidMark, type BidMarkMap } from './bidMarks'

export type BidMarksSnapshot = {
  marks: BidMarkMap
  onlyMarked: boolean
  /** The person whose marks these are; null until loaded. */
  userId: string | null
}

const INITIAL: BidMarksSnapshot = { marks: EMPTY_BID_MARKS, onlyMarked: false, userId: null }
let snapshot: BidMarksSnapshot = INITIAL
const listeners = new Set<() => void>()

function emit(next: BidMarksSnapshot) {
  snapshot = next
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBidMarks(): BidMarksSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => INITIAL)
}

export function getBidMarksSnapshot(): BidMarksSnapshot {
  return snapshot
}

/** Load the person's marks (idempotent per person). A table that is not there yet reads as no marks. */
export async function loadBidMarks(userId: string): Promise<void> {
  if (snapshot.userId === userId) return
  try {
    const rows = await withSupabaseRetry(
      async () => await supabase.from('bid_marks').select('bid_id, marked_at').eq('user_id', userId),
      'load bid marks',
    )
    const marks: Record<string, string> = {}
    for (const r of (rows ?? []) as Array<{ bid_id: string; marked_at: string }>) marks[r.bid_id] = r.marked_at
    emit({ ...snapshot, marks, userId })
  } catch {
    // No marks is a fine place to start: the row still marks in memory for this session,
    // and nothing is written until a later sign-in loads cleanly (a table not pushed yet).
    emit({ ...snapshot, marks: EMPTY_BID_MARKS, userId: null })
  }
}

/** Make or clear one mark. Resolves to the new state; rejects (after putting the map back) if the write fails. */
export async function toggleBidMarkNow(bidId: string, now: Date = new Date()): Promise<boolean> {
  const before = snapshot.marks
  const { next, marked } = toggleBidMark(before, bidId, now)
  emit({ ...snapshot, marks: next })
  const userId = snapshot.userId
  if (!userId) return marked
  try {
    if (marked) {
      await withSupabaseRetry(
        async () => await supabase.from('bid_marks').upsert({ user_id: userId, bid_id: bidId, marked_at: next[bidId] }, { onConflict: 'user_id,bid_id' }),
        'mark bid',
      )
    } else {
      await withSupabaseRetry(
        async () => await supabase.from('bid_marks').delete().eq('user_id', userId).eq('bid_id', bidId),
        'clear bid mark',
      )
    }
    return marked
  } catch (err) {
    emit({ ...snapshot, marks: before })
    throw err
  }
}

/** Clear the marks named (all of them, or just the finished ones). */
export async function clearBidMarks(bidIds: ReadonlyArray<string>): Promise<void> {
  if (bidIds.length === 0) return
  const before = snapshot.marks
  emit({ ...snapshot, marks: removeBidMarks(before, bidIds), onlyMarked: snapshot.onlyMarked && Object.keys(removeBidMarks(before, bidIds)).length > 0 })
  const userId = snapshot.userId
  if (!userId) return
  try {
    await withSupabaseRetry(
      async () => await supabase.from('bid_marks').delete().eq('user_id', userId).in('bid_id', [...bidIds]),
      'clear bid marks',
    )
  } catch (err) {
    emit({ ...snapshot, marks: before })
    throw err
  }
}

export function setOnlyMarkedBids(onlyMarked: boolean) {
  if (snapshot.onlyMarked === onlyMarked) return
  emit({ ...snapshot, onlyMarked })
}

/** Tests: back to nothing loaded. */
export function resetBidMarksStoreForTests(marks: BidMarkMap = EMPTY_BID_MARKS) {
  emit({ marks, onlyMarked: false, userId: null })
}
