/**
 * The customer's door on the Pipeline row (v2.5626, punch list #123): the sheet behind the speech bubble beside a
 * customer's name. What it offers comes from the facts the row already holds (the customer's mobile and email on the
 * job), and whose word came last comes from the job's own lines, so the board reads nothing new to draw the row. Since
 * v2.5632 the sheet also shows the thread's last lines (`lastLinesOnJob`), from the same read.
 */
import { messageChannelWord, type JobActivityMessage } from '../jobs/jobActivityMessages'
import { whenWords } from './thread'

export type CustomerDoorKind = 'call' | 'text' | 'email' | 'thread' | 'record'

export interface CustomerDoorRow {
  kind: CustomerDoorKind
  label: string
  enabled: boolean
  /** Why a row is grey, under it. Null when it is live. */
  why: string | null
}

export const NO_MOBILE_WORDS = 'No mobile on file. Email instead.'
export const NO_MOBILE_AT_ALL_WORDS = 'No mobile on file.'
export const NO_EMAIL_WORDS = 'No email on file. Text instead.'
export const NO_EMAIL_AT_ALL_WORDS = 'No email on file.'
export const NO_NUMBER_WORDS = 'No number on file.'

/** The sheet's rows, in order: Call, Text, Email, Open their thread, and Their record where the page has the window. */
export function customerDoorRows(facts: { phone: string | null | undefined; email: string | null | undefined; canOpenRecord: boolean }): CustomerDoorRow[] {
  const phone = (facts.phone ?? '').trim()
  const email = (facts.email ?? '').trim()
  const rows: CustomerDoorRow[] = [
    { kind: 'call', label: 'Call', enabled: phone !== '', why: phone ? null : NO_NUMBER_WORDS },
    { kind: 'text', label: 'Text', enabled: phone !== '', why: phone ? null : email ? NO_MOBILE_WORDS : NO_MOBILE_AT_ALL_WORDS },
    { kind: 'email', label: 'Email', enabled: email !== '', why: email ? null : phone ? NO_EMAIL_WORDS : NO_EMAIL_AT_ALL_WORDS },
    { kind: 'thread', label: 'Open their thread', enabled: true, why: null },
  ]
  if (facts.canOpenRecord) rows.push({ kind: 'record', label: 'Their record', enabled: true, why: null })
  return rows
}

export interface LastWord {
  who: 'them' | 'us'
  at: string
  /** The customer's name as the line carries it: the name they go by, else their name. */
  name: string
}

/** The lines that are a word between us and them: a note, an event and a team line are ours alone. */
const WORD_CHANNELS: ReadonlySet<JobActivityMessage['channel']> = new Set(['call', 'voicemail', 'missed', 'text', 'email', 'portal'])

/** Whose word came last on the job: the newest call, text, email or portal line, theirs or ours. Null with none. */
export function lastWordOnJob(lines: readonly JobActivityMessage[]): LastWord | null {
  let best: JobActivityMessage | null = null
  for (const m of lines) {
    if (!WORD_CHANNELS.has(m.channel)) continue
    if (m.direction !== 'in' && m.direction !== 'out') continue
    if (!best || m.at > best.at) best = m
  }
  if (!best) return null
  return { who: best.direction === 'in' ? 'them' : 'us', at: best.at, name: theirName(best) }
}

/** Their name as a line carries it: the name they go by, else their name. */
const theirName = (m: Pick<JobActivityMessage, 'contact'>) => (m.contact.goesBy ?? '').trim() || m.contact.name.trim() || 'They'

/** The sheet's line under the job: "Waiting on us: Dana wrote last, yesterday." or "You wrote last, today at 8:44 AM." */
export function lastWordWords(last: LastWord | null, nowIso: string): string | null {
  if (!last) return null
  const when = whenWords(last.at, nowIso)
  return last.who === 'them' ? `Waiting on us: ${last.name} wrote last, ${when}.` : `You wrote last, ${when}.`
}

// ---------- the thread's last lines (v2.5632) ----------

/** One of the thread's last lines between us and them, as the sheet draws it under whose word came last. */
export interface LastLine {
  id: string
  who: 'them' | 'us'
  /** Who wrote it: the name they go by, ours by name, or "the app" on a line it sent by itself. */
  name: string
  /** "text", "email", "call · 3:12", "missed call", "voicemail", "portal". */
  channel: string
  at: string
  /** The words on one line, clipped at a word: an email's subject or first line, a call's summary, a voicemail's words. */
  words: string
}

/** How many of the thread's lines the sheet shows: enough to know where the conversation stands, not the thread. */
export const LAST_LINES_MAX = 3
/** The longest a line's words run on the sheet before they clip at a word. */
export const LAST_LINE_WORDS_MAX = 160

/** The words on one line, clipped at a word with an ellipsis, so three lines stay three lines. */
export function clipWords(text: string, max = LAST_LINE_WORDS_MAX): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const atWord = cut.lastIndexOf(' ')
  return `${(atWord > max / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`
}

function lineWords(m: JobActivityMessage): string {
  if (m.channel === 'missed') return 'No voicemail.'
  if (m.channel === 'email') return clipWords(m.subject?.trim() || m.body.split('\n')[0] || '')
  if (m.channel === 'voicemail') return clipWords(m.transcript?.trim() || m.body.trim() || 'Left a voicemail.')
  if (m.channel === 'call') return clipWords(m.summary?.trim() || m.body)
  return clipWords(m.body)
}

/**
 * The thread's last words between us and them: the newest `max` call, text, email or portal lines, oldest first, so they
 * read down the sheet to the newest. Notes, events and team lines are ours alone and never among them.
 */
export function lastLinesOnJob(lines: readonly JobActivityMessage[], max = LAST_LINES_MAX): LastLine[] {
  const words = lines.filter((m) => WORD_CHANNELS.has(m.channel) && (m.direction === 'in' || m.direction === 'out'))
  words.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return words
    .slice(0, max)
    .reverse()
    .map((m) => ({
      id: m.id,
      who: m.direction === 'in' ? 'them' : 'us',
      name: m.direction === 'in' ? theirName(m) : m.who.trim() || 'the app',
      channel: messageChannelWord(m),
      at: m.at,
      words: lineWords(m),
    }))
}

/** The small line over a line's words: "Dana · text · yesterday", "Tanya · email · today at 8:44 AM". */
export function lastLineMeta(line: Pick<LastLine, 'name' | 'channel' | 'at'>, nowIso: string): string {
  return [line.name, line.channel, whenWords(line.at, nowIso)].filter(Boolean).join(' · ')
}
