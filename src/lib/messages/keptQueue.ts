import { callRows, type CallTaskRow } from '../calls/callTasks'
import type { FollowUpContact, FollowUpLine } from '../followUp/followUpRows'
import type { NewLaneRow } from '../followUp/newLane'
import { backRowPill, onPortal, owedLate, type FollowUpQueue, type NeedsReplyRow, type NeedsYouRow, type OwedRow, type PortalRow } from '../followUp/queue'
import type { SetAsideRow } from '../followUp/setAsideFold'
import { buildKeptReadKey } from '../keptRead'
import { whenWords } from './thread'

/**
 * Messages' kept queue (punch list #183 PR 5): the shape `/messages` keeps on the device through
 * `useKeptRead`, so a slow morning shows who was waiting as the device last read it under the stamp
 * *Who was waiting at 7:52 AM · reading again…*, with the bar's counts from the same read, instead
 * of *Loading who is waiting on us…* under blank counts. Take it and every other press that writes
 * on a row are held until the live read lands; a row still opens its thread, and Call still dials.
 *
 * What is kept is the queue as drawn, never the loader's tables: the four lanes' rows and the calls
 * as `followUpQueue` built them, the badge's count, the people those rows name (with who has each),
 * the lines they quote, and the notices folded under New. One record under one key per person,
 * `u1:messages:queue`. The kind pills and the Show lens narrow at draw time, as they do the live
 * queue, so one kept read serves every pill; the clauses and the nudges are GC projects' and are
 * never kept, since that tab keeps nothing.
 *
 * A read kept last evening is what a slow morning shows, so the words a row carries that count from
 * today are read again against the clock when it is unpacked (`keptLanesToday`), as the deck re-reads
 * its marks (PR 4): *today at 4:12 PM* reads *yesterday* by morning, and a call due today reads late.
 */

export const MESSAGES_KEPT_PAGE = 'messages'

/** The one scope: the whole queue, or nothing. */
export const MESSAGES_KEPT_SCOPES: readonly string[] = ['queue']

export function messagesKeptKey(userId: string): string {
  return buildKeptReadKey(userId, MESSAGES_KEPT_PAGE, 'queue')
}

/** The lanes as the queue built them, without the pass-through rows (clauses, nudges) and the portal function. */
export interface MessagesKeptLanes {
  newLane: NewLaneRow[]
  needsYou: NeedsYouRow[]
  needsReply: NeedsReplyRow[]
  weOwe: OwedRow[]
  calls: CallTaskRow[]
}

/** The one record the device keeps. */
export interface MessagesKeptQueue {
  lanes: MessagesKeptLanes
  /** The badge's count, as the queue counted it. */
  count: number
  /** The people the lanes name, with who has each; nobody else. */
  people: FollowUpContact[]
  /** The lines the rows quote or land on; nothing else of the thread. */
  lines: FollowUpLine[]
  /** The notices the reader set aside, folded under New. */
  setAside: SetAsideRow[]
}

/** What the panel draws from, kept or live: the queue, its people and lines, and the fold's rows. */
export interface MessagesQueueSource<C = never, N extends { contactId: string } = never> {
  queue: FollowUpQueue<C, N>
  contacts: readonly FollowUpContact[]
  lines: ReadonlyMap<string, FollowUpLine>
  setAside: readonly SetAsideRow[]
}

/** The people every lane names, once each, in the lanes' order. */
export function peopleNamedByLanes(lanes: MessagesKeptLanes): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  for (const r of [...lanes.newLane, ...lanes.needsYou, ...lanes.needsReply, ...lanes.weOwe, ...lanes.calls]) {
    if (seen.has(r.contactId)) continue
    seen.add(r.contactId)
    ids.push(r.contactId)
  }
  return ids
}

/** The lines the rows quote or land on: a New row's line, a reply row's newest line and its offers, a note, a portal write. */
export function linesQuotedByLanes(lanes: MessagesKeptLanes): string[] {
  const ids = new Set<string>()
  for (const r of lanes.newLane) ids.add(r.messageId)
  for (const r of lanes.needsReply) {
    if (r.landOnId) ids.add(r.landOnId)
    for (const o of r.offers) ids.add(o.messageId)
  }
  for (const r of lanes.needsYou) {
    if (r.kind === 'back') ids.add(r.noteId)
    else if (r.landOnId) ids.add(r.landOnId)
  }
  return [...ids]
}

/** A line as the lanes read it: the typed fields alone, never a thread's files or delivery marks. */
function keptLineOf(line: FollowUpLine): FollowUpLine {
  const kept: FollowUpLine = {
    id: line.id,
    contactId: line.contactId,
    jobId: line.jobId ?? null,
    channel: line.channel,
    direction: line.direction,
    at: line.at,
    who: line.who,
    body: line.body,
    backOn: line.backOn ?? null,
    backBy: line.backBy ?? null,
    backWords: line.backWords ?? null,
    backDoneAt: line.backDoneAt ?? null,
  }
  if (line.subject !== undefined) kept.subject = line.subject
  if (line.mailbox !== undefined) kept.mailbox = line.mailbox
  if (line.tiedByHand !== undefined) kept.tiedByHand = line.tiedByHand
  if (line.auto !== undefined) kept.auto = line.auto
  return kept
}

/**
 * The record to keep once the queue's read landed: the lanes as drawn, the count, the people they
 * name and the lines they quote. One row, so the hook's edge writes the whole queue or nothing.
 */
export function buildMessagesKeptQueue<C, N extends { contactId: string }>(source: MessagesQueueSource<C, N>): MessagesKeptQueue[] {
  const { queue } = source
  const lanes: MessagesKeptLanes = {
    newLane: [...queue.newLane],
    needsYou: [...queue.needsYou],
    needsReply: [...queue.needsReply],
    weOwe: [...queue.weOwe],
    calls: [...queue.calls],
  }
  const byId = new Map(source.contacts.map((c) => [c.id, c]))
  const people: FollowUpContact[] = []
  for (const id of peopleNamedByLanes(lanes)) {
    const c = byId.get(id)
    if (c) people.push(c)
  }
  const lines: FollowUpLine[] = []
  for (const id of linesQuotedByLanes(lanes)) {
    const line = source.lines.get(id)
    if (line) lines.push(keptLineOf(line))
  }
  return [{ lanes, count: queue.count, people, lines, setAside: [...source.setAside] }]
}

/** The kept lanes with the words that count from today read again: a New row's when, a note's *back today*, what is late. */
export function keptLanesToday(lanes: MessagesKeptLanes, clock: { todayYmd: string; nowIso: string }): MessagesKeptLanes {
  return {
    newLane: lanes.newLane.map((r) => ({ ...r, when: whenWords(r.at, clock.nowIso) })),
    needsYou: lanes.needsYou.map((r) => (r.kind === 'back' ? { ...r, pill: backRowPill(r.dayYmd, clock.todayYmd) } : r)),
    needsReply: [...lanes.needsReply],
    weOwe: lanes.weOwe.map((r) => ({ ...r, late: owedLate(r.owed, clock.todayYmd) })),
    calls: callRows(
      lanes.calls.map((c) => ({ ...c, doneAt: null })),
      clock.todayYmd,
    ),
  }
}

/**
 * The kept record back into what the panel draws: the queue with empty pass-through lanes and its
 * portal question rebuilt from the portal rows, the people, the lines by id, and the fold's rows,
 * with the day words read against `clock`. Null when the store held no record.
 */
export function unpackMessagesKeptQueue<C = never, N extends { contactId: string } = never>(rows: readonly MessagesKeptQueue[], clock: { todayYmd: string; nowIso: string }): MessagesQueueSource<C, N> | null {
  const kept = rows[0]
  if (!kept) return null
  const lanes = keptLanesToday(kept.lanes, clock)
  const portal = lanes.needsYou.filter((r): r is PortalRow => r.kind === 'portal')
  const queue: FollowUpQueue<C, N> = {
    newLane: lanes.newLane,
    needsYou: lanes.needsYou,
    clauses: [] as C[],
    needsReply: lanes.needsReply,
    weOwe: lanes.weOwe,
    calls: lanes.calls,
    nudges: [] as N[],
    onPortal: onPortal(portal),
    count: kept.count,
  }
  return { queue, contacts: kept.people, lines: new Map(kept.lines.map((l) => [l.id, l])), setAside: kept.setAside }
}

const isObj = (v: unknown): v is Record<string, unknown> => v != null && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const strOrNull = (v: unknown) => v == null || typeof v === 'string'
const laneRows = (v: unknown, ok: (r: Record<string, unknown>) => boolean) => Array.isArray(v) && v.every((r) => isObj(r) && str(r.contactId) && r.contactId.length > 0 && ok(r))

/** A stored record off the shape voids the kept queue: every lane row names its person and carries what its view draws. */
export function messagesKeptRowIsValid(row: unknown): boolean {
  if (!isObj(row)) return false
  if (typeof row.count !== 'number' || !Number.isFinite(row.count) || row.count < 0) return false
  if (!isObj(row.lanes)) return false
  const lanes = row.lanes
  if (!laneRows(lanes.newLane, (r) => str(r.messageId) && str(r.head) && str(r.words) && str(r.at) && str(r.sort) && str(r.channel))) return false
  if (
    !laneRows(lanes.needsYou, (r) =>
      r.kind === 'back' ? str(r.noteId) && str(r.pill) && str(r.note) && str(r.noteBy) : r.kind === 'portal' ? str(r.pill) && str(r.sub) && str(r.snippet) && str(r.why) && Array.isArray(r.papers) : false,
    )
  )
    return false
  if (!laneRows(lanes.needsReply, (r) => strOrNull(r.landOnId) && strOrNull(r.waitingSince) && typeof r.callBack === 'boolean' && Array.isArray(r.offers) && Array.isArray(r.acts) && r.acts.every(str))) return false
  if (!laneRows(lanes.weOwe, (r) => isObj(r.owed) && str(r.owed.what) && str(r.pill) && typeof r.late === 'boolean')) return false
  if (!laneRows(lanes.calls, (r) => str(r.id) && str(r.dueYmd) && str(r.what) && str(r.pill) && str(r.madeBy) && str(r.madeAt))) return false
  if (!Array.isArray(row.people) || !row.people.every((p) => isObj(p) && str(p.id) && str(p.kind) && str(p.name) && str(p.state) && strOrNull(p.hasUserId))) return false
  if (!Array.isArray(row.lines) || !row.lines.every((l) => isObj(l) && str(l.id) && str(l.contactId) && str(l.channel) && str(l.direction) && str(l.at) && str(l.body) && str(l.who))) return false
  if (!Array.isArray(row.setAside) || !row.setAside.every((s) => isObj(s) && str(s.id) && str(s.from_address) && str(s.at) && str(s.reason))) return false
  return true
}
