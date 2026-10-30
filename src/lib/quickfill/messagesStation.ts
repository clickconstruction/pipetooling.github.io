import { needsYouCount, type FollowUpQueue } from '../followUp/queue'
import { JUMP_LANE_ANCHOR, JUMP_LANE_COLOR, JUMP_LANE_LABEL, type JumpLane } from '../messages/jumpStrip'
import { MESSAGES_PATH, messagesThreadHref } from '../messages/customerThread'
import { waitWords } from '../messages/weekStrip'
import type { MessageChannel } from '../messages/thread'
import { ledgerMarkNote, ledgerName, type LedgerContact, type LedgerLine, type TextsLedger } from './textsLedger'

/**
 * Quickfill → Messages (v2.6098, punch list #178, D's PR 7; B's station): everyone waiting on us, as Follow up's
 * queue holds them and the header's badge counts them, as the round's second station. The body is the page's lanes
 * with their counts, each a press into its lane on Messages, and the Texts ledger (v2.5816) folded under them. The
 * count is the queue's own `count`, the badge's number, each person once across New, Needs you, Needs a reply and
 * We owe them. Waiting on them is a lane of the page the station points at; its rows are the page's own read, so
 * the station carries no count for it. The Next line is the person waiting longest in Needs a reply. The Mark's
 * note is the lanes' counts and the ledger's note, so the history says who was still waiting at each look. Pure;
 * the read is `messagesStationIo.ts`, the station `components/quickfill/QuickfillMessagesSection.tsx`.
 */
export type MessagesLaneId = Exclude<JumpLane, 'wentOut'>

/** The lanes in the page's order; Went out is the receipt, not work. */
export const MESSAGES_LANES: readonly MessagesLaneId[] = ['new', 'needsYou', 'needsReply', 'weOwe', 'waiting']

export interface MessagesLane {
  lane: MessagesLaneId
  label: string
  /** Null where the station has no read of its own (Waiting on them). */
  count: number | null
  /** The lane on Messages. */
  href: string
  color: string
}

export interface MessagesFirst {
  contactId: string
  name: string
  /** "a text", "an email", "a call", "a voicemail", "a portal message", "a message". */
  channelWords: string
  /** "waiting 2 h" */
  waiting: string
  /** Their thread on Messages, at the line. */
  href: string
}

export interface MessagesStation {
  lanes: MessagesLane[]
  /** The badge's number: each person once across the four queue lanes. */
  count: number
  first: MessagesFirst | null
}

export type MessagesStationQueue = Pick<FollowUpQueue<unknown, { contactId: string }>, 'newLane' | 'needsYou' | 'clauses' | 'needsReply' | 'weOwe' | 'calls' | 'count'>

export interface MessagesStationInput {
  queue: MessagesStationQueue
  contacts: ReadonlyArray<LedgerContact>
  /** The lines the queue read, by id: a row's landing line, for its channel. */
  lines: ReadonlyMap<string, LedgerLine>
  nowMs: number
}

export function messagesLaneHref(lane: MessagesLaneId): string {
  return `${MESSAGES_PATH}#${JUMP_LANE_ANCHOR[lane]}`
}

const CHANNEL_WORDS: Record<MessageChannel, string> = {
  text: 'a text',
  email: 'an email',
  call: 'a call',
  missed: 'a missed call',
  voicemail: 'a voicemail',
  portal: 'a portal message',
  note: 'a message',
  event: 'a message',
}

export function messagesStation(input: MessagesStationInput): MessagesStation {
  const { queue } = input
  const counts: Record<MessagesLaneId, number | null> = {
    new: queue.newLane.length,
    needsYou: needsYouCount(queue),
    needsReply: queue.needsReply.length,
    weOwe: queue.weOwe.length + queue.calls.length,
    waiting: null,
  }
  const lanes = MESSAGES_LANES.map((lane): MessagesLane => ({ lane, label: JUMP_LANE_LABEL[lane], count: counts[lane], href: messagesLaneHref(lane), color: JUMP_LANE_COLOR[lane] }))
  const top = queue.needsReply[0]
  let first: MessagesFirst | null = null
  if (top) {
    const c = input.contacts.find((x) => x.id === top.contactId)
    const line = top.landOnId ? input.lines.get(top.landOnId) : undefined
    const sinceMs = line ? Date.parse(line.at) : top.waitingSince ? Date.parse(top.waitingSince) : Number.NaN
    first = {
      contactId: top.contactId,
      name: ledgerName(c),
      channelWords: line ? CHANNEL_WORDS[line.channel] : 'a message',
      waiting: Number.isFinite(sinceMs) ? `waiting ${waitWords(input.nowMs - sinceMs)}` : 'waiting',
      href: messagesThreadHref(top.contactId, top.landOnId ?? null),
    }
  }
  return { lanes, count: queue.count, first }
}

/** The station's Next line: the person waiting longest on a reply, else the first thing to sort or owe. */
export function messagesNextLine(station: MessagesStation | null): string | null {
  if (!station) return null
  if (station.first) return `Answer ${station.first.name} · ${station.first.channelWords} · ${station.first.waiting}`
  const of = (lane: MessagesLaneId) => station.lanes.find((l) => l.lane === lane)?.count ?? 0
  if (of('new') > 0) return of('new') === 1 ? 'Sort the 1 message in New' : `Sort the ${of('new')} messages in New`
  if (of('weOwe') > 0) return of('weOwe') === 1 ? 'Do the 1 thing we owe' : `Do the ${of('weOwe')} things we owe`
  if (of('needsYou') > 0) return of('needsYou') === 1 ? 'Answer the 1 line in Needs you' : `Answer the ${of('needsYou')} lines in Needs you`
  return null
}

/** The Mark's note: the lanes' counts, then the texts ledger's note and the typed words, so the history says who waited. */
export function messagesMarkNoteFor(input: { station: MessagesStation | null; ledger: TextsLedger | null; typed: string; problem: boolean }): string | null {
  const typed = input.typed.trim()
  const parts: string[] = []
  if (input.station) {
    const s = input.station
    parts.push(s.count === 0 ? 'nobody waiting on us' : `${s.count} waiting on us`)
    for (const lane of s.lanes) if (lane.count != null && lane.count > 0) parts.push(`${lane.label.toLowerCase()} ${lane.count}`)
  } else if (input.problem) parts.push('Messages could not be read')
  const head = parts.join(' · ')
  const texts = input.ledger ? `texts: ${ledgerMarkNote(input.ledger)}` : ''
  const lines = [head, texts, typed].filter(Boolean)
  return lines.length ? lines.join('\n') : null
}

export const MESSAGES_STATION_WORDS = {
  open: 'Open ›',
  answerAll: 'Answer all ›',
  texts: 'Texts',
  cleanHead: 'Nothing is waiting on us.',
  cleanSub: 'Everyone who wrote to us has an answer. Messages has the receipt.',
  problem: 'Messages could not be read. Open Messages for the lanes.',
  reading: 'Reading Messages…',
  notYours: 'Messages is the office team’s. Your note alone goes on the Mark.',
  waitingNote: 'their move, counted on Messages',
} as const
