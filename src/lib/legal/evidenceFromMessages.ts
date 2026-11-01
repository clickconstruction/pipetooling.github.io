/**
 * The Legal desk's Evidence door, **From the job's messages…** (punch list #230 PR 5,
 * `to-dos/messages-my-email/README.md`, section 4). The email on a collections account's jobs, as Messages holds it,
 * goes on the matter as `.eml` files the firm opens in any mail program: one document per email, put there by the
 * office's tick on the desk. The owner's call (2026-11-01): the desk pulls, and a tag in Messages never writes to a
 * matter. Pure. The reads and the writes are `evidenceFromMessagesIo.ts`; the window is
 * `components/jobs/legal/LegalEvidenceFromMessagesWindow.tsx`.
 *
 * - `conversationsOf`: the jobs' email lines by Gmail conversation, newest first, each with its subject, how many
 *   emails, the span in the app's day words, the parties, where it came from and the job (as `jobTiles.ts` prints
 *   one); then the app's own sends from `sent_documents`, one row each.
 * - `emlOf`: a faithful `message/rfc822` for a line the boxes read or the app sent: its headers, an
 *   `X-PipeTooling-Record` naming what it was made from, its words, and each kept file inside when its bytes are
 *   handed in and fit the matter's 10 MB, else named at the foot. A line tagged from a person's own mail has its raw
 *   copy as received (`myMailRawPath`, kept by `gmail-mine`); the io files that instead and makes one here only when
 *   the raw copy is missing, which the row's one line then says.
 * - `documentDraftOf`: the Evidence row an email becomes: its title, its one line, its day, its state and its line.
 * - `putPlan`: what the press does, the emails it puts and the ones it holds with their reason, and the counted
 *   button; `putOutcomeWords` after the press.
 */
import type { LegalMatterDocumentAdd } from './legalMatterDocumentsIo'
import { LEGAL_DOCUMENT_MAX_BYTES, legalDocumentSizeWords, type LegalDocumentWhose } from './legalMatterDocuments'
import { mailboxDisplayName } from '../../../supabase/functions/_shared/mailboxWithName'
import { batchOutcomeWords, countedLabel, pluralNoun, type BatchOutcome } from '../batchWords'
import { decodeEntities, htmlToText, parseAddress, parseAddressList, type EmailAddress } from '../emailIn/gmailMessage'
import { fileNote } from '../messages/lineFiles'
import { bidTile, pipelineTile, type BidTileRow, type PipelineTileRow } from '../messages/jobTiles'
import { MY_MAIL_NO_SUBJECT } from '../myMail/contract'
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso, formatWorkDateYmdFriendly, formatWorkDateYmdMonthDayShort, ymdAddDays } from '../../utils/dateUtils'

// ---------- what the door reads ----------

/** A `message_attachments` row of an email line: a file we keep a copy of, one left in Gmail, or a file host's link. */
export interface EvidenceLineFile {
  id: string
  name: string
  mime: string | null
  size: number | null
  /** Our copy in the private `message-attachments` bucket; null when we kept none. */
  bucketPath: string | null
  /** `link` for a file host's link, `file` for every other row. */
  kind: string
  url: string | null
  /** Why a file stayed where it came from: `too_big`, `not_copied`, `quo_not_copied`. */
  leftInGmail: string | null
}

/** An email the app sent itself, as `sent_documents` filed it (`docs/SENT_COPIES.md`): the copy as it went, and its files. */
export interface EvidenceSentCopy {
  id: string
  kind: string
  title: string
  subject: string
  recipientName: string
  recipientEmails: readonly string[]
  sentAt: string
  sentByName: string
  /** The kept page (`<id>/copy.html` in `sent-documents`); null when the copy was not kept. */
  copyPath: string | null
  copyType: string
  copyBytes: number | null
  attachments: ReadonlyArray<{ name: string; path: string; type: string; bytes: number | null }>
  /** The account's job it names first, as Messages keys a job (`pipeline:<id>`, `bid:<id>`). */
  jobKey: string
}

/** One email line on the account's jobs, with its person's name and kind and its channel's address. */
export interface EvidenceLine {
  id: string
  contactId: string
  /** The person the line is with, as Messages names them; '' when the contact has no name. */
  contactName: string
  /** Their kind (`customer`, `trade`, `supply_house`…): a mail from a supply house is the supplier's paper. */
  contactKind: string
  /** The address the line came from or went to: its channel's value; '' when it names none. */
  contactAddress: string
  /** The job it is tied to, as Messages keys one (`pipeline:<id>`, `bid:<id>`). */
  jobKey: string
  direction: 'in' | 'out'
  at: string
  subject: string
  body: string
  whoUserId: string | null
  /** The line's who as the reader wrote it: `Greg Paulk <greg@…> to bids@`, `Rosa <…> to Greg <…> · copied to bids@`. */
  whoText: string
  /** The box it came through: `team`, `bids`, `mine` (tagged from a person's own mail), or null. */
  mailbox: string | null
  /** Whose own mail a `mine` line was tagged from. */
  mailUserId: string | null
  /** Gmail's id for the mail; null on a line the app wrote itself, an email sent from the reply box. */
  gmailId: string | null
  gmailThreadId: string | null
  /** The mail's own Message-ID header, kept when a box or a tag wrote the line (v2.5504). */
  rfcMessageId: string | null
  files: readonly EvidenceLineFile[]
  /** The reply box's filed copy of this line (`sent_documents.source_id`), when the app sent it. */
  filed?: EvidenceSentCopy | null
}

/** One email of a row: a Messages line, or a copy the app filed when it sent one. */
export type EvidenceItem =
  | { kind: 'line'; key: string; at: string; line: EvidenceLine }
  | { kind: 'sent'; key: string; at: string; copy: EvidenceSentCopy }

/** The team by user id: their name for the words, their address for a line tagged from their own mail. */
export interface EvidencePeople {
  users: Readonly<Record<string, { name: string; email: string }>>
}

/** The account's jobs as the rows name them, and today. */
export interface EvidenceJobs {
  /** Each job's words by its key: the number and the name as `jobTiles.ts` prints them, `J1077 · 4 Elm Ct`. */
  words: Readonly<Record<string, string>>
  todayYmd: string
}

/** A row of the door: a conversation of email lines, or one of the app's own sends. */
export interface EvidenceConversation {
  key: string
  kind: 'conversation' | 'send'
  /** The first subject that is not empty, or `(no subject)`. */
  subject: string
  /** Oldest first: the order a document's `n of count` counts. */
  items: EvidenceItem[]
  count: number
  /** `Oct 24 to today`, `Sep 30`. */
  span: string
  /** `Re: 4 Elm Ct water heater · 4 emails, Oct 24 to today`. */
  headline: string
  /** The people on the other side, each once, as Messages names them. */
  parties: string[]
  /** Where it came from: `tagged by Marisol from their mail`, `read from bids@`, `the app’s own send · the filed copy`. */
  provenance: string
  jobKey: string
  jobWords: string
  lastAt: string
}

/** The words of the door and its window, one home. */
export const EVIDENCE_FROM_MESSAGES_WORDS = {
  door: 'From the job’s messages…',
  title: 'From the job’s messages',
  doorHint: 'Put an email conversation on the account’s jobs on this matter, one .eml per email',
  loading: 'Reading the email on this account’s jobs…',
  emptyMain: 'No email on this account’s jobs yet.',
  emptyPress: 'Tag one from Messages',
  emptyTail: 'or copy bids@ on your next email.',
  sends: 'The app’s own sends',
  onMatter: 'on the matter',
  notNow: 'Not now',
  close: 'Close',
  putting: 'Putting the emails on the matter…',
  readFailed: 'The email on this account’s jobs did not load.',
  putFailed: 'The email did not go on the matter.',
  notPushed: 'This door opens once its database update is pushed. Ask a dev to push it, then open it again.',
  alreadyOn: 'Already on the matter. Someone put it there while this window was open.',
  tooBigMade: 'The copy would be over the 10 MB a matter takes.',
  lineDoor: 'The line in Messages',
  lineRecord: 'Made from an email in Messages.',
} as const

/** What a row says it came from when the app sent it. */
export const SENT_PROVENANCE = 'the app’s own send · the filed copy'

/** The bucket a tagged line's raw copy is kept in, beside the files the boxes copy. */
export const MY_MAIL_RAW_BUCKET = 'message-attachments'

/** Where `gmail-mine` keeps a tagged line's raw mail as received (its `myMailEmlPath`, punch list #230 PR 2). */
export function myMailRawPath(lineId: string): string {
  return `mine/${lineId}.eml`
}

/** An item's key: a line's by its id, a sent copy's by its own. */
export const lineItemKey = (lineId: string): string => `line:${lineId}`
export const sentItemKey = (copyId: string): string => `sent:${copyId}`

/** The line in Messages: the thread window over `/messages`, opened at the line. */
export function messagesLineHref(contactId: string, messageId: string): string {
  return `/messages?thread=${encodeURIComponent(contactId)}&at=${encodeURIComponent(messageId)}`
}

// ---------- the app's day words ----------

const YMD = /^\d{4}-\d{2}-\d{2}$/

/** `today`, `yesterday`, `Oct 24`, and the year when it is not this one: `Oct 24, 2025`. '' for no day. */
export function evidenceDayWords(ymd: string, todayYmd: string): string {
  if (!YMD.test(ymd)) return ''
  if (ymd === todayYmd) return 'today'
  if (ymd === ymdAddDays(todayYmd, -1)) return 'yesterday'
  const md = formatWorkDateYmdMonthDayShort(ymd)
  return ymd.slice(0, 4) === todayYmd.slice(0, 4) ? md : `${md}, ${ymd.slice(0, 4)}`
}

/** `Oct 24 to today`; one day alone when the span is a day. */
export function evidenceSpanWords(firstYmd: string, lastYmd: string, todayYmd: string): string {
  const a = evidenceDayWords(firstYmd, todayYmd)
  const b = evidenceDayWords(lastYmd, todayYmd)
  if (!a) return b
  if (!b || firstYmd === lastYmd) return a
  return `${a} to ${b}`
}

/** The heading line under the window's title: `emails on J1077 and J1062`; past four jobs, how many. */
export function evidenceJobsWords(jobNumbers: readonly string[]): string {
  const list = [...new Set(jobNumbers.map((n) => n.trim()).filter(Boolean))]
  if (list.length === 0) return 'no jobs on this account'
  if (list.length > 4) return `emails on ${list.length} jobs`
  if (list.length === 1) return `emails on ${list[0]}`
  return `emails on ${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** An account's job as the desk holds it (`JobWithDetails` has every field): a Pipeline job, and the bid it came from. */
export type EvidenceJobRow = PipelineTileRow & { bid_id?: string | null }

/**
 * The account's jobs as the rows and the heading name them: each Pipeline job and each bid it came from by its key,
 * its number and name as `jobTiles.ts` prints them (`J1077 · 4 Elm Ct`, `B482 · 4 Elm Ct`), and the jobs' numbers.
 */
export function evidenceJobTiles(jobs: readonly EvidenceJobRow[], bids: readonly BidTileRow[], todayYmd: string): { words: Record<string, string>; numbers: string[] } {
  const words: Record<string, string> = {}
  const numbers: string[] = []
  for (const job of jobs) {
    const tile = pipelineTile(job)
    words[tile.key] = `${tile.num} · ${tile.name}`
    numbers.push(tile.num)
  }
  for (const bid of bids) {
    const tile = bidTile(bid, todayYmd)
    words[tile.key] = `${tile.num} · ${tile.name}`
  }
  return { words, numbers }
}

// ---------- the rows ----------

const dayOf = (iso: string): string => calendarYmdInAppTzFromIso(iso)
const subjectOf = (raw: string | null | undefined): string => (raw ?? '').replace(/\s+/g, ' ').trim()
const nameOf = (people: EvidencePeople, id: string | null): string => (id ? (people.users[id]?.name ?? '').trim() : '')
const byAt = (a: { at: string; key: string }, b: { at: string; key: string }): number => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || a.key.localeCompare(b.key)

/** The person a line is with, as the rows and the one line name them. */
export function partyOfLine(line: Pick<EvidenceLine, 'contactName' | 'contactAddress'>): string {
  return line.contactName.trim() || line.contactAddress.trim() || 'someone'
}

/** Who a sent copy went to. */
export function partyOfSent(copy: Pick<EvidenceSentCopy, 'recipientName' | 'recipientEmails'>): string {
  return copy.recipientName.trim() || copy.recipientEmails.join(', ') || 'the customer'
}

/** Where one line came from, in the row's words. */
export function lineProvenance(line: Pick<EvidenceLine, 'mailbox' | 'mailUserId' | 'gmailId' | 'direction' | 'whoUserId'>, people: EvidencePeople): string {
  if (line.mailbox === 'mine') return `tagged by ${nameOf(people, line.mailUserId) || 'a teammate'} from their mail`
  if (!line.gmailId) return line.direction === 'out' ? `sent from Messages by ${nameOf(people, line.whoUserId) || 'the office'}` : 'written in Messages'
  return line.mailbox === 'team' ? 'read from team@' : 'read from bids@'
}

/**
 * The account's email, as the door lists it: the lines by Gmail conversation on each job (a line with no conversation
 * stands alone), newest conversation first, then the app's own sends, newest first, one row each.
 */
export function conversationsOf(lines: readonly EvidenceLine[], sentCopies: readonly EvidenceSentCopy[], people: EvidencePeople, jobs: EvidenceJobs): EvidenceConversation[] {
  const groups = new Map<string, EvidenceLine[]>()
  for (const line of lines) {
    const thread = line.gmailThreadId?.trim()
    const key = thread ? `thread:${thread}|${line.jobKey}` : lineItemKey(line.id)
    groups.set(key, [...(groups.get(key) ?? []), line])
  }
  const conversations: EvidenceConversation[] = []
  for (const [key, list] of groups) {
    const items: EvidenceItem[] = list.map((line) => ({ kind: 'line' as const, key: lineItemKey(line.id), at: line.at, line })).sort(byAt)
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) continue
    const ordered = items.map((i) => (i.kind === 'line' ? i.line : null)).filter((l): l is EvidenceLine => l !== null)
    const subject = ordered.map((l) => subjectOf(l.subject)).find(Boolean) ?? MY_MAIL_NO_SUBJECT
    const span = evidenceSpanWords(dayOf(first.at), dayOf(last.at), jobs.todayYmd)
    const count = items.length
    const jobKey = ordered[ordered.length - 1]?.jobKey ?? ''
    conversations.push({
      key,
      kind: 'conversation',
      subject,
      items,
      count,
      span,
      headline: `${subject} · ${count} ${pluralNoun('email', count)}, ${span}`,
      parties: [...new Set(ordered.map(partyOfLine))],
      provenance: [...new Set(ordered.map((l) => lineProvenance(l, people)))].join(' · '),
      jobKey,
      jobWords: jobs.words[jobKey] ?? '',
      lastAt: last.at,
    })
  }
  conversations.sort((a, b) => (Date.parse(b.lastAt) || 0) - (Date.parse(a.lastAt) || 0) || a.key.localeCompare(b.key))
  const sends: EvidenceConversation[] = sentCopies.map((copy) => {
    const subject = subjectOf(copy.subject) || subjectOf(copy.title) || MY_MAIL_NO_SUBJECT
    const span = evidenceDayWords(dayOf(copy.sentAt), jobs.todayYmd)
    return {
      key: sentItemKey(copy.id),
      kind: 'send',
      subject,
      items: [{ kind: 'sent', key: sentItemKey(copy.id), at: copy.sentAt, copy }],
      count: 1,
      span,
      headline: `${subject} · ${span}`,
      parties: [partyOfSent(copy)],
      provenance: SENT_PROVENANCE,
      jobKey: copy.jobKey,
      jobWords: jobs.words[copy.jobKey] ?? '',
      lastAt: copy.sentAt,
    }
  })
  sends.sort((a, b) => (Date.parse(b.lastAt) || 0) - (Date.parse(a.lastAt) || 0) || a.key.localeCompare(b.key))
  return [...conversations, ...sends]
}

/** How many of a row's emails are on the matter already, and whether all are. */
export function conversationOnMatter(c: Pick<EvidenceConversation, 'items'>, onMatter: ReadonlySet<string>): { on: number; all: boolean } {
  const on = c.items.filter((i) => onMatter.has(i.key)).length
  return { on, all: c.items.length > 0 && on === c.items.length }
}

/** A sent copy's document is known on the matter by its file's name, `sent-<copy id> …`. */
const SENT_FILE_NAME = /^sent-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?![0-9a-f-])/i

/** The items a matter's live documents already hold: a line by `source_message_id`, a sent copy by its file's name. */
export function onMatterKeys(docs: ReadonlyArray<{ source_message_id?: string | null; original_name?: string | null }>): Set<string> {
  const out = new Set<string>()
  for (const d of docs) {
    if (d.source_message_id) out.add(lineItemKey(d.source_message_id))
    const sent = SENT_FILE_NAME.exec(d.original_name ?? '')
    if (sent?.[1]) out.add(sentItemKey(sent[1].toLowerCase()))
  }
  return out
}

// ---------- the .eml ----------

/** What `emlOf` needs to know beyond the line: today, the boxes' addresses, the team and the app's own sender. */
export interface EvidenceEmlContext {
  todayYmd: string
  /** The shared boxes' addresses as Settings keeps them, the To of a mail that came in on one. */
  boxes: Partial<Record<'team' | 'bids', string>>
  users: EvidencePeople['users']
  /** What the app sends a customer's email as: `Click Plumbing and Electrical <team@…>`. */
  appFrom: string
}

/** A file handed to `emlOf`: its bytes when they were read, else its name and why it is not inside. */
export interface EmlFile {
  name: string
  mime: string
  /** Read from our copy; null when we kept none, or the read failed. */
  bytes: Uint8Array | null
  /** Why it is not inside when it has no bytes: `too big to keep, it stays in Gmail`. */
  note?: string
}

export interface EmlBuilt {
  /** The `.eml`: CRLF line ends, ASCII only, every part encoded. */
  text: string
  /** Its size in bytes (the text is ASCII, so its length). */
  bytes: number
  /** The files carried inside. */
  attached: string[]
  /** The files named at the foot instead, each with why: `plans.pdf: too big to keep, it stays in Gmail`. */
  listed: string[]
}

const CRLF = '\r\n'
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const encoder = new TextEncoder()

/** Bytes as base64, one string. */
export function base64Of(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (b === undefined ? '=' : B64[(n >> 6) & 63]!) + (c === undefined ? '=' : B64[n & 63]!)
  }
  return out
}

/** Bytes as base64 in lines of 76, the way a mail carries a file. */
function base64Lines(bytes: Uint8Array): string {
  const lines: string[] = []
  for (let i = 0; i < bytes.length; i += 57) lines.push(base64Of(bytes.subarray(i, i + 57)))
  return lines.join(CRLF)
}

/** Text as quoted-printable UTF-8 (RFC 2045): readable where it is plain, every line at most 76. */
export function quotedPrintable(text: string): string {
  const out: string[] = []
  for (const source of text.replace(/\r\n?/g, '\n').split('\n')) {
    const bytes = encoder.encode(source)
    let line = ''
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i] ?? 0
      const last = i === bytes.length - 1
      const plain = (b >= 33 && b <= 126 && b !== 61) || ((b === 32 || b === 9) && !last)
      const token = plain ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, '0')}`
      if (line.length + token.length > 75) {
        out.push(`${line}=`)
        line = ''
      }
      line += token
    }
    out.push(line)
  }
  return out.join(CRLF)
}

/** A header's words: as they are when plain ASCII, else RFC 2047 words of at most 45 bytes each, folded. */
export function headerWords(text: string): string {
  if (PRINTABLE_ASCII.test(text)) return text
  const words: string[] = []
  let chunk: number[] = []
  for (const ch of text) {
    const b = encoder.encode(ch)
    if (chunk.length + b.length > 45) {
      words.push(`=?UTF-8?B?${base64Of(Uint8Array.from(chunk))}?=`)
      chunk = []
    }
    chunk.push(...b)
  }
  if (chunk.length) words.push(`=?UTF-8?B?${base64Of(Uint8Array.from(chunk))}?=`)
  return words.join(`${CRLF} `)
}

/** One mailbox as a header writes it: `Dale Okafor <dale@x>`, `"Okafor, Dale" <dale@x>`, the bare address with no name. */
export function mailboxHeader(a: EmailAddress): string {
  const address = a.address.trim()
  const name = (a.name ?? '').replace(/\s+/g, ' ').trim()
  if (!name || name.toLowerCase() === address.toLowerCase()) return address
  return `${PRINTABLE_ASCII.test(name) ? mailboxDisplayName(name) : headerWords(name)} <${address}>`
}

/** A list of mailboxes, folded when the line would run long. */
function mailboxListHeader(list: readonly EmailAddress[]): string {
  const parts = list.map(mailboxHeader)
  return parts.join(parts.join(', ').length > 70 ? `,${CRLF} ` : ', ')
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const pad2 = (n: number): string => String(n).padStart(2, '0')

/** An instant as RFC 5322 writes a Date: the company's own wall time with its offset, `Fri, 24 Oct 2026 14:03:00 -0500`. */
export function rfc5322Date(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: APP_CALENDAR_TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d)
  const g = (t: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === t)?.value ?? '0')
  const [y, mo, da, h, mi, s] = [g('year'), g('month'), g('day'), g('hour'), g('minute'), g('second')]
  const offset = Math.round((Date.UTC(y, mo - 1, da, h, mi, s) - Math.floor(d.getTime() / 1000) * 1000) / 60_000)
  const abs = Math.abs(offset)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, da)).getUTCDay()] ?? 'Sun'
  return `${weekday}, ${da} ${MONTHS[mo - 1] ?? 'Jan'} ${y} ${pad2(h)}:${pad2(mi)}:${pad2(s)} ${offset < 0 ? '-' : '+'}${pad2(Math.floor(abs / 60))}${pad2(abs % 60)}`
}

/** The first mailbox in a reader's who (`Greg Paulk <greg@x> to bids@`), and the one after ` to ` on a mail out. */
const MAILBOX_AHEAD = /^\s*((?:"[^"]*"|[^<>"@]*?)\s*<[^<>\s]+@[^<>\s]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@·]+)/

function whoMailboxes(whoText: string): { from: EmailAddress | null; to: EmailAddress | null; copiedToBox: boolean } {
  const head = MAILBOX_AHEAD.exec(whoText)
  const from = head?.[1] ? parseAddress(head[1]) : null
  const rest = head ? whoText.slice(head[0].length) : ''
  const toMatch = /^\s+to\s+/.exec(rest)
  const toHead = toMatch ? MAILBOX_AHEAD.exec(rest.slice(toMatch[0].length)) : null
  return { from, to: toHead?.[1] ? parseAddress(toHead[1]) : null, copiedToBox: / · copied to /.test(whoText) }
}

/** A line of the filed copy's grey head (`sentEmailCopyHtml`): `<div><b>From</b> …</div>`, its words back. */
export function filedHeader(html: string | null | undefined, label: 'From' | 'To' | 'Cc' | 'Subject'): string | null {
  if (!html) return null
  const m = new RegExp(`<div><b>${label}</b>\\s*([^<]*)</div>`).exec(html)
  const value = m?.[1] ? decodeEntities(m[1]).trim() : ''
  return value || null
}

interface EmlHead {
  from: EmailAddress | null
  to: EmailAddress[]
  cc: EmailAddress[]
  at: string
  subject: string
  messageId: string | null
  record: string
}

function emlHeadOf(item: EvidenceItem, ctx: EvidenceEmlContext, html: string | null): EmlHead {
  if (item.kind === 'sent') {
    const c = item.copy
    const filedTo = parseAddressList(filedHeader(html, 'To') ?? undefined)
    const to = filedTo.length ? filedTo : c.recipientEmails.map((address) => ({ name: c.recipientEmails.length === 1 && c.recipientName ? c.recipientName : null, address }))
    return {
      from: parseAddress(filedHeader(html, 'From') ?? ctx.appFrom),
      to,
      cc: parseAddressList(filedHeader(html, 'Cc') ?? undefined),
      at: c.sentAt,
      subject: filedHeader(html, 'Subject') ?? (subjectOf(c.subject) || subjectOf(c.title)),
      messageId: null,
      record: `made from the app's sent copy ${c.id} on ${ctx.todayYmd}`,
    }
  }
  const line = item.line
  const who = whoMailboxes(line.whoText)
  const contact: EmailAddress | null = line.contactAddress.trim() ? { name: line.contactName.trim() || null, address: line.contactAddress.trim() } : null
  const boxAddress = line.mailbox === 'team' || line.mailbox === 'bids' ? ctx.boxes[line.mailbox]?.trim() : ''
  const box: EmailAddress | null = boxAddress ? { name: null, address: boxAddress } : null
  const owner = line.mailbox === 'mine' && line.mailUserId ? ctx.users[line.mailUserId] : undefined
  const mine: EmailAddress | null = owner?.email ? { name: owner.name || null, address: owner.email } : null
  const sender = line.whoUserId ? ctx.users[line.whoUserId] : undefined
  const record = `made from Messages line ${line.id} on ${ctx.todayYmd}`
  const base = { at: line.at, subject: subjectOf(line.subject), messageId: line.rfcMessageId?.trim() || null, record }
  if (line.direction === 'in') return { ...base, from: who.from ?? contact, to: line.mailbox === 'mine' ? (mine ? [mine] : []) : box ? [box] : [], cc: [] }
  const from =
    who.from ??
    parseAddress(filedHeader(html, 'From') ?? '') ??
    (line.mailbox === 'mine' ? mine : null) ??
    (!line.gmailId ? parseAddress(ctx.appFrom) : null) ??
    (sender?.email ? { name: sender.name || null, address: sender.email } : null)
  return { ...base, from, to: who.to ? [who.to] : contact ? [contact] : [], cc: who.copiedToBox && box ? [box] : [] }
}

/** A file's name as a Content-Disposition carries it: quoted when plain, RFC 2231 with an ASCII stand-in when not. */
function fileNameParams(name: string): { type: string; disposition: string } {
  const clean = name.replace(/[\r\n"]+/g, ' ').trim() || 'file'
  if (PRINTABLE_ASCII.test(clean)) {
    const quoted = clean.replace(/\\/g, '\\\\')
    return { type: `name="${quoted}"`, disposition: `filename="${quoted}"` }
  }
  const ascii = clean.replace(/[^\x20-\x7e]+/g, '_')
  const encoded = [...encoder.encode(clean)].map((b) => (/[A-Za-z0-9._-]/.test(String.fromCharCode(b)) ? String.fromCharCode(b) : `%${b.toString(16).toUpperCase().padStart(2, '0')}`)).join('')
  return { type: `name="${ascii}"`, disposition: `filename="${ascii}"; filename*=UTF-8''${encoded}` }
}

const textPart = (text: string): string => ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '', quotedPrintable(text)].join(CRLF)
const htmlPart = (html: string): string => ['Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '', quotedPrintable(html)].join(CRLF)

function multipart(subtype: 'mixed' | 'alternative', boundary: string, parts: readonly string[]): string {
  return [`Content-Type: multipart/${subtype}; boundary="${boundary}"`, '', ...parts.flatMap((p) => [`--${boundary}`, p]), `--${boundary}--`, ''].join(CRLF)
}

function filePart(f: EmlFile & { bytes: Uint8Array }): string {
  const p = fileNameParams(f.name)
  const mime = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(f.mime.trim()) ? f.mime.trim() : 'application/octet-stream'
  return [`Content-Type: ${mime}; ${p.type}`, `Content-Disposition: attachment; ${p.disposition}`, 'Content-Transfer-Encoding: base64', '', base64Lines(f.bytes)].join(CRLF)
}

/** The words a made copy carries: the line's own, or the filed page read as text; the files not inside named at the foot. */
function bodyText(item: EvidenceItem, html: string | null, listed: readonly string[]): string {
  const words = html ? htmlToText(html) : item.kind === 'line' ? item.line.body : ''
  if (listed.length === 0) return words
  return [words.trimEnd(), '', '--', 'Files on this email that are not inside this copy:', ...listed.map((l) => `- ${l}`)].join('\n').replace(/^\n+/, '')
}

/**
 * A faithful `.eml` for an email the boxes read or the app sent. Its From, To and Cc are the mail's own where the line
 * keeps them (the reader's who, the filed copy's head), else the person and the box Messages knows; its Date is the
 * line's time in the company's zone; its Message-ID the kept one; `X-PipeTooling-Record` names the line or the copy it
 * was made from and the day. Each file with bytes goes inside while the whole stays within `maxBytes` (the matter's
 * 10 MB), in the line's order; the rest, and every file with no bytes, are named at the foot of the words.
 */
export function emlOf(item: EvidenceItem, files: readonly EmlFile[], ctx: EvidenceEmlContext, opts: { html?: string | null; maxBytes?: number } = {}): EmlBuilt {
  const maxBytes = opts.maxBytes ?? LEGAL_DOCUMENT_MAX_BYTES
  const html = opts.html?.trim() ? opts.html : null
  const head = emlHeadOf(item, ctx, html)
  const seed = item.key.replace(/[^A-Za-z0-9]/g, '').slice(0, 40) || 'mail'
  const overWords = `over the ${Math.round(maxBytes / 1024 / 1024)} MB this copy may carry`
  const headerLines = [
    `From: ${head.from ? mailboxHeader(head.from) : 'unknown-sender@invalid'}`,
    ...(head.to.length ? [`To: ${mailboxListHeader(head.to)}`] : []),
    ...(head.cc.length ? [`Cc: ${mailboxListHeader(head.cc)}`] : []),
    ...(rfc5322Date(head.at) ? [`Date: ${rfc5322Date(head.at)}`] : []),
    `Subject: ${headerWords(head.subject.slice(0, 500))}`,
    ...(head.messageId && PRINTABLE_ASCII.test(head.messageId) ? [`Message-ID: ${head.messageId}`] : []),
    `X-PipeTooling-Record: ${head.record}`,
    'MIME-Version: 1.0',
  ]
  const body = (listed: readonly string[]): string => {
    const text = textPart(bodyText(item, html, listed))
    return html ? multipart('alternative', `=_pt_${seed}_alt`, [text, htmlPart(html)]) : text
  }
  const named = files.filter((f) => !f.bytes).map((f) => `${f.name}: ${f.note ?? 'not kept'}`)
  const readable = files.filter((f): f is EmlFile & { bytes: Uint8Array } => f.bytes !== null)
  // The room the files may take: the whole less the headers and the words with every file named, the most they can be.
  const room = maxBytes - (headerLines.join(CRLF).length + body([...named, ...readable.map((f) => `${f.name}: ${overWords}`)]).length + 512)
  const inside: Array<{ name: string; part: string }> = []
  const over: string[] = []
  let used = 0
  for (const f of readable) {
    const part = filePart(f)
    if (used + part.length + 64 <= room) {
      inside.push({ name: f.name, part })
      used += part.length + 64
    } else over.push(f.name)
  }
  const overSet = new Set(over)
  const listed = files.flatMap((f) => (f.bytes === null ? [`${f.name}: ${f.note ?? 'not kept'}`] : overSet.has(f.name) ? [`${f.name}: ${overWords}`] : []))
  const content = inside.length ? multipart('mixed', `=_pt_${seed}_mixed`, [body(listed), ...inside.map((p) => p.part)]) : body(listed)
  const text = [...headerLines, content].join(CRLF)
  return { text, bytes: text.length, attached: inside.map((p) => p.name), listed }
}

/** Whether a file of this size can ride inside a copy within `maxBytes`, as base64: the io reads only these. */
export function fileCanFit(size: number | null, maxBytes: number = LEGAL_DOCUMENT_MAX_BYTES): boolean {
  return ((size ?? 0) * 4) / 3 + 1024 <= maxBytes
}

/**
 * The files of a line as `emlOf` takes them, with each one's bytes from the reads (by file id). A file with none says
 * why: too big for the copy, left in Gmail, a link, or our copy could not be read.
 */
export function emlFilesOfLine(line: Pick<EvidenceLine, 'files'>, bytesById: Readonly<Record<string, Uint8Array | null>>, maxBytes: number = LEGAL_DOCUMENT_MAX_BYTES): EmlFile[] {
  return line.files.map((f) => {
    const bytes = f.bucketPath ? (bytesById[f.id] ?? null) : null
    const kept = f.kind === 'link' ? 'link' : f.bucketPath ? 'copy' : f.leftInGmail === 'too_big' ? 'tooBig' : f.leftInGmail === 'quo_not_copied' ? 'quoNotCopied' : 'notCopied'
    const note =
      kept === 'copy'
        ? fileCanFit(f.size, maxBytes) ? 'our copy could not be read' : `over the ${Math.round(maxBytes / 1024 / 1024)} MB this copy may carry`
        : kept === 'link'
          ? `${fileNote({ kept })}: ${f.url ?? ''}`.replace(/: $/, '')
          : fileNote({ kept })
    return { name: f.name, mime: f.mime ?? 'application/octet-stream', bytes, note }
  })
}

// ---------- the Evidence row an email becomes ----------

/** How the file of a document was made: the raw mail as received, the app's record of a line, or the filed copy of a send. */
export type EvidenceCopy = 'raw' | 'made' | 'made_raw_missing' | 'filed'

/** `Re: 4 Elm Ct water heater · 2 of 4 · Oct 24, 2026`; one email alone carries no count. */
export function evidenceTitleOf(c: Pick<EvidenceConversation, 'subject'>, n: number, count: number, ymd: string): string {
  const subject = c.subject.length > 140 ? `${c.subject.slice(0, 139).trimEnd()}…` : c.subject
  const day = YMD.test(ymd) ? formatWorkDateYmdFriendly(ymd) : ''
  return [subject, count > 1 ? `${n} of ${count}` : '', day].filter(Boolean).join(' · ')
}

/** A file's name the bucket and a mail program both take: letters, digits, spaces, dots and dashes. */
const safeName = (s: string): string => s.replace(/[^A-Za-z0-9 ._-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60).trim() || 'email'

export interface EvidenceDraft {
  draft: LegalMatterDocumentAdd
  /** The `.eml`'s file name; a sent copy's starts `sent-<copy id>`, so the door knows it on the matter. */
  fileName: string
}

/**
 * The Evidence row for the `n`th of `count` emails of a row: its title, the one line the firm reads (who it is
 * between, the job, and how the copy was made), its own day, received for a mail in and sent by email for one out,
 * whose paper it is, and the Messages line it was made from.
 */
export function documentDraftOf(c: EvidenceConversation, item: EvidenceItem, n: number, count: number, opts: { ourName: string; copy: EvidenceCopy; todayYmd: string; people?: EvidencePeople }): EvidenceDraft {
  const ymd = dayOf(item.at) || opts.todayYmd
  const title = evidenceTitleOf(c, n, count, ymd)
  const job = c.jobWords || 'the job'
  const our = opts.ourName.trim() || 'us'
  if (item.kind === 'sent') {
    const party = partyOfSent(item.copy)
    return {
      draft: { title, shows: `Email from ${our} to ${party} on ${job}, the app’s own send as filed.`, datedOn: ymd, state: 'sent', sent: { sentOn: ymd, sentHow: 'email', sentTo: party }, whose: 'ours', sourceMessageId: null },
      fileName: `sent-${item.copy.id} ${safeName(c.subject)}.eml`,
    }
  }
  const line = item.line
  const party = partyOfLine(line)
  const between = `Email between ${party} and ${our} on ${job}`
  const owner = nameOf(opts.people ?? { users: {} }, line.mailUserId)
  const how =
    opts.copy === 'raw'
      ? line.direction === 'in' ? 'as received.' : 'as sent.'
      : opts.copy === 'filed'
        ? 'sent from Messages, as filed.'
        : opts.copy === 'made_raw_missing'
          ? `the app’s record of the mail tagged from ${owner ? `${owner}’s` : 'a teammate’s'} mail. The mail as received was not kept.`
          : !line.gmailId
            ? 'the app’s record of the mail sent from Messages.'
            : `the app’s record of the mail as ${line.mailbox === 'team' ? 'read from team@' : 'read from bids@'}.`
  const whose: LegalDocumentWhose = line.direction === 'out' ? 'ours' : line.contactKind === 'supply_house' ? 'supplier' : 'theirs'
  const state: Pick<LegalMatterDocumentAdd, 'state' | 'receivedOn' | 'sent'> = line.direction === 'in' ? { state: 'received', receivedOn: ymd } : { state: 'sent', sent: { sentOn: ymd, sentHow: 'email', sentTo: party } }
  return {
    draft: { title, shows: `${between}, ${how}`, datedOn: ymd, ...state, whose, sourceMessageId: line.id },
    fileName: `${safeName(c.subject)}${count > 1 ? ` ${n} of ${count}` : ''}.eml`,
  }
}

// ---------- the press ----------

/** What the plan reads beyond the ticks: what the matter holds, and how big each tagged line's raw copy is. */
export interface EvidencePutLimits {
  /** The items the matter's live documents hold (`onMatterKeys`). */
  onMatter: ReadonlySet<string>
  /** A tagged line's raw copy's size in bytes, by line id; null when none was kept. */
  rawBytes: Readonly<Record<string, number | null>>
  /** The most a document may be: the matter's 10 MB. */
  maxBytes?: number
}

export type EvidenceHoldWhy = 'on_matter' | 'too_big' | 'no_copy'

export interface EvidenceStep {
  conversation: EvidenceConversation
  item: EvidenceItem
  n: number
  count: number
  title: string
  /** How its file will be made; the io may learn the raw copy is gone and make the record instead. */
  copy: EvidenceCopy
}

export interface EvidenceHeld {
  conversation: EvidenceConversation
  item: EvidenceItem
  n: number
  count: number
  title: string
  why: EvidenceHoldWhy
  /** The reason, as the window prints it under the title. */
  words: string
}

export interface EvidencePutPlan {
  ready: EvidenceStep[]
  held: EvidenceHeld[]
  /** `Put 4 on the matter`; the bare verb when nothing is ready. */
  button: string
  /** Nothing is ready: the button is dead. */
  dead: boolean
  /** The line under the button when a ticked email is held, else null. */
  foot: string | null
}

/**
 * What the press will do: one document per email of each ticked row, in the rows' order and each row's oldest first.
 * An email already on the matter is held, as is a raw copy over the matter's 10 MB and a send whose copy was not
 * kept, each with its reason; the rest are ready, and the button counts them.
 */
export function putPlan(ticked: readonly EvidenceConversation[], limits: EvidencePutLimits): EvidencePutPlan {
  const max = limits.maxBytes ?? LEGAL_DOCUMENT_MAX_BYTES
  const maxWords = `${Math.round(max / 1024 / 1024)} MB`
  const ready: EvidenceStep[] = []
  const held: EvidenceHeld[] = []
  for (const conversation of ticked) {
    const count = conversation.items.length
    conversation.items.forEach((item, i) => {
      const n = i + 1
      const title = evidenceTitleOf(conversation, n, count, dayOf(item.at))
      const step = { conversation, item, n, count, title }
      if (limits.onMatter.has(item.key)) {
        held.push({ ...step, why: 'on_matter', words: 'Already on the matter.' })
      } else if (item.kind === 'sent') {
        if (!item.copy.copyPath) held.push({ ...step, why: 'no_copy', words: 'The app kept no copy of this send.' })
        else if ((item.copy.copyBytes ?? 0) > max) held.push({ ...step, why: 'too_big', words: `The filed copy is ${legalDocumentSizeWords(item.copy.copyBytes ?? 0)}. A matter takes ${maxWords} at most.` })
        else ready.push({ ...step, copy: 'filed' })
      } else if (item.line.mailbox === 'mine') {
        const raw = limits.rawBytes[item.line.id]
        if (typeof raw === 'number' && raw > max) held.push({ ...step, why: 'too_big', words: `The mail as received is ${legalDocumentSizeWords(raw)}. A matter takes ${maxWords} at most.` })
        else ready.push({ ...step, copy: typeof raw === 'number' ? 'raw' : 'made_raw_missing' })
      } else {
        ready.push({ ...step, copy: !item.line.gmailId && item.line.filed?.copyPath ? 'filed' : 'made' })
      }
    })
  }
  const foot =
    held.length === 0
      ? null
      : ready.length === 0
        ? 'Nothing ticked is ready to put. Each email is held with its reason below.'
        : held.length === 1
          ? '1 email is held. It stays off the matter with its reason below.'
          : `${held.length} emails are held. They stay off the matter with their reasons below.`
  return { ready, held, button: `${countedLabel('Put', ready.length)} on the matter`, dead: ready.length === 0, foot }
}

/** What the press did: the emails that went on, the ones that did not with the reason, and the ones the plan held. */
export interface EvidencePutOutcome {
  done: Array<{ key: string; title: string; copy: EvidenceCopy }>
  failed: Array<{ key: string; title: string; reason: string }>
  held: EvidenceHeld[]
}

/** The outcome's words: what went and what did not (`batchOutcomeWords`), and a line for what was held. */
export function putOutcomeWords(o: EvidencePutOutcome): BatchOutcome & { heldLine: string | null } {
  const words = batchOutcomeWords({ verb: 'go on the matter', past: 'Put', done: o.done.length, failed: o.failed.length, noun: 'email' })
  const n = o.held.length
  return { ...words, heldLine: n === 0 ? null : n === 1 ? '1 email was held, with its reason below.' : `${n} emails were held, each with its reason below.` }
}
