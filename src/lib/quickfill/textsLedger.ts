/**
 * Quickfill → Texts (v2.5816, punch list #157): the day's text ledger, read from the rows Messages already draws, so
 * the station answers its own question instead of asking a person to type what they still owe. Three groups, in
 * Messages' own words: **Needs a reply**, every text nobody has answered, the one waiting longest first (the queue's
 * rows whose landing line is a text, `followUp/queue.ts`); **Not delivered**, every text of ours from today and
 * yesterday that Quo could not put on a phone (`wentOut.ts`'s rows with a bad `deliveryMark`); and **Went out today**,
 * the receipt, every text we sent today with Quo's mark. The count is the work, the first two; the receipt is not
 * counted. The Mark writes its note from the rows (`ledgerMarkNote`), so the history says who was still waiting at
 * each look, where it read "up to date" 126 mornings running. Pure; the reads are `textsLedgerIo.ts`, the station
 * `components/quickfill/QuickfillTextsSection.tsx`.
 */
import type { ContactKind } from '../contacts/kernel'
import { initials, kindWord } from '../contacts/names'
import type { NeedsReplyRow } from '../followUp/queue'
import type { NewLaneRow } from '../followUp/newLane'
import { THREAD_NUDGE_PARAM } from '../../components/gc/messages/useThreadWindow'
import { messagesThreadHref } from '../messages/customerThread'
import { waitWords } from '../messages/weekStrip'
import { wentOutRows, wentOutYmd, type WentOutLine, type WentOutRow } from '../messages/wentOut'
import type { MessageChannel } from '../messages/thread'
import { clockHm } from '../tellCustomer/tellCustomer'
import { ymdAddDays } from '../../utils/dateUtils'

/** A line as the ledger reads it: the queue's line, by id. */
export interface LedgerLine {
  id: string
  contactId: string
  channel: MessageChannel
  direction: 'in' | 'out'
  body: string
  /** ISO. */
  at: string
}

/** A person as the ledger names them. */
export interface LedgerContact {
  id: string
  name: string
  kind: ContactKind
  company?: string | null
  /** Their first number that did not send STOP, for the call; null for none. */
  phone?: string | null
}

export interface TextsLedgerInput {
  /** Needs a reply as the queue made it (`followUpQueue`), every kind, longest waiting first. */
  needsReply: ReadonlyArray<NeedsReplyRow>
  /** The New lane as the queue made it: its people are not in Needs a reply. */
  newLane?: ReadonlyArray<Pick<NewLaneRow, 'contactId'>>
  /** The lines the queue read, by id: a row's landing line, for its channel and words. */
  lines: ReadonlyMap<string, LedgerLine>
  contacts: ReadonlyArray<LedgerContact>
  /** Went out's lines as `loadWentOut` reads them: the last 7 days, texts and emails. */
  wentOut: ReadonlyArray<WentOutLine>
  todayYmd: string
  nowMs: number
}

/** A text waiting on our reply. */
export interface LedgerReplyRow {
  contactId: string
  /** Their newest line, where the thread opens. */
  landOnId: string | null
  name: string
  initials: string
  /** "customer", "trade partner", ... */
  kind: string
  /** Their first words. */
  words: string
  /** "7:55 AM" */
  when: string
  /** "waiting 2 h" */
  waiting: string
  atMs: number
  phone: string | null
  /** Their thread on Messages, at the line. */
  href: string
}

/**
 * A text of ours, as Went out draws it, with its door and the number it went to, for the Call button; and, for a text
 * Quo could not deliver, the thread opened with the step's reminder written as an email and the send window open
 * (`?nudge=email`), Waiting on them's *Send it as an email*.
 */
export type LedgerSentRow = WentOutRow & { href: string; number: string | null; emailHref: string | null }

export interface LedgerWentOut {
  rows: LedgerSentRow[]
  /** Quo delivered it. */
  delivered: number
  /** Quo has not answered yet. */
  waiting: number
  /** Quo could not put it on the phone. */
  bad: number
}

export interface TextsLedger {
  needsReply: LedgerReplyRow[]
  notDelivered: LedgerSentRow[]
  wentOutToday: LedgerWentOut
  /** Texts from numbers nobody has named, waiting in New on Messages: pointed at, not counted. */
  newTexts: number
  /** The station's count: texts needing a reply plus texts not delivered. */
  count: number
}

const WORDS_MAX = 110

const trimWords = (body: string): string => {
  const first = body.split('\n')[0]?.trim() ?? ''
  return first.length > WORDS_MAX ? `${first.slice(0, WORDS_MAX).trimEnd()}…` : first
}

/** Their name on a row: the person, else the company, else the words for a number nobody has named. */
export function ledgerName(c: Pick<LedgerContact, 'name' | 'company'> | undefined): string {
  return c?.name.trim() || c?.company?.trim() || 'A number nobody has named'
}

export function textsLedger(input: TextsLedgerInput): TextsLedger {
  const byId = new Map(input.contacts.map((c) => [c.id, c]))
  const needsReply: LedgerReplyRow[] = []
  for (const r of input.needsReply) {
    const line = r.landOnId ? input.lines.get(r.landOnId) : undefined
    if (!line || line.channel !== 'text') continue
    const c = byId.get(r.contactId)
    const atMs = Date.parse(line.at)
    needsReply.push({
      contactId: r.contactId,
      landOnId: r.landOnId,
      name: ledgerName(c),
      initials: c ? initials({ name: c.name, kind: c.kind }) : '?',
      kind: c ? kindWord(c.kind) : '',
      words: trimWords(line.body),
      when: clockHm(atMs),
      waiting: `waiting ${waitWords(input.nowMs - atMs)}`,
      atMs,
      phone: c?.phone?.trim() || null,
      href: messagesThreadHref(r.contactId, r.landOnId),
    })
  }

  const yesterday = ymdAddDays(input.todayYmd, -1)
  const texts = input.wentOut.filter((l) => (l.channel ?? 'text') === 'text')
  const numberOf = new Map(texts.map((l) => [l.id, l.number?.trim() || null]))
  const withDoor = (r: WentOutRow): LedgerSentRow => ({
    ...r,
    href: messagesThreadHref(r.contactId, r.id),
    number: numberOf.get(r.id) ?? null,
    emailHref: r.mark?.bad ? `${messagesThreadHref(r.contactId)}&${THREAD_NUDGE_PARAM}=email` : null,
  })
  const notDelivered = wentOutRows(
    texts.filter((l) => {
      const ymd = wentOutYmd(l.atMs)
      return ymd === input.todayYmd || ymd === yesterday
    }),
    'all',
    'texts',
  )
    .filter((r) => r.mark?.bad)
    .map(withDoor)
  const todayRows = wentOutRows(
    texts.filter((l) => wentOutYmd(l.atMs) === input.todayYmd),
    'all',
    'texts',
  ).map(withDoor)
  const wentOutToday: LedgerWentOut = {
    rows: todayRows,
    delivered: todayRows.filter((r) => r.mark && !r.mark.bad).length,
    waiting: todayRows.filter((r) => !r.mark).length,
    bad: todayRows.filter((r) => r.mark?.bad).length,
  }

  // A text from a number nobody has named waits in New, where Who is this? sorts it; the station points, Messages holds it.
  let newTexts = 0
  for (const r of input.newLane ?? []) {
    let newest: LedgerLine | undefined
    for (const l of input.lines.values()) if (l.contactId === r.contactId && l.direction === 'in' && (!newest || l.at > newest.at)) newest = l
    if (newest?.channel === 'text') newTexts++
  }

  return { needsReply, notDelivered, wentOutToday, newTexts, count: needsReply.length + notDelivered.length }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "5 ✓ delivered · 1 waiting on Quo", "all delivered", "1 not delivered"; '' with nothing sent. */
export function wentOutSummary(w: LedgerWentOut): string {
  if (w.rows.length === 0) return ''
  if (w.delivered === w.rows.length) return 'all delivered'
  const parts: string[] = []
  if (w.delivered) parts.push(`${w.delivered} ✓ delivered`)
  if (w.waiting) parts.push(`${w.waiting} waiting on Quo`)
  if (w.bad) parts.push(`${w.bad} not delivered`)
  return parts.join(' · ')
}

/** The receipt's part of the note: "6 went out, 5 delivered, 1 waiting on Quo". */
function wentOutNote(w: LedgerWentOut): string {
  if (w.rows.length === 0) return 'nothing went out'
  if (w.delivered === w.rows.length) return `${w.rows.length} went out, all delivered`
  const parts = [`${w.rows.length} went out`, `${w.delivered} delivered`]
  if (w.waiting) parts.push(`${w.waiting} waiting on Quo`)
  if (w.bad) parts.push(`${w.bad} not delivered`)
  return parts.join(', ')
}

/**
 * The note the Mark writes, from the rows: who was still waiting at this look, then the receipt, then the words typed
 * under Anything else on their own line. "2 need a reply · Marcus Calloway 2 h, Dana Whitfield 1 h · 1 not delivered ·
 * Tom Reyes · 6 went out, 5 delivered, 1 waiting on Quo".
 */
export function ledgerMarkNote(ledger: TextsLedger, typed: string = ''): string {
  const parts: string[] = []
  if (ledger.count === 0) parts.push('nothing waiting')
  if (ledger.needsReply.length) {
    const n = ledger.needsReply.length
    parts.push(`${n} ${n === 1 ? 'needs' : 'need'} a reply · ${ledger.needsReply.map((r) => `${r.name} ${r.waiting.replace(/^waiting /, '')}`).join(', ')}`)
  }
  if (ledger.notDelivered.length) parts.push(`${ledger.notDelivered.length} not delivered · ${ledger.notDelivered.map((r) => r.name).join(', ')}`)
  parts.push(wentOutNote(ledger.wentOutToday))
  const head = parts.join(' · ')
  const extra = typed.trim()
  return extra ? `${head}\n${extra}` : head
}

/**
 * The note any Mark of the station writes (the page's foot and header, Focus's folded line, the round's and the
 * Roller's Looked): the rows' note with the typed words; when the read failed, why there is no record, with the typed
 * words; the typed words alone for someone who does not read Messages; null for a plain mark.
 */
export function textsMarkNoteFor(input: { ledger: TextsLedger | null; typed: string; problem: boolean }): string | null {
  const typed = input.typed.trim()
  if (input.ledger) return ledgerMarkNote(input.ledger, typed)
  if (input.problem) return typed ? `the texts could not be read\n${typed}` : 'the texts could not be read'
  return typed || null
}

/** The one line a clean day reads under the banner, and its small print. */
export function cleanDayWords(ledger: TextsLedger): { head: string; sub: string } {
  const n = ledger.wentOutToday.rows.length
  return {
    head: TEXTS_LEDGER_WORDS.cleanHead,
    sub: n === 0 ? 'Nothing went out today.' : `${n} went out today, ${wentOutSummary(ledger.wentOutToday)}.`,
  }
}

export const TEXTS_LEDGER_WORDS = {
  /** The station's banner question: what the rows answer. */
  banner: 'Is anything on texts still waiting on us?',
  needsReply: 'Needs a reply',
  needsReplyNote: 'Texts nobody has answered. The one waiting longest is first.',
  notDelivered: 'Not delivered',
  notDeliveredNote: 'Our texts from today and yesterday that never reached the phone. They never read it.',
  wentOut: 'Went out today',
  show: 'Show',
  hide: 'Hide',
  reply: 'Reply',
  call: 'Call',
  callThem: 'Call them',
  openMessages: 'Open Messages ›',
  cleanHead: 'Nothing on texts is waiting on us.',
  elseLabel: 'Anything else?',
  elseHint: 'A text you owe that the app cannot see.',
  elsePlaceholder: 'Optional',
  problem: 'Texts could not be read. Messages has them.',
  reading: 'Reading the texts…',
  notOffice: 'The office team reads texts on Messages. Note anything you owe below.',
  todaysSends: (n: number) => `${plural(n, 'text', 'texts')} the app prepared ${n === 1 ? 'waits' : 'wait'} on Today's sends.`,
  todaysSendsOpen: 'Open ›',
  newTexts: (n: number) => `${plural(n, 'text', 'texts')} from a number nobody has named ${n === 1 ? 'waits' : 'wait'} in New on Messages.`,
  newTextsOpen: 'Sort ›',
} as const
