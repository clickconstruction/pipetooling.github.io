/**
 * Messages, the thread's *Answered from my own mailbox* strip (punch list #207, the owner's variant of call 1, v2.6745):
 * an estimator who answered a customer from their own mailbox, wendi@ and not bids@, leaves the thread reading Our move,
 * since the reader reads the two boxes alone (and since v2.6731 their Sent folders). The strip sits above the reply box
 * while the court is ours and nothing is owed, and offers two doors: **Find my sent mail**, My email's list as the person
 * over their Sent, each mail to one of the person's addresses in the last 30 days not yet on a thread offered **Tag it**
 * onto the thread's job; and **I answered, write it down**, one optional line of words, then `answered_from_own_mailbox`
 * writes the answer as our line and the court flips. Pure: `useOwnMailboxThreadSlots` draws, `ownMailboxAnswerIo` calls.
 */
import type { Contact } from '../contacts/kernel'
import type { MyMailRow } from '../myMail/contract'
import { jobRefOf, type JobRef } from './jobKeys'
import type { Court } from './thread'

/** How far back the person's Sent is read for a mail to them. */
export const OWN_MAILBOX_DAYS = 30

/** The strip's words, in plain words (`plainWords.ts`). */
export const OWN_MAILBOX_WORDS = {
  ask: 'Answered them from your own mailbox?',
  find: 'Find my sent mail',
  write: 'I answered, write it down',
  tag: 'Tag it',
  onThread: 'already on the thread',
  finding: 'Reading your sent mail…',
  none: `No sent mail to them in the last ${OWN_MAILBOX_DAYS} days. Write the answer down instead.`,
  noAddress: 'They have no email address here. Write the answer down instead.',
  wordsLabel: 'What you told them, in a line. You can leave it blank.',
  writeDown: 'Write it down',
  notNow: 'Not now',
  written: 'Written down. Their move now.',
  tagged: 'Tagged onto the job. Their move now.',
  pickTitle: 'Tag the sent mail onto a job',
  findTip: 'Reads your own Sent folder for a mail to them, through My email.',
  writeTip: 'Writes the answer on the thread as ours, with no mail attached.',
} as const

/** The line's words when none are typed, as the function writes them. */
export const OWN_MAILBOX_DEFAULT_BODY = 'Answered from my own mailbox.'

/** The strip shows while the court is ours by their last word alone: not when we owe them something, which stays ours after we write. */
export function showOwnMailboxStrip(court: Pick<Court, 'side' | 'owed'> | null): boolean {
  return court !== null && court.side === 'ours' && !court.owed
}

/** The person's addresses, as the thread holds them, trimmed, each once. */
export function contactEmailAddresses(contact: Pick<Contact, 'channels'>): string[] {
  const out: string[] = []
  for (const ch of contact.channels) {
    if (ch.kind !== 'email') continue
    const value = ch.value.trim().toLowerCase()
    if (value && !out.includes(value)) out.push(value)
  }
  return out
}

/** Gmail's search for the person's Sent: a mail to any of their addresses in the last 30 days. Null with no address. */
export function sentMailQuery(addresses: readonly string[]): string | null {
  const to = addresses.map((a) => a.trim()).filter((a) => a !== '')
  if (to.length === 0) return null
  const who = to.length === 1 ? `to:${to[0]}` : `(${to.map((a) => `to:${a}`).join(' OR ')})`
  return `${who} newer_than:${OWN_MAILBOX_DAYS}d`
}

/** The job a tag lands on without asking: the thread's job in view, else the person's star. Null asks the picker. */
export function tagJobFor(jobFilter: string | null, defaultJobId: string | null): JobRef | null {
  return jobRefOf(jobFilter ?? defaultJobId)
}

/** One sent mail as the strip lists it: offered a tag, or already on a thread (tagged, or a line holds its Message-ID). */
export interface SentOffer {
  row: MyMailRow
  offer: 'tag' | 'onThread'
}

/** The person's sent mail the list answered, newest first as it came: only mail going out, each with its offer. */
export function sentOffers(rows: readonly MyMailRow[]): SentOffer[] {
  return rows.filter((r) => r.direction === 'out').map((row) => ({ row, offer: row.tagged || row.inMessages ? 'onThread' : 'tag' }))
}

/** The line's who, as the function writes it: `Wendi Doll · answered from their own mailbox`. */
export function answerWhoText(name: string): string {
  return `${name.trim() || 'Someone'} · answered from their own mailbox`
}

/** The line's words: what was typed, trimmed, else the default. */
export function answerBody(words: string | null | undefined): string {
  const trimmed = (words ?? '').trim()
  return trimmed === '' ? OWN_MAILBOX_DEFAULT_BODY : trimmed
}
