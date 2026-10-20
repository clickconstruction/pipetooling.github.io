/**
 * Messages, residential R5: **Message the customer** on Job Mode (`RESIDENTIAL_BUILD_PLAN.md` → R5 on branch
 * spike/gc-mode; screen 2 of `customer-messages-prototype.html` v0.8 beside it, the sheet and its preview). A tech on
 * the job picks one of the lines the office put on the phone, sees it filled, types only what the app cannot know, and
 * sends it. There is no free text: **Something else** is a note on the job, and the office sends what the customer
 * should hear. Pure. The door's who-may and its switch are `messages/jobBox.ts`; the reads and writes are
 * `jobModeMessageCustomerIo.ts`.
 *
 * - A line that needs money or the customer's page link stays off the phone. A tech sees no money, and the app cannot
 *   make the link from the field yet.
 * - The app fills their first name, the tech's name, the job, its address, and the window, day and next visit from the
 *   tech's own blocks on the job. Minutes out and what the tech found are typed in the fill row.
 */
import { firstWord, onPhone } from './jobModeText'
import type { BlankFills } from './quickReplies/blanks'
import { hintFor, phoneLines, shortName, SOMETHING_ELSE, type PhoneLine } from './quickReplies/phone'
import { quickRepliesFromRows, type QuickReplyRow } from './quickReplies/rows'

// What a phone line says (the fills, the preview, what stays off the phone) lives in `jobModeText.ts`, which
// `quo-send`'s tech path shares; it is re-exported here for the sheet.
export { OFF_PHONE_BLANKS, jobModeFills, onPhone, previewOf, windowWords } from './jobModeText'
export type { FillAsk, JobModeBlock, JobModeFillInput, Preview } from './jobModeText'

// ---------- the phone's lines, from the table ----------

/** A `quick_replies` row with the phone's columns (`20261013210000_quick_replies_phone_es.sql`). */
export interface PhoneLineRow extends QuickReplyRow {
  phone_order: number | null
  phone_name: string | null
  text_es: string | null
  /** v2.5573: on_my_way | im_here, read apart by the On my way sheet; absent on the message sheet's read. */
  phone_press?: string | null
}

/** The rows a tech reads (`quick_replies_phone_tech`) as the phone's lines. A row of a kind the kernel does not know is left out. */
export function phoneLinesFromRows(rows: readonly PhoneLineRow[]): PhoneLine[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return quickRepliesFromRows(rows, []).map((q) => {
    const r = byId.get(q.id)
    return { ...q, phoneOrder: r?.phone_order ?? null, phoneName: r?.phone_name ?? null, textEs: r?.text_es ?? null, phonePress: q.phonePress ?? null }
  })
}

// ---------- the sheet ----------

/** One button on the sheet. */
export interface SheetRow {
  line: PhoneLine
  /** The button's name: "On my way". */
  name: string
  /** The hint under it: "minutes out, from the drive". */
  hint: string
}

/**
 * The sheet's buttons: the phone's lines that can go from the phone, the job's step first, six at most, each by its
 * short name with a hint from its blanks. **Something else** is the sheet's own last press, never a row here.
 */
export function sheetRows(lines: readonly PhoneLine[], stepId: string | null, fills: BlankFills): SheetRow[] {
  return phoneLines(lines.filter(onPhone), stepId).map((line) => ({ line, name: shortName(line, fills), hint: hintFor(line.text, fills) }))
}

// ---------- whose thread ----------

/** A contact at the job's customer, as the sheet reads them to find the customer's own thread. */
export interface CustomerContactRow {
  id: string
  name?: string | null
  created_at?: string | null
}

const atOf = (at: string | null | undefined) => Date.parse(at ?? '') || 0

/**
 * The customer's own thread among the contacts at the customer: the one with no name, as `contact_find_or_make` picks
 * it for `quo-send`. A named person at the customer, a tenant or a spouse, is never it while the own one is there; with
 * no own one, the newest contact. Null when the customer has no contact yet.
 */
export function ownContactId(rows: readonly CustomerContactRow[]): string | null {
  const own = rows.find((r) => r.name == null)
  if (own) return own.id
  return [...rows].sort((a, b) => atOf(b.created_at) - atOf(a.created_at))[0]?.id ?? null
}

// ---------- their answer ----------

/** A line in their thread as the sheet reads it. */
export interface ThreadTail {
  direction: string
  at: string
  body: string
}

const saidNewestFirst = (lines: readonly ThreadTail[]) =>
  lines.filter((m) => m.direction === 'in' || m.direction === 'out').sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

/** True when they answered and nobody has written back: their line is newer than ours. Notes and events do not count. */
export function replyWaiting(lines: readonly ThreadTail[]): boolean {
  return saidNewestFirst(lines)[0]?.direction === 'in'
}

/** Their answer waiting on the sheet: the newest line, when it is theirs. Null when ours is newest or there is none. */
export function waitingAnswer(lines: readonly ThreadTail[]): ThreadTail | null {
  const newest = saidNewestFirst(lines)[0]
  return newest?.direction === 'in' ? newest : null
}

// ---------- Something else ----------

/** The note **Something else** leaves on the job for the office: "Please tell Dana: the part comes Thursday." Null when empty. */
export function noteForOffice(text: string, customerName: string | null): string | null {
  const said = text.trim()
  if (!said) return null
  return `Please tell ${firstWord(customerName) ?? 'the customer'}: ${said}`
}

// ---------- the words ----------

export const SHEET_WORDS = {
  door: 'Message the customer',
  doorWaiting: 'Message the customer. They answered.',
  title: (first: string | null) => (first ? `Message ${first}` : 'Message the customer'),
  pick: 'Pick a line. You see it before it sends.',
  none: 'The office has not put any lines on the phone yet. Use Something else to leave them a note.',
  noCustomer: 'This job has no customer yet. Ask the office to add one.',
  answered: (first: string | null) => `${first ?? 'They'} wrote back:`,
  answerComes: 'Their answer comes back to you here. The office sees it too.',
  preview: (first: string | null) => (first ? `This is what ${first} gets.` : 'This is what they get.'),
  send: (first: string | null) => (first ? `Send to ${first}` : 'Send'),
  back: 'Pick another line',
  sent: (first: string | null) => (first ? `Sent to ${first}.` : 'Sent.'),
  noteSent: 'The office has your note.',
  somethingElse: SOMETHING_ELSE,
} as const
