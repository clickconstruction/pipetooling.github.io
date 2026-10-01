/**
 * Marks for a teammate (v2.4297) — the pure half.
 *
 * A request (`bid_mark_requests`) is one person marking a bid FOR another, with an optional
 * note: open until the receiver presses Done or Not for me, or the sender takes it back. The
 * same rows are read two ways:
 *
 *   - the RECEIVER (`forMeByBid`): every open request for them, by bid, newest first. The row
 *     wears the sender's initial in a filled circle (a dot until opened), the note on the row,
 *     and the open bid shows a strip with Done and Not for me.
 *   - the SENDER (`fromMeByBid`): their newest request per bid, open or closed in the last
 *     three days (never a taken-back one). The row wears the receiver's initial in an outlined
 *     circle and `senderStateWords` says where it stands.
 *
 * Who a person is comes from the Bids roster (`BidMarkPerson`): first name and initial.
 */
import { bidMarkDayWords } from './bidMarks'

export type BidMarkOutcome = 'done' | 'not_for_me' | 'taken_back'

export type BidMarkRequest = {
  id: string
  bid_id: string
  for_user_id: string
  from_user_id: string
  note: string
  created_at: string
  seen_at: string | null
  closed_at: string | null
  outcome: BidMarkOutcome | null
}

export type BidMarkPerson = { id: string; name: string; role: string | null }

/** How long a finished request stays on the sender's list. */
export const BID_MARK_REQUEST_DONE_KEEP_DAYS = 3
export const BID_MARK_REQUEST_NOTE_MAX = 280

export function firstName(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return n ? (n.split(/\s+/)[0] ?? n) : 'Someone'
}

export function personInitial(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return n ? n.charAt(0).toUpperCase() : '?'
}

function newestFirst(a: BidMarkRequest, b: BidMarkRequest): number {
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
}

/** bid id → the open requests for `me` on it, newest first. */
export function forMeByBid(requests: ReadonlyArray<BidMarkRequest>, me: string | null): Map<string, BidMarkRequest[]> {
  const out = new Map<string, BidMarkRequest[]>()
  if (!me) return out
  for (const r of requests) {
    if (r.for_user_id !== me || r.closed_at) continue
    const list = out.get(r.bid_id)
    if (list) list.push(r)
    else out.set(r.bid_id, [r])
  }
  for (const list of out.values()) list.sort(newestFirst)
  return out
}

/** The open requests for `me` that I have not opened yet. */
export function unseenForMeCount(requests: ReadonlyArray<BidMarkRequest>, me: string | null): number {
  if (!me) return 0
  return requests.filter((r) => r.for_user_id === me && !r.closed_at && !r.seen_at).length
}

/** A sender's request is still shown while open, or for three days after the receiver finished it. */
export function isSenderRequestShown(r: BidMarkRequest, now: Date): boolean {
  if (!r.closed_at) return true
  if (r.outcome === 'taken_back') return false
  return now.getTime() - new Date(r.closed_at).getTime() < BID_MARK_REQUEST_DONE_KEEP_DAYS * 86_400_000
}

/** bid id → `me`'s newest shown request on it (one per bid: the circle carries one initial). */
export function fromMeByBid(requests: ReadonlyArray<BidMarkRequest>, me: string | null, now: Date): Map<string, BidMarkRequest> {
  const out = new Map<string, BidMarkRequest>()
  if (!me) return out
  for (const r of [...requests].sort(newestFirst)) {
    if (r.from_user_id !== me || !isSenderRequestShown(r, now)) continue
    if (!out.has(r.bid_id)) out.set(r.bid_id, r)
  }
  return out
}

/** The sender's words for where a request stands: "for Robert · seen Tue", "Robert is done · Mon". */
export function senderStateWords(r: BidMarkRequest, receiverName: string, now: Date): string {
  const who = firstName(receiverName)
  if (r.closed_at && r.outcome === 'done') return `${who} is done · ${bidMarkDayWords(r.closed_at, now)}`
  if (r.closed_at && r.outcome === 'not_for_me') return `${who} passed it back · ${bidMarkDayWords(r.closed_at, now)}`
  if (r.closed_at) return `taken back`
  if (r.seen_at) return `for ${who} · seen ${bidMarkDayWords(r.seen_at, now)}`
  return `for ${who} · not seen yet`
}

export type SenderTone = 'waiting' | 'seen' | 'done' | 'passed'

export function senderTone(r: BidMarkRequest): SenderTone {
  if (r.closed_at) return r.outcome === 'done' ? 'done' : 'passed'
  return r.seen_at ? 'seen' : 'waiting'
}

/** The receiver's line on a row: "Wendi: GC moved the due date…", or who marked it when there is no note. */
export function receiverLine(r: BidMarkRequest, senderName: string): string {
  const who = firstName(senderName)
  const note = r.note.trim()
  return note ? `${who}: ${note}` : `${who} marked this for you`
}

/** "Wendi marked this for you today" — the card's and the strip's heading. */
export function receiverHeading(r: BidMarkRequest, senderName: string, now: Date): string {
  return `${firstName(senderName)} marked this for you ${bidMarkDayWords(r.created_at, now)}`.trim()
}

/**
 * Who to offer in "Mark this bid for someone": the bid's estimator and account man first (never
 * me, never twice), then everyone else who uses Bids, by name.
 */
export function suggestedPeople(
  roster: ReadonlyArray<BidMarkPerson>,
  bid: { estimator_id?: string | null; account_manager_id?: string | null },
  me: string | null,
): { onBid: Array<BidMarkPerson & { label: string }>; others: BidMarkPerson[] } {
  const byId = new Map(roster.map((p) => [p.id, p]))
  const onBid: Array<BidMarkPerson & { label: string }> = []
  const add = (id: string | null | undefined, label: string) => {
    if (!id || id === me) return
    const p = byId.get(id)
    if (!p) return
    const existing = onBid.find((x) => x.id === id)
    if (existing) {
      existing.label = `${existing.label} and ${label}`
      return
    }
    onBid.push({ ...p, label })
  }
  add(bid.estimator_id, 'Estimator')
  add(bid.account_manager_id, 'Account Man')
  const taken = new Set(onBid.map((p) => p.id))
  const others = roster
    .filter((p) => p.id !== me && !taken.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { onBid, others }
}

export function normalizeBidMarkNote(note: string): string {
  return note.trim().slice(0, BID_MARK_REQUEST_NOTE_MAX)
}
