/**
 * Messages → My email (punch list #230 PR 3): the reader, one mail of a person's own box opened whole for the screen
 * and kept nowhere (the mock-up's section 2). The guess bar sits on top (*Tag this conversation onto* the job, **Yes**,
 * **Another job…** and why), turning green once the conversation is tagged; then the subject and how many mails the
 * conversation holds, From, To, Cc and When, the words, the files, and the foot: *Reply in Gmail ↗* and the line that
 * says nothing here replies, archives or marks read.
 *
 * The words are drawn as the thread's email line draws them: an HTML body read as text by the bids@ reader's own
 * `htmlToText` (the one sanitiser the lines go through; no HTML reaches the page), else the plain words. **Untag** and
 * **Another job…** are offered on every tagged conversation, the boxes' own too (`canUntag`), and a mail of one that no
 * line holds yet says so with **Put it on the job** (`taggedJob`). Pure.
 */
import type { Contact } from '../contacts/kernel'
import { htmlToText } from '../emailIn/gmailMessage'
import { sizeWords } from '../messages/lineFiles'
import type { MyMailFile, MyMailJobChip, MyMailOpenOk, MyMailParty, MyMailTagOk } from './contract'
import type { MyMailTagAct } from './list'

/** The mail as `open` answers it. */
export type MyMailOpened = MyMailOpenOk['mail']

/** The words: the HTML read as text, as the thread's email line reads it, else the plain words. */
export function readerBody(mail: Pick<MyMailOpened, 'bodyText' | 'bodyHtml'>): string {
  const fromHtml = mail.bodyHtml?.trim() ? htmlToText(mail.bodyHtml) : ''
  return fromHtml || mail.bodyText.trim()
}

/** An address as a header line reads it: `Dale Okafor <dale@…>`, or the address alone. */
export function partyWords(p: MyMailParty): string {
  const name = p.name.trim()
  const address = p.address.trim()
  return name && address ? `${name} <${address}>` : name || address
}

/** Several addresses on one header line. */
export function partiesWords(parties: readonly MyMailParty[]): string {
  return parties.map(partyWords).filter(Boolean).join(', ')
}

/** From: the sender on a mail in, the person's own address on a mail they sent. */
export function fromWords(mail: Pick<MyMailOpened, 'direction' | 'who'>, address: string): string {
  return mail.direction === 'out' ? address.trim() : partyWords(mail.who)
}

/** A file as the list under the words reads it: its name and its size. */
export function fileWords(f: Pick<MyMailFile, 'name' | 'size'>): string {
  const size = sizeWords(f.size)
  return size ? `${f.name} · ${size}` : f.name
}

/** How many mails the conversation holds. */
export function threadCountWords(n: number): string {
  return `${Math.max(1, n)} in this conversation`
}

/**
 * Whether **Untag** is offered: on every tagged conversation, the boxes' own too. An untag does real work even when the
 * bids@ or team@ reader holds every mail of it: it unties the box lines the tag tied, takes off the tag's grey line and
 * its `email_tag_threads` row, so later mail stops landing on the job, and takes the label off in Gmail. Holding it back
 * there left a wrong tag on the job for good, with each new box line tied to the wrong job. **Another job…** beside it
 * moves the tag instead: `gmail-mine`'s `tag` onto the new job.
 */
export function canUntag(mail: Pick<MyMailOpened, 'tagged'>): boolean {
  return mail.tagged !== null
}

/** This sitting's tag of a conversation, as the tab keeps it until an untag. */
export interface MyMailDone {
  /** The function's answer. */
  ok: MyMailTagOk
  /** The job's chip, when the press knew it. */
  chip: MyMailJobChip | null
  /** The press that tagged: a first tag, **Another job…**, or **Put it on the job**. */
  act: MyMailTagAct
}

/** A tagged conversation as the bar names it: the job's key and chip, and whether a line holds this mail. */
export interface MyMailTaggedJob {
  key: string | null
  /** Null when the press did not know the job: the bar says *the job*. */
  chip: MyMailJobChip | null
  /** False on a mail of the conversation no line holds yet, which **Put it on the job** lands. */
  onTheJob: boolean
}

/**
 * The job a tagged conversation's bar names, and whether this mail is on it. This sitting's tag is newer than a mail
 * read before it (`fresh` false: a first tag, a move, a mail put on the job), so it names the job until the reader
 * reads again, the chip the mail read with when it is that job. Otherwise the mail as read: on the job when a line holds
 * it (`tagged.messageId`), else not yet, as a reply that came after the follow stopped, or before it got there.
 */
export function taggedJob(mail: Pick<MyMailOpened, 'tagged'>, done: Pick<MyMailDone, 'ok' | 'chip'> | null, fresh = true): MyMailTaggedJob {
  if (done && (!fresh || !mail.tagged)) {
    const same = mail.tagged?.key === done.ok.jobKey ? mail.tagged : null
    return { key: done.ok.jobKey, chip: same ?? done.chip, onTheJob: true }
  }
  return { key: mail.tagged?.key ?? null, chip: mail.tagged, onTheJob: Boolean(mail.tagged?.messageId) }
}

/** The sender a tag could not place, as *Who is this?* takes a person: a contact with the one address and no record yet. */
export function unknownSenderContact(sender: NonNullable<MyMailTagOk['unknownSender']>): Contact {
  const address = sender.address.trim()
  return {
    id: sender.contactId,
    kind: 'unknown',
    name: sender.name.trim() || address,
    goesBy: null,
    company: '',
    record: null,
    channels: [{ id: `${sender.contactId}:email`, kind: 'email', value: address, optedOutAt: null }],
    jobIds: [],
    defaultJobId: null,
  }
}

export const MY_MAIL_READER_WORDS = {
  tagOnto: 'Tag this conversation onto',
  tagOntoAJob: 'Tag this conversation onto a job.',
  yes: 'Yes',
  another: 'Another job…',
  tag: 'Tag…',
  on: '✓ On',
  onTheJob: 'the job',
  openThread: 'open the thread ›',
  untag: 'Untag',
  untagAsk: 'Untag takes this conversation off the job. The lines the tag wrote go, with their files and the copy of each mail. A line the bids@ or team@ reader took goes back to where it was.',
  notOnTheJob: 'This mail is not on the job yet.',
  putOn: 'Put it on the job',
  inMessages: 'Already in Messages ✓',
  inMessagesWhy: 'The bids@ or team@ reader took this mail.',
  tagTheRest: 'Tag the conversation…',
  from: 'From',
  to: 'To',
  cc: 'Cc',
  when: 'When',
  files: 'Files',
  replyInGmail: 'Reply in Gmail ↗',
  nothingHere: 'Nothing here replies, archives or marks read.',
  reading: 'Reading the mail…',
  notRead: 'The mail could not be read.',
  offline: 'No connection, so the mail could not be read. It reads again when the signal is back.',
  notUntagged: 'The conversation was not untagged.',
  pickTitle: 'Tag this conversation onto',
  moveTitle: 'Move this conversation onto',
} as const
