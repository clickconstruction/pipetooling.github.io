/**
 * Messages, cut 3: the reply box's words and rules (`to-dos/gc-mode/messages/BUILD_PLAN.md` → Cut 3). Lifted from the
 * Messages prototype v1.178 on branch spike/gc-mode (`to-dos/gc-mode/messages/prototype.html`: the kinds row, the from
 * line, `countBox`, `subjectFor`, `optoutReason`, `previewDraft` and `sendReply`), the words and the rules, never the DOM.
 * Pure: the caller reads the person, the company, the sender and our last text to the number, and passes them in.
 *
 * Two kinds of words come back. What they see (the subject, the signature, the opt-out line, the text as it goes) is
 * final text. What we see on our own screen as a label (the from line, the count line, the opt-out bubble's
 * tag) comes back as parts, which the screen joins with a middle dot. Every sentence keeps the plain-words rules
 * (`src/lib/plainWords.ts`), and `compose.test.ts` holds them.
 */
import { usualChannel, type Contact, type ContactChannel } from '../contacts/kernel'
import { SIGNATURE_FREE_LINES_MAX } from './signature'
import type { MessageChannel, ThreadMessage as MessageLine } from './thread'
import {
  OPTOUT_SILENCE_DAYS,
  optoutLine,
  textSegments,
  type ComposeCompany,
  type OptoutReason,
  type TextToSend,
} from './textOut'

// The rules for a text going out live in `textOut.ts`, light enough to run on the edge. They are compose's too.
export * from './textOut'

// Which box a message goes from, and that box's address and number (R6): `boxes.ts`'s, so the edge can copy them.
export {
  boxSetting,
  fromNumberFor,
  mailboxFor,
  NO_BOX_FALLBACK,
  parseBoxSettings,
  type BoxFallback,
  type BoxSetting,
  type BoxSettings,
  type Mailbox,
} from './boxes'

// ---------- the kinds row ----------

/** What the box writes: one of the thread's channels. A call (punch list #140 PR 7) is one the office made and logs. */
export type ReplyKind = Extract<MessageChannel, 'text' | 'email' | 'note' | 'call'>

/** The kinds row, in its order: Text blue, Email white, Note yellow, Call green. `send` is the box's Send press. */
export const REPLY_KINDS: ReadonlyArray<{ kind: ReplyKind; label: string; send: string }> = [
  { kind: 'text', label: 'Text', send: 'Send text…' },
  { kind: 'email', label: 'Email', send: 'Send email…' },
  { kind: 'note', label: 'Note', send: 'Add the note' },
  { kind: 'call', label: 'Call', send: 'Save the call' },
]

/** The kinds row's words at its right while Note is on. */
export const NOTE_ASIDE: readonly string[] = ['only the team sees it', 'closes the row']

/** A text or an email reaches them; a note and a logged call stay with the team. Quick replies, Attach, the from line and the count line show only when it does. */
export function goesOut(kind: ReplyKind): kind is 'text' | 'email' {
  return kind === 'text' || kind === 'email'
}

/** The box's words before anything is typed. */
export function boxPlaceholder(kind: ReplyKind, contactName: string): string {
  if (kind === 'note') return 'A note only the team sees…'
  if (kind === 'call') return `What ${contactName} said on the call…`
  return `Write to ${contactName}…`
}

// ---------- who it goes to, and from ----------

/** Who a reply goes to, as the box and the send window read them. */
export interface ReplyRecipient {
  /** Their name as the thread shows it: "Greg Paulk". */
  name: string
  /** The number a text goes to, or null when none is on file. */
  number: string | null
  /** That number sent STOP. Opt-out is per number, the carriers' rule. */
  numberOptedOut: boolean
  /** The address an email goes to, or null when none is on file. */
  email: string | null
}

/** A line as the recipient rule reads it: which channel it went on, and when. */
export type RecipientLine = Pick<MessageLine, 'channelId' | 'at' | 'direction'>

/**
 * Their numbers in the order a text would go to them (punch list #118, the card's call 1): the usual the office
 * starred, else the one the thread last carried a line on, else the first that can still take a text, else the
 * rest as added. A number that sent STOP comes last, so a contact whose every number stopped still names one and
 * the box says why it cannot go. The last line is a signal, not a default: a customer who texts once from a second
 * phone gets the reply back on that phone until the office stars one.
 */
export function numberOrder(contact: Pick<Contact, 'channels'>, lines: readonly RecipientLine[] = []): ContactChannel[] {
  const phones = contact.channels.filter((ch) => ch.kind === 'phone')
  const usual = usualChannel(contact, 'phone')
  const lastOn = new Map<string, string>()
  for (const l of lines) {
    if (!l.channelId || (l.direction !== 'in' && l.direction !== 'out')) continue
    const t = lastOn.get(l.channelId) ?? ''
    if (l.at > t) lastOn.set(l.channelId, l.at)
  }
  return [...phones].sort((a, b) => {
    const sa = a.optedOutAt ? 1 : 0
    const sb = b.optedOutAt ? 1 : 0
    if (sa !== sb) return sa - sb
    const ua = usual && a.id === usual.id ? 0 : 1
    const ub = usual && b.id === usual.id ? 0 : 1
    if (ua !== ub) return ua - ub
    const la = lastOn.get(a.id) ?? ''
    const lb = lastOn.get(b.id) ?? ''
    if (la !== lb) return la < lb ? 1 : -1
    return phones.indexOf(a) - phones.indexOf(b)
  })
}

/**
 * The recipient from the spine's contact. The number follows `numberOrder` (the usual, else the last the thread
 * carried a line on, else the first that can still take a text), unless the send window picked one this once
 * (`numberChannelId`, punch list #118): a pick of a number that sent STOP is still the pick, and the box says why
 * it cannot go. The address is their usual, else their first. The channel ids name the `contact_channels` rows the
 * message goes to.
 */
export function replyRecipient(
  contact: Pick<Contact, 'name' | 'channels'>,
  opts: { lines?: readonly RecipientLine[]; numberChannelId?: string | null } = {},
): ReplyRecipient & { numberChannelId: string | null; emailChannelId: string | null } {
  const order = numberOrder(contact, opts.lines ?? [])
  const picked = opts.numberChannelId ? order.find((ch) => ch.id === opts.numberChannelId) : undefined
  const number = picked ?? order[0] ?? null
  const email = usualChannel(contact, 'email') ?? contact.channels.find((ch) => ch.kind === 'email') ?? null
  return {
    name: contact.name,
    number: number?.value ?? null,
    numberOptedOut: Boolean(number?.optedOutAt),
    email: email?.value ?? null,
    numberChannelId: number?.id ?? null,
    emailChannelId: email?.id ?? null,
  }
}


/**
 * Who sends it, from their account: `users.name`, `users.title` (cut 3's SQL), `users.phone` as their own cell, and
 * since punch list #207 PR 1 the two lines they keep on Your account (`users.signature_lines`, `signature.ts`).
 */
export interface ComposeSender {
  name: string
  title?: string | null
  cell?: string | null
  lines?: readonly string[] | null
}

/**
 * The kind a reply starts as: a text when their number can take one, else an email when they have an address, else a
 * text, whose box then says why it cannot go. The prototype started every reply as a text, so a person who sent STOP
 * opened on a box that could not send.
 */
export function defaultReplyKind(to: ReplyRecipient): ReplyKind {
  if (to.number && !to.numberOptedOut) return 'text'
  return to.email ? 'email' : 'text'
}

/** Whether the send window's Send can go. A note always can, and so can a logged call. */
export function canSend(kind: ReplyKind, to: ReplyRecipient): boolean {
  if (kind === 'note' || kind === 'call') return true
  if (kind === 'email') return Boolean(to.email)
  return Boolean(to.number) && !to.numberOptedOut
}

/** The words that hold the box shut on a text to a number that sent STOP; null when the box can be written in. */
export function textBoxBlocked(kind: ReplyKind, to: ReplyRecipient): string | null {
  return kind === 'text' && to.numberOptedOut ? 'They sent STOP. The app will not text this number.' : null
}

/**
 * An email's sender as their inbox names it (punch list #207 PR 2, v2.6702): the replying person and the company,
 * *Wendi Doll · Click Construction*, the company alone while the person is unnamed. The same words the function puts on
 * the From (`emailOut/rawMail.ts`'s `senderDisplayName`).
 */
export function emailSenderName(company: Pick<ComposeCompany, 'name'>, senderName?: string | null): string {
  const person = (senderName ?? '').trim()
  return person ? `${person} · ${company.name}` : company.name
}

/**
 * The from line floating in the empty box: our number, or who an email goes from and the box it goes from. Empty on a
 * note. Since v2.6702 an email goes through Gmail as the box their answer comes back to (bids@ or the team box), under
 * the replying person's name with the company's, so the line reads *from Wendi Doll · Click Construction · bids@…*; with
 * no box set it goes from the app's sending address under the company's name, and the line names the company alone. A
 * blank number or box leaves it out rather than drawing a gap.
 */
export function fromLine(kind: ReplyKind, company: ComposeCompany, senderName?: string | null): string[] {
  const phone = company.phone.trim()
  const mailbox = company.mailbox.trim()
  const number = company.numberWords?.trim() || 'the company number'
  if (kind === 'text') return [phone ? `from ${number} ${phone}` : `from ${number}`, company.name]
  if (kind === 'email') return mailbox ? [`from ${emailSenderName(company, senderName)}`, mailbox] : [`from ${company.name}`]
  return []
}

/**
 * An email's From as their inbox shows it: the replying person and the company on the box's address (v2.6702), or the
 * company alone on the app's sending address while no box is set.
 */
export function fromHeader(company: ComposeCompany, senderName?: string | null): string {
  return company.mailbox.trim() ? emailSenderName(company, senderName) : company.name
}

/**
 * The box an email goes from and their answer comes back to (R6; since v2.6702 the From's own address, since the mail
 * goes through Gmail as the box). Null when the app does not know one, and the answer comes to the sender's own inbox.
 */
export function replyToHeader(company: ComposeCompany): string | null {
  return company.mailbox.trim() || null
}

/** Where an answer to the reply box's email goes while no box is set: the sender's own inbox. */
export const EMAIL_REPLIES_NOTE = 'Their answer comes to your own inbox. Bring anything that matters back to this thread.'

/**
 * Where an answer goes: the box, else the sender's own inbox. It names the box alone, since the box's answers reach this
 * thread only while Read bids@ is on and the box is read.
 */
export function emailRepliesNote(company: ComposeCompany): string {
  const box = company.mailbox.trim()
  return box ? `Their answer comes to ${box}.` : EMAIL_REPLIES_NOTE
}

// ---------- the email ----------

/** The most of the first line a subject carries. */
export const SUBJECT_MAX = 60

const TRAILING_STOPS = /[\s.!?,;:]+$/

/**
 * An email's subject: the job's name, then their first line after the greeting (`bodyAfterGreeting`), without its
 * closing stop. A first line past `SUBJECT_MAX` is cut at the last whole word with an ellipsis; the prototype cut it
 * mid-word. A blank box falls back to "A note from Click Construction". `typed`, the subject changed in the send window
 * for this one email, wins.
 */
export function subjectFor(
  jobName: string | null,
  body: string,
  company: Pick<ComposeCompany, 'name'>,
  typed?: string | null,
): string {
  const own = typed?.trim()
  if (own) return own
  const first = (bodyAfterGreeting(body).split(/\r?\n/)[0] ?? '').trim().replace(TRAILING_STOPS, '')
  const line = first.length > SUBJECT_MAX ? cutAtWord(first, SUBJECT_MAX) : first
  return `${jobName ? `${jobName}: ` : ''}${line || `A note from ${company.name}`}`
}

/** A word that ends right at the cut is kept whole; one long word with no space in its second half is cut where it falls. */
function cutAtWord(text: string, max: number): string {
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  const kept = /\s/.test(text.charAt(max)) || space <= max / 2 ? cut : cut.slice(0, space)
  return `${kept.replace(TRAILING_STOPS, '')}…`
}

/** The words that answer a blank subject in the send window. */
export const SUBJECT_BLANK = 'Type a subject, or Cancel.'

// ---------- the greeting, the box's own ----------

/**
 * The first line the box pre-types on an email (punch list #207 PR 1): their first name and a comma, as a person opens
 * a letter. The person keeps it, changes it or deletes it; the app no longer writes "Hello Rusty," after the fact.
 * Empty for a person nobody has named, whose name is a number or an address.
 */
export function emailOpening(first: string): string {
  const name = first.trim()
  return name ? `${name},` : ''
}

/** The box with the opening on its first line when it holds nothing yet; a box with words in it is left alone. */
export function withEmailOpening(body: string, first: string): string {
  const opening = emailOpening(first)
  return body.trim() || !opening ? body : `${opening}\n\n`
}

/** The box emptied again when it holds the opening alone, so a switch back to a text sends no stray "Rusty,". */
export function withoutEmailOpening(body: string, first: string): string {
  return onlyOpening(body, first) ? '' : body
}

/** Whether the box holds the pre-typed opening and nothing else: empty, as the strip, the from line and Send read it. */
export function onlyOpening(body: string, first: string): boolean {
  const opening = emailOpening(first)
  return Boolean(opening) && body.trim() === opening
}

const GREETING_MAX = 60
const GREETING_WORDS_MAX = 5

/**
 * The body's first line when it reads as a greeting: a few words ending with a comma and asking nothing ("Rusty,",
 * "Good morning Dr. Raman,"). Null when the words start straight in. The subject skips it.
 */
export function greetingLineOf(body: string): string | null {
  const first = (body.trimStart().split(/\r?\n/)[0] ?? '').trim()
  if (!first || first.length > GREETING_MAX || !first.endsWith(',') || /[?!]/.test(first)) return null
  return first.split(/\s+/).length <= GREETING_WORDS_MAX ? first : null
}

/** The words after the greeting line, trimmed: what the subject reads. The whole body, trimmed, when there is none. */
export function bodyAfterGreeting(body: string): string {
  const greeting = greetingLineOf(body)
  if (!greeting) return body.trim()
  const text = body.trimStart()
  return text.slice(text.indexOf(greeting) + greeting.length).trim()
}

// ---------- the signature ----------

/**
 * The signature as the email carries it, from the sender's account and nothing else: their name; their title and the
 * company as one line; their own cell; then the two lines they keep on Your account (punch list #207 PR 1,
 * `users.signature_lines`). Nothing of the app's follows: the owner's *Email back, text, or call.* left with that PR,
 * and he types it into his own lines. A blank piece is left out rather than drawn as a gap.
 */
export function signatureLines(sender: ComposeSender, company: Pick<ComposeCompany, 'name'>): string[] {
  const name = sender.name.trim()
  const second = [sender.title?.trim(), company.name.trim()].filter(Boolean).join(' · ')
  const cell = sender.cell?.trim()
  const own = (sender.lines ?? [])
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, SIGNATURE_FREE_LINES_MAX)
  return [...(name ? [name] : []), ...(second ? [second] : []), ...(cell ? [`cell ${cell}`] : []), ...own]
}

/**
 * Our note that the sent copy is filed. The prototype drew it inside the email's footer, where the person reading it
 * has no Documents; it is ours, so the screen keeps it on our side of the window.
 */
export function sentCopyNote(fileCount: number): string {
  if (fileCount <= 0) return 'A copy of this email is kept in Documents.'
  return `A copy of this email is kept in Documents, with its file${fileCount === 1 ? '' : 's'}.`
}

/** The send window's note under an email: where each piece comes from. */
export const EMAIL_SOURCES_NOTE =
  'The subject comes from the job and your first line after the greeting, unless you change it. ' +
  'The signature is the one on Settings → Your account. Nothing here is typed twice.'

/** The guide the send window's own-mailbox line opens (punch list #230 PR 0). */
export const OWN_MAILBOX_GUIDE_HREF = '/help?g=tag-an-email-onto-a-job-from-gmail'

/**
 * The send window's quiet line under the email's head, where the From line is (punch list #230 PR 0, v2.6257): an answer
 * someone sends from their own mailbox reaches no thread unless a box is copied (`gmail-sync` reads the boxes alone), so
 * the line names the box this person's answers come to, as Replies to does, else bids@, which the reader always reads.
 * Then the link's words, to the guide that shows the copy and the forward (`OWN_MAILBOX_GUIDE_HREF`).
 */
export function ownMailboxNote(company: Pick<ComposeCompany, 'mailbox'>): { words: string; link: string } {
  const box = company.mailbox.trim() || 'bids@'
  return { words: `Answering from your own mailbox? Copy ${box}, and this thread gets it too.`, link: 'How to tag an email onto a job' }
}

/**
 * An email as they see it, every piece from one place, so the send window and the send never differ. Plain since
 * punch list #207 PR 1: the body as typed, its greeting on the first line when the person kept it, and the signature;
 * no greeting or footer of the app's.
 */
export interface EmailDraft {
  from: string
  to: string | null
  subject: string
  body: string
  signature: string[]
}

export function emailDraft(input: {
  company: ComposeCompany
  sender: ComposeSender
  to: ReplyRecipient
  jobName: string | null
  body: string
  typedSubject?: string | null
}): EmailDraft {
  const { company, jobName } = input
  const body = input.body.trim()
  return {
    from: fromHeader(company),
    to: input.to.email,
    subject: subjectFor(jobName, body, company, input.typedSubject),
    body,
    signature: signatureLines(input.sender, company),
  }
}

/** The opt-out line as the send window draws it: its own grey bubble, tagged as the app's. */
export interface OptoutBubble {
  line: string
  /** The tag under it, as parts. */
  tag: string[]
  /** Its hover card: the name, what it does, what it changes. */
  tip: { name: string; does: string; changes: string }
}

export function optoutBubble(reason: OptoutReason, days: number | null, company: Pick<ComposeCompany, 'name'>): OptoutBubble {
  const first = reason === 'first'
  return {
    line: optoutLine(company),
    tag: ['added by the app', first ? 'required on a first text' : `after ${days ?? OPTOUT_SILENCE_DAYS} quiet days`],
    tip: {
      name: 'Added by the app',
      does: first
        ? 'Their first text from us carries the company name and the opt-out line the carriers require.'
        : `Our last text to them was ${days ?? OPTOUT_SILENCE_DAYS} days ago. The carriers ask for the line again after a quiet spell.`,
      changes: 'It goes at the end of your text, after a blank line. It is drawn apart so it never reads as your words.',
    },
  }
}

/**
 * The note under the phone when the reason is only the silence, with its press: Leave it off this time, or Put it back
 * once it is held. Null on a first text or a live conversation, where there is nothing to hold.
 */
export function optoutHoldNote(
  reason: OptoutReason | null,
  held: boolean,
  days: number | null,
  firstName: string,
): { words: string; press: string } | null {
  if (reason !== 'silence') return null
  const n = days ?? OPTOUT_SILENCE_DAYS
  return held
    ? {
        words: `The opt-out line is held back this time. You said the ${n} quiet days do not make a stranger of ${firstName}.`,
        press: 'Put it back',
      }
    : { words: `The line is on because our last text was ${n} days ago.`, press: 'Leave it off this time' }
}

/** The hover card on Leave it off this time. */
export const OPTOUT_HOLD_TIP = {
  name: 'Leave it off this time',
  does: 'Holds the opt-out line back on this one text.',
  changes: 'Only when the reason is the quiet spell, never on a first text. The message keeps a note that you held it back.',
} as const

// ---------- the text as it goes ----------

/** The send window's note under a text: it goes from our number, so the answer comes back here. */
export const TEXT_FROM_NOTE = 'Sent from the company number, so their reply lands back in this thread whoever answers.'

/** The send window's warnings, in its order. A text past two pieces says so, and says if the opt-out line made it longer. */
export function sendWarnings(kind: 'text' | 'email', to: ReplyRecipient, text?: TextToSend): string[] {
  if (kind === 'email') return to.email ? [] : ['They have no email on file. Add one on their record, and the email can go.']
  const out: string[] = []
  if (to.numberOptedOut) out.push('They sent STOP. The app will not send this text.')
  if (!to.number) out.push('They have no mobile number on file. Add one on their record, and the text can go.')
  if (text && text.segments > 2) {
    out.push(
      `${text.characters} characters is ${text.segments} texts${text.withLine ? ', with the opt-out line' : ''}. ` +
        'Long texts arrive in pieces on some phones. An email may read better.',
    )
  }
  return out
}

// ---------- the line under the box ----------

/** The line under the box, read by kind (v1.149). `long` marks a text past two pieces. */
export interface CountLine {
  parts: string[]
  long: boolean
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Words as a person counts them. */
export function wordCount(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length
}

/**
 * The count line: a text its characters and how many texts, with a word past two; an email the subject it goes with
 * and its words; a note, or a logged call, its words. An empty box, or one holding only spaces, has no line. The box's count is its own
 * words; the send window counts the text as it goes, link lines and the opt-out line too.
 */
export function countLine(kind: ReplyKind, body: string, subject?: string): CountLine {
  const text = body.trim()
  if (!text) return { parts: [], long: false }
  if (kind === 'text') {
    const s = textSegments(text)
    const long = s.segments > 2
    return {
      parts: [plural(s.characters, 'character'), plural(s.segments, 'text'), ...(long ? ['long for a text, so an email may read better'] : [])],
      long,
    }
  }
  const words = plural(wordCount(text), 'word')
  if (kind === 'email') return { parts: [...(subject ? [`Subject: ${subject}`] : []), words], long: false }
  return { parts: [words, 'only the team sees it'], long: false }
}

/** The words once it went. A note's words grow the day it comes back on, which the follow-up kernel adds. */
export function sentWords(kind: ReplyKind, company: Pick<ComposeCompany, 'name'>): string {
  if (kind === 'note') return 'Note added and the row closed. Only the team sees the note.'
  if (kind === 'call') return 'Call saved. Only the team sees it.'
  if (kind === 'email') return `Email sent as ${company.name}. Its copy is kept in Documents.`
  return 'Text sent from the company number.'
}
