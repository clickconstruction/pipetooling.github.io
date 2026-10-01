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
 *
 * Marks for a teammate (v2.4297): `requests` are the `bid_mark_requests` rows this person sent
 * or received (open, or closed in the last few days), and `people` is the Bids roster the page
 * hands over (`setBidMarkPeople`) so a request can say who. They reload on every page visit
 * back to the tab (`refreshBidMarkRequests`) so "seen" and "done" reach the sender without a
 * refresh. Every write goes through the table's functions (mark_bid_for, bid_mark_requests_seen,
 * bid_mark_requests_close, bid_mark_request_take_back).
 */
import { useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { EMPTY_BID_MARKS, removeBidMarks, toggleBidMark, type BidMarkMap } from './bidMarks'
import {
  BID_MARK_REQUEST_DONE_KEEP_DAYS,
  normalizeBidMarkNote,
  type BidMarkPerson,
  type BidMarkRequest,
} from './bidMarkRequests'

export type BidMarksSnapshot = {
  marks: BidMarkMap
  onlyMarked: boolean
  /** The person whose marks these are; null until loaded. */
  userId: string | null
  /** Marks for a teammate this person sent or received (v2.4297). */
  requests: ReadonlyArray<BidMarkRequest>
  /** Who's who for those requests: the Bids roster, by id. */
  people: Readonly<Record<string, BidMarkPerson>>
  /** The signed-in person, even before their marks load (requests need it to read "for me"). */
  me: string | null
}

const NO_REQUESTS: ReadonlyArray<BidMarkRequest> = Object.freeze([])
const NO_PEOPLE: Readonly<Record<string, BidMarkPerson>> = Object.freeze({})
const INITIAL: BidMarksSnapshot = { marks: EMPTY_BID_MARKS, onlyMarked: false, userId: null, requests: NO_REQUESTS, people: NO_PEOPLE, me: null }
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
  if (snapshot.me !== userId) emit({ ...snapshot, me: userId })
  void refreshBidMarkRequests()
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

// ---- marks for a teammate (v2.4297) ----

/** The Bids roster, so a request can name who sent it or who has it. */
export function setBidMarkPeople(people: ReadonlyArray<BidMarkPerson>) {
  const byId: Record<string, BidMarkPerson> = {}
  for (const p of people) byId[p.id] = p
  emit({ ...snapshot, people: byId })
}

const REQUEST_COLUMNS = 'id, bid_id, for_user_id, from_user_id, note, created_at, seen_at, closed_at, outcome'

/** Reload the requests this person sent or received: open ones, and ones closed in the last few days. */
export async function refreshBidMarkRequests(): Promise<void> {
  const me = snapshot.me
  if (!me) return
  const since = new Date(Date.now() - BID_MARK_REQUEST_DONE_KEEP_DAYS * 86_400_000).toISOString()
  try {
    const rows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('bid_mark_requests')
          .select(REQUEST_COLUMNS)
          // RLS returns only rows this person sent or received, so the one filter is the window.
          .or(`closed_at.is.null,closed_at.gt.${since}`),
      'load bid mark requests',
    )
    if (snapshot.me !== me) return
    emit({ ...snapshot, requests: ((rows ?? []) as BidMarkRequest[]) })
  } catch {
    // A table not pushed yet, or a dropped connection: keep what is on screen.
  }
}

/** Mark a bid for someone. Resolves to the request id. */
export async function markBidForPerson(bidId: string, forUserId: string, note: string): Promise<string> {
  const id = await withSupabaseRetry(
    async () => await supabase.rpc('mark_bid_for', { p_bid_id: bidId, p_for_user_id: forUserId, p_note: normalizeBidMarkNote(note) }),
    'mark bid for someone',
  )
  await refreshBidMarkRequests()
  return id as string
}

function patchRequests(pick: (r: BidMarkRequest) => boolean, patch: Partial<BidMarkRequest>): ReadonlyArray<BidMarkRequest> {
  const before = snapshot.requests
  emit({ ...snapshot, requests: before.map((r) => (pick(r) ? { ...r, ...patch } : r)) })
  return before
}

/** The receiver opened the bid: their open, unseen requests on it are seen. */
export async function markBidRequestsSeen(bidId: string): Promise<void> {
  const me = snapshot.me
  if (!me) return
  const unseen = (r: BidMarkRequest) => r.bid_id === bidId && r.for_user_id === me && !r.closed_at && !r.seen_at
  if (!snapshot.requests.some(unseen)) return
  const before = patchRequests(unseen, { seen_at: new Date().toISOString() })
  try {
    await withSupabaseRetry(async () => await supabase.rpc('bid_mark_requests_seen', { p_bid_id: bidId }), 'mark bid requests seen')
  } catch {
    emit({ ...snapshot, requests: before })
  }
}

/** The receiver finishes: Done or Not for me, for every open request for them on the bid. */
export async function closeBidRequestsForMe(bidId: string, outcome: 'done' | 'not_for_me'): Promise<void> {
  const me = snapshot.me
  if (!me) return
  const now = new Date().toISOString()
  const before = patchRequests((r) => r.bid_id === bidId && r.for_user_id === me && !r.closed_at, { closed_at: now, outcome, seen_at: now })
  try {
    await withSupabaseRetry(async () => await supabase.rpc('bid_mark_requests_close', { p_bid_id: bidId, p_outcome: outcome }), 'close bid mark requests')
  } catch (err) {
    emit({ ...snapshot, requests: before })
    throw err
  }
}

/** The sender takes one back while it is open. */
export async function takeBackBidRequest(requestId: string): Promise<void> {
  const before = patchRequests((r) => r.id === requestId && !r.closed_at, { closed_at: new Date().toISOString(), outcome: 'taken_back' })
  try {
    await withSupabaseRetry(async () => await supabase.rpc('bid_mark_request_take_back', { p_request_id: requestId }), 'take back bid mark request')
  } catch (err) {
    emit({ ...snapshot, requests: before })
    throw err
  }
}

/** Whether a phone notification can reach this person; null when the check itself failed (say nothing then). */
export async function personHasPushDevice(userId: string): Promise<boolean | null> {
  try {
    const has = await withSupabaseRetry(async () => await supabase.rpc('user_has_push_device', { p_user_id: userId }), 'check push device')
    return has === true
  } catch {
    return null
  }
}

/** Send the one phone notification for a request the caller just made. Resolves to how many devices it reached. */
export async function sendBidMarkPush(requestId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('notify-bid-mark', { body: { request_id: requestId } })
  if (error) throw error
  return Number((data as { push_sent?: number } | null)?.push_sent ?? 0)
}

/** Tests: back to nothing loaded. */
export function resetBidMarksStoreForTests(marks: BidMarkMap = EMPTY_BID_MARKS, extra: Partial<BidMarksSnapshot> = {}) {
  emit({ ...INITIAL, marks, ...extra })
}
