/**
 * Messages, cut 6 (email in): what the bids@ reader writes for one email it takes. The person the line is with and
 * which way it went, the line itself (its who, its time, its subject and words, claimed by the Gmail id) and a row for
 * each file and each file host's link. Pure: the `gmail-sync` edge function places the address, writes the rows and
 * copies the files.
 *
 * Files: each one up to 25 MB is copied into our bucket; a bigger one stays in Gmail and its row says so; a picture
 * placed in the body under 30 KB (a signature's logo) is left out (the lead's answer to Q4).
 */
import type { Forwarded } from './forwarded'
import { fileLinks, type FileHost } from './fileLinks'
import type { EmailAddress, EmailFile, EmailIn } from './gmailMessage'
import { paperGuess, type PaperGuess } from './paperGuess'

/** The most a file may be for us to keep a copy: Gmail's own cap on an email. */
export const KEEP_FILE_BYTES = 25 * 1024 * 1024
/** A picture placed in the body smaller than this is left out: a signature's logo, a social icon. */
export const SKIP_INLINE_PICTURE_BYTES = 30 * 1024

export type FileKeep = 'copy' | 'tooBig' | 'skip'

/** What the reader does with a file: copies it, leaves it in Gmail as too big, or leaves it out. */
export function fileKeep(file: Pick<EmailFile, 'size' | 'inline' | 'mime'>): FileKeep {
  if (file.inline && /^image\//i.test(file.mime) && file.size < SKIP_INLINE_PICTURE_BYTES) return 'skip'
  return file.size > KEEP_FILE_BYTES ? 'tooBig' : 'copy'
}

/** The person a line is with, and which way it went. */
export interface EmailParty {
  address: EmailAddress
  direction: 'in' | 'out'
}

/** Whose addresses are ours: `isOurs` the boxes, the app's sender and the team's; `isTheBox` the boxes and the app's sender alone. */
export interface OurAddresses {
  isOurs: (address: string) => boolean
  isTheBox: (address: string) => boolean
}

/**
 * The person an email's line is with: its sender. On a forwarded copy, the block's first sender; when that is one of
 * us, the first person they wrote to who is not, and the line is ours, going out. A teammate's own mail (v2.5722): to
 * the box, with nobody outside named, it is theirs, coming in, on their Our team thread; to a customer with the box
 * copied, it is ours to that customer, going out. Null when the box or the app wrote, or nobody outside is named on a
 * forwarded copy.
 */
export function emailParty(email: Pick<EmailIn, 'from' | 'to' | 'cc'>, fwd: Forwarded | null, ours: OurAddresses): EmailParty | null {
  const { isOurs, isTheBox } = ours
  if (!fwd) {
    if (!email.from) return null
    if (!isOurs(email.from.address)) return { address: email.from, direction: 'in' }
    if (isTheBox(email.from.address)) return null
    const them = [...email.to, ...email.cc].find((a) => !isOurs(a.address))
    return them ? { address: them, direction: 'out' } : { address: email.from, direction: 'in' }
  }
  if (!isOurs(fwd.from.address)) return { address: fwd.from, direction: 'in' }
  const them = fwd.to.find((a) => !isOurs(a.address))
  return them ? { address: them, direction: 'out' } : null
}

export interface EmailLine {
  gmailId: string
  gmailThreadId: string | null
  direction: 'in' | 'out'
  /** ISO. On a forwarded copy, when its first sender sent it, if the block says. */
  at: string | null
  subject: string | null
  body: string
  /** The line's who: `Greg Paulk <greg@…> to bids@`, or `… · forwarded to bids@ by Rosa`. */
  whoText: string
  /**
   * The mail's own Message-ID header, trimmed (`<CAF…@mail.gmail.com>`): the same in both boxes, where the Gmail id is
   * not, so the box that reads one email second writes nothing (v2.5504). Null when the mail has none we can keep.
   */
  rfcMessageId: string | null
}

/** The longest Message-ID a line keeps: a mail header line's own cap. A longer one is not stamped. */
export const RFC_MESSAGE_ID_MAX = 998

/** An email's Message-ID as the mail carries it, trimmed; null when it has none, or one too long to be one. */
export function rfcMessageId(email: Pick<EmailIn, 'headers'>): string | null {
  const id = (email.headers['message-id'] ?? '').trim()
  return id && id.length <= RFC_MESSAGE_ID_MAX ? id : null
}

const display = (a: EmailAddress): string => (a.name ? `${a.name} <${a.address}>` : a.address)

/** A forward's own subject, without its `Fwd:` or `FW:`. */
const unforwarded = (subject: string): string => subject.replace(/^\s*(?:(?:fwd?|fw)\s*:\s*)+/i, '').trim()

/**
 * The line for an email. `mailbox` is how the line names the box it reached (`bids@`); `forwarderName` is the team
 * member's name when the forwarder is one, else the forwarded block's own words name them. A teammate's mail to a
 * customer with the box copied names both: `Rosa <rosa@…> to Greg <greg@…> · copied to bids@`.
 */
export function emailLine(email: EmailIn, fwd: Forwarded | null, party: EmailParty, mailbox: string, forwarderName: string | null = null): EmailLine {
  if (!fwd) {
    const from = display(email.from ?? party.address)
    return {
      gmailId: email.gmailId,
      gmailThreadId: email.threadId,
      direction: party.direction,
      at: email.at,
      subject: email.subject || null,
      body: email.text,
      whoText: party.direction === 'out' ? `${from} to ${display(party.address)} · copied to ${mailbox}` : `${from} to ${mailbox}`,
      rfcMessageId: rfcMessageId(email),
    }
  }
  const by = forwarderName?.trim() || fwd.by.name || fwd.by.address
  return {
    gmailId: email.gmailId,
    gmailThreadId: email.threadId,
    direction: party.direction,
    at: fwd.at ?? email.at,
    subject: fwd.subject ?? (unforwarded(email.subject) || null),
    body: fwd.text,
    whoText: `${display(fwd.from)} · forwarded to ${mailbox} by ${by}`,
    rfcMessageId: rfcMessageId(email),
  }
}

export type EmailFileRow =
  | {
      kind: 'file'
      name: string
      mime: string
      size: number
      partId: string
      attachmentId: string | null
      /** Copy it into our bucket, or leave it in Gmail as too big. */
      keep: 'copy' | 'tooBig'
      paper: PaperGuess | null
    }
  | { kind: 'link'; name: string; url: string; host: FileHost }

/** A row for each file the reader keeps or names, then one for each file host's link. */
export function emailFileRows(email: Pick<EmailIn, 'files' | 'links'>, senderKind: string | null): EmailFileRow[] {
  const rows: EmailFileRow[] = []
  for (const f of email.files) {
    const keep = fileKeep(f)
    if (keep === 'skip') continue
    rows.push({ kind: 'file', name: f.name, mime: f.mime, size: f.size, partId: f.partId, attachmentId: f.attachmentId, keep, paper: paperGuess(f, senderKind) })
  }
  for (const l of fileLinks(email.links)) rows.push({ kind: 'link', name: l.name, url: l.url, host: l.host })
  return rows
}
