/**
 * Messages → My email (punch list #230 PR 3): the reader, one mail of a person's own box opened whole for the screen
 * and kept nowhere (the mock-up's section 2). The guess bar sits on top (*Tag this conversation onto* the job, **Yes**,
 * **Another job…** and why), turning green once the conversation is tagged; then the subject and how many mails the
 * conversation holds, From, To, Cc and When, the words, the files, and the foot: *Reply in Gmail ↗* and the line that
 * says nothing here replies, archives or marks read.
 *
 * The words are drawn as the thread's email line draws them: an HTML body read as text by the bids@ reader's own
 * `htmlToText` (the one sanitiser the lines go through; no HTML reaches the page), else the plain words. **Untag** is
 * offered on a tagged conversation unless the boxes wrote every line of it, which an untag leaves where they are. Pure.
 */
import type { Contact } from '../contacts/kernel'
import { htmlToText } from '../emailIn/gmailMessage'
import { sizeWords } from '../messages/lineFiles'
import type { MyMailFile, MyMailOpenOk, MyMailParty, MyMailTagOk } from './contract'

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
 * Whether **Untag** is offered: the conversation is tagged, and at least one of its mails is not a line the boxes
 * wrote (`inMessages`), so an untag has a line of the tag's own to take off. A conversation the boxes read whole keeps
 * every line where the boxes put it.
 */
export function canUntag(mail: Pick<MyMailOpened, 'tagged' | 'inMessages' | 'threadRows'>): boolean {
  if (!mail.tagged) return false
  return [mail, ...mail.threadRows].some((m) => m.inMessages === null)
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
  untagAsk: 'Untag takes the conversation’s lines, files and copy off the job.',
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
} as const
