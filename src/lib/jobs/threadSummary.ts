/**
 * Where a job stands with its customer (punch list #186, item 2A, v2.5895): three lines at the top of the job window's
 * Job tab, built from the facts the app already keeps and nothing else. The last word each way comes from the job's
 * lines (`loadJobMessages`), their word from a written promise whose day has not passed (`message_promises`), our word
 * from what we owe them (`contact_owed`). Every word on the card is a row a person wrote, so each line is a door to the
 * line it came from, and the stamp says when it was read and from how many lines and events. The card is drawn, never
 * stored: nothing is written unless **Keep as a note** is pressed, and then the three lines and the stamp go in as a
 * note on the job through the window's own note path. Pure; `threadSummaryIo.ts` reads, `JobThreadSummary.tsx` draws.
 */
import { firstName } from '../contacts/names'
import { heardLinesFromRows, owedRecordsFromRows, type ContactOwedRow, type MessagePromiseRow } from '../followUp/followUpRows'
import { openOwed } from '../followUp/queue'
import { threadHrefByKind } from '../messages/customerThread'
import { dayLabel, owedSentence } from '../messages/owed'
import type { HeardPromiseKind } from '../messages/promises'
import { clockTime, whenWords, type MessageChannel } from '../messages/thread'
import type { JobActivityMessage } from './jobActivityMessages'
import { jobStatusWord } from './jobContractCovers'

/** The card's words, held to the plain-words rule in the tests. */
export const SUMMARY_WORDS = {
  title: (name: string) => `Where it stands with ${name}`,
  stands: 'Where it stands',
  theirs: 'Their word',
  ours: 'Our word',
  readAgain: 'Read again',
  keep: 'Keep as a note',
  keeping: 'Keeping…',
  kept: 'Kept as a note on the job.',
  quiet: 'Nothing is written unless you press Keep as a note.',
  reading: 'Reading the lines…',
  failed: 'The lines could not be read. Press Read again.',
  fold: 'Fold',
  unfold: 'Open',
} as const

/** The three lines, in order. */
export type SummaryKey = 'stands' | 'theirs' | 'ours'

export interface SummaryLine {
  key: SummaryKey
  label: string
  text: string
  /** The line it came from, opened in Messages. Null when the fact has no line. */
  href: string | null
  /** The door's words: "the text", "their word". '' with no door. */
  doorWord: string
}

export interface ThreadSummary {
  lines: SummaryLine[]
  /** "Read 8:10 AM from 41 lines and 12 events." */
  stamp: string
  counts: { lines: number; events: number }
  /** What Keep as a note writes: the title with the stamp, then the three lines. */
  noteBody: string
}

export interface ThreadSummaryInputs {
  customer: { name: string; goesBy?: string | null }
  job: { status: string | null; pctComplete: number | null }
  /** The job's lines, as `loadJobMessages` reads them. */
  lines: readonly JobActivityMessage[]
  /** How many items the job's activity feed holds: notes, reports, clock sessions, events. */
  eventCount: number
  /** What we owe, open rows for the job's customer contacts. */
  owed: readonly ContactOwedRow[]
  /** Their written promises whose day has not passed, for the same contacts. */
  promises: readonly MessagePromiseRow[]
  nowIso: string
  /** Today, YYYY-MM-DD in the company's time zone. */
  todayYmd: string
}

/** The lines that are a word between us and them. A note, an event and a team line are ours alone. */
const WORD_CHANNELS: ReadonlySet<MessageChannel> = new Set(['call', 'voicemail', 'missed', 'text', 'email', 'portal'])

/** What the last word was: "a text", "a missed call". */
function lastNoun(channel: MessageChannel): string {
  switch (channel) {
    case 'text':
      return 'a text'
    case 'email':
      return 'an email'
    case 'call':
      return 'a call'
    case 'voicemail':
      return 'a voicemail'
    case 'missed':
      return 'a missed call'
    case 'portal':
      return 'a message on their page'
    default:
      return 'a line'
  }
}

/** The door's words for a line: "the text", "the call". */
function doorWordFor(channel: MessageChannel): string {
  switch (channel) {
    case 'text':
      return 'the text'
    case 'email':
      return 'the email'
    case 'call':
      return 'the call'
    case 'voicemail':
      return 'the voicemail'
    case 'missed':
      return 'the missed call'
    case 'portal':
      return 'their message'
    default:
      return 'the line'
  }
}

/** What a promise of each kind is, as the line says it. `said` is a day given on a call, no kind. */
const PROMISE_WHAT: Record<Exclude<HeardPromiseKind, 'said'>, string> = {
  quote: 'a quote',
  start: 'a start',
  papers: 'the papers',
  payment: 'a payment',
  decision: 'a decision',
  access: 'a day we can be on site',
  answer: 'an answer',
  cert: 'a certificate',
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

/** The newest line that is a word between us and them, theirs or ours. */
export function lastWordLine(lines: readonly JobActivityMessage[]): JobActivityMessage | null {
  let best: JobActivityMessage | null = null
  for (const m of lines) {
    if (!WORD_CHANNELS.has(m.channel)) continue
    if (m.direction !== 'in' && m.direction !== 'out') continue
    if (!best || m.at > best.at) best = m
  }
  return best
}

/** The customer contacts on the job's lines, each once. */
export function customerContactIds(lines: readonly JobActivityMessage[]): string[] {
  return [...new Set(lines.filter((m) => m.contact.kind === 'customer').map((m) => m.contactId))]
}

/** Where it stands: whose word came last and when, then the job's stage and percent. */
function standsLine(inputs: ThreadSummaryInputs, name: string): SummaryLine {
  const last = lastWordLine(inputs.lines)
  const status = jobStatusWord(inputs.job.status)
  const pct = inputs.job.pctComplete
  const jobWords = status ? (pct != null ? ` The job is ${status} at ${pct}%.` : ` The job is ${status}.`) : pct != null ? ` The job reads ${pct}% done.` : ''
  if (!last) {
    return { key: 'stands', label: SUMMARY_WORDS.stands, text: `No calls, texts or emails with ${name} on this job yet.${jobWords}`, href: null, doorWord: '' }
  }
  const who = last.direction === 'in' ? firstName(last.contact) || name : last.who.trim() || 'the app'
  const text = `The last word was ${who}’s, ${lastNoun(last.channel)} ${whenWords(last.at, inputs.nowIso)}.${jobWords}`
  return { key: 'stands', label: SUMMARY_WORDS.stands, text, href: threadHrefByKind(last.contact.kind, last.contactId, last.id), doorWord: doorWordFor(last.channel) }
}

/** Their word: the newest written promise whose day has not passed, on any customer contact of the job. */
function theirsLine(inputs: ThreadSummaryInputs, name: string, contactIds: readonly string[]): SummaryLine {
  const people = new Set(contactIds)
  let best: { messageId: string; contactId: string; at: string; kind: HeardPromiseKind; dayYmd: string } | null = null
  for (const line of heardLinesFromRows(inputs.promises)) {
    if (!people.has(line.contactId) || line.kind === 'question' || line.state !== 'written') continue
    if (!line.kind || !line.dayYmd || line.dayYmd < inputs.todayYmd) continue
    if (best && line.at <= best.at) continue
    best = { messageId: line.messageId, contactId: line.contactId, at: line.at, kind: line.kind, dayYmd: line.dayYmd }
  }
  if (!best) return { key: 'theirs', label: SUMMARY_WORDS.theirs, text: `No day of ${name}’s is written down.`, href: null, doorWord: '' }
  const day = dayLabel(best.dayYmd)
  const said = `Said ${whenWords(best.at, inputs.nowIso)}.`
  const text = best.kind === 'said' ? `${name} gave ${day} on the call. ${said}` : `${name} promised ${PROMISE_WHAT[best.kind]} by ${day}. ${said}`
  return { key: 'theirs', label: SUMMARY_WORDS.theirs, text, href: threadHrefByKind('customer', best.contactId, best.messageId), doorWord: 'their word' }
}

/** Our word: what we owe them, the newest open row on any customer contact of the job. */
function oursLine(inputs: ThreadSummaryInputs, contactIds: readonly string[]): SummaryLine {
  const records = owedRecordsFromRows(inputs.owed, {})
  let best: ReturnType<typeof openOwed> = null
  for (const id of contactIds) {
    const open = openOwed(records, id)
    if (open && (!best || open.markedAt > best.markedAt)) best = open
  }
  if (!best) return { key: 'ours', label: SUMMARY_WORDS.ours, text: 'Nothing we owe is written down.', href: null, doorWord: '' }
  const text = `${owedSentence(inputs.customer, best)}. Marked ${whenWords(best.markedAt, inputs.nowIso)}.`
  return { key: 'ours', label: SUMMARY_WORDS.ours, text, href: null, doorWord: '' }
}

/** The three lines, the stamp and the note's body, from the facts. */
export function buildThreadSummary(inputs: ThreadSummaryInputs): ThreadSummary {
  const name = firstName(inputs.customer) || inputs.customer.name.trim() || 'the customer'
  const contactIds = customerContactIds(inputs.lines)
  const lines = [standsLine(inputs, name), theirsLine(inputs, name, contactIds), oursLine(inputs, contactIds)]
  const counts = { lines: inputs.lines.filter((m) => m.channel !== 'event').length, events: inputs.eventCount }
  const stamp = `Read ${clockTime(inputs.nowIso)} from ${plural(counts.lines, 'line')} and ${plural(counts.events, 'event')}.`
  const noteBody = [`${SUMMARY_WORDS.title(name)}, ${stamp.charAt(0).toLowerCase()}${stamp.slice(1)}`, ...lines.map((l) => `${l.label}: ${l.text}`)].join('\n')
  return { lines, stamp, counts, noteBody }
}

/** Whether the card is folded on this browser; open until someone folds it. */
export const SUMMARY_FOLD_KEY = 'job_thread_summary_folded'

export function readFolded(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    return storage?.getItem(SUMMARY_FOLD_KEY) === '1'
  } catch {
    return false
  }
}

export function keepFolded(folded: boolean, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(SUMMARY_FOLD_KEY, folded ? '1' : '0')
  } catch {
    // A browser that refuses storage keeps the card open; nothing else changes.
  }
}
