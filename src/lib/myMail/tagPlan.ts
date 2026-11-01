/**
 * Messages → My email (punch list #230 PR 1): what a tag writes, mail by mail. The person pressed **Yes** (or picked a
 * job) on one mail; the unit is its Gmail conversation, so every mail in it so far lands on the job, in and out, and
 * the function (`gmail-mine`, PR 2) executes this plan: a mail a line already holds is tied, never doubled; any other
 * is written as the bids@ reader writes one, with its files and its raw `.eml`, on the contact `email_place_address`
 * gives its party; then the `email_tag_threads` row and the Gmail label. Pure.
 *
 * Whose thread each line lands on is `emailLine.ts`'s `emailParty`, with the person, the team and the boxes as ours
 * and the boxes and the app's sender as the box: a mail in lands on its sender; a mail out to a customer lands on the
 * customer as ours, going out, under whoever sent it; a note to self, or a mail between teammates with nobody outside,
 * lands on its sender's own thread, coming in, as a teammate's mail to the box does. A forward inside the
 * conversation is read as the mail it is: the reader unwraps only a forward sent to its box. Drafts, Spam, Trash and
 * Chats are never written, and a mail from a box or the app is a copy of ours, as the reader leaves it. A mail in the
 * person's Sent is theirs whatever address it went out from (an alias, a send-as), and a mail under a label the person
 * leaves out (`users.my_mail_hidden_labels`) is never written or tied.
 */
import { emailParty, fileKeep, rfcMessageId, type EmailParty, type OurAddresses } from '../emailIn/emailLine'
import { fileLinks, type FileHost } from '../emailIn/fileLinks'
import type { EmailAddress, EmailIn } from '../emailIn/gmailMessage'
import { jobKey } from '../messages/jobKeys'
import { MY_MAIL_GMAIL_LABEL, type MyMailJobChip } from './contract'

/** What a written line's `messages.mailbox` says: tagged from a person's own box, whose `mail_user_id` names. */
export const MY_MAIL_MAILBOX = 'mine'


/** The conversation, as `users.threads.get` answers it and the reader's parser reads each mail. */
export interface MyMailThread {
  threadId: string
  messages: readonly EmailIn[]
}

/** The person whose box it is: the one who pressed. */
export interface MyMailPerson {
  userId: string
  address: string
  name: string
}

/** A line the database already holds for a mail, by its Message-ID (or, for a mail with none, by its Gmail id in the person's box). */
export interface MyMailKnownLine {
  messageId: string
  /** The job it is tied to (`messages/jobKeys.ts`'s key), or null when it sits on the person. */
  jobKey: string | null
  /**
   * The line came from this person's own box (`mailbox` mine, `mail_user_id` the person): an earlier tag of theirs. A
   * tag onto another job moves their own lines with it, and leaves the office's ties where the office put them.
   */
  mine?: boolean
  /**
   * A line of the boxes this conversation's tag tied before, as its row records it (`email_tag_threads.tied_line_ids`),
   * still on the job the tag put it on and as the tag stamped it: a tag onto another job moves it with the person's own
   * lines. A line someone placed by hand since is theirs, and stays where they put it.
   */
  tagTie?: boolean
}

/** What the database already knows, read by the function before the plan. */
export interface MyMailKnown {
  /** The lines the boxes or an earlier tag wrote, by the mail's trimmed Message-ID (`rfcMessageId`). */
  byMessageId: Readonly<Record<string, MyMailKnownLine>>
  /** The person's own lines by Gmail id, for a mail with no Message-ID: an earlier tag wrote it, in their box alone. */
  byGmailId?: Readonly<Record<string, MyMailKnownLine>>
  /** The team's addresses, lower-case, to who they are: a teammate's mail on the conversation is theirs, and ours. */
  team?: Readonly<Record<string, { userId: string; name: string }>>
  /** The boxes' own addresses and the app's sender: a mail from one is a copy of ours and is not written. */
  boxes?: readonly string[]
  /** Gmail's ids of the labels the person leaves out (`users.my_mail_hidden_labels`, by name): a mail under one is never written or tied. */
  hidden?: readonly string[]
}

/** A file on a written line: copied into the bucket up to 25 MB, else left in Gmail and named (`fileKeep`). */
export interface MyMailTagFile {
  partId: string
  attachmentId: string | null
  name: string
  mime: string
  size: number
  keep: 'copy' | 'tooBig'
}

/** A file host's link on a written line, kept as a link, as the reader keeps one. */
export interface MyMailTagLink {
  name: string
  url: string
  host: FileHost
}

/** Why a mail of the conversation is not written: a draft, Spam or Trash, a chat, a label the person leaves out, no party, or twice. */
export type MyMailTagSkip = 'draft' | 'spamOrTrash' | 'chat' | 'hidden' | 'noParty' | 'twice'

/** The Gmail labels a tag never writes a mail from, by Gmail's ids, each with its reason, the first that a mail carries winning. */
export const MY_MAIL_NEVER_LABELS: Readonly<Record<string, MyMailTagSkip>> = { DRAFT: 'draft', SPAM: 'spamOrTrash', TRASH: 'spamOrTrash', CHAT: 'chat' }

/** One mail's part of the plan. */
export type MyMailTagStep =
  | {
      /** A line already holds this mail: tie it to the job when `tie`, never write it again. */
      kind: 'tie'
      gmailId: string
      /** The mail's Message-ID, or null when it has none and the person's own line was found by its Gmail id. */
      rfcMessageId: string | null
      messageId: string
      /** The job the line is on now, or null. */
      onJob: string | null
      /**
       * True when the line sits on the person, or is the person's own or the tag's own tie (`tagTie`) on another job.
       * False: on this job already, or the office's tie elsewhere, left there.
       */
      tie: boolean
    }
  | {
      /** No line holds this mail: write it (`email_place_address` on `party`, then `email_write_line`). */
      kind: 'write'
      gmailId: string
      threadId: string
      rfcMessageId: string | null
      direction: 'in' | 'out'
      /** Whose thread the line lands on: the address `email_place_address` places, with the header's name. */
      party: EmailAddress
      /** Who wrote it, on a mail out: the person, or the teammate who sent it. Null on a mail in. */
      whoUserId: string | null
      /** The line's who: `Dale Okafor <dale@…> to Marisol Vega's mail`. */
      whoText: string
      subject: string | null
      body: string
      /** ISO, or null when Gmail gave no time (`email_write_line` then writes now). */
      at: string | null
      files: MyMailTagFile[]
      links: MyMailTagLink[]
      /** The raw mail's name beside the files (`format=raw`), so Evidence gets it as received. */
      emlName: string
    }
  | { kind: 'skip'; gmailId: string; why: MyMailTagSkip }

/** The `email_tag_threads` row the tag upserts, on `(user_id, gmail_thread_id)`. */
export interface MyMailThreadRow {
  user_id: string
  gmail_thread_id: string
  bid_id: string | null
  project_id: string | null
  jobs_ledger_id: string | null
  tagged_by: string
}

/** The whole plan the function executes for one tag. */
export interface MyMailTagPlan {
  threadId: string
  jobKey: string
  job: MyMailJobChip
  /** The job in its one column and null in the others, as each written line's row and the thread's row carry it. */
  jobColumns: { bid_id: string | null; project_id: string | null; jobs_ledger_id: string | null }
  /** Every written line's `mailbox` and `mail_user_id`. */
  mailbox: typeof MY_MAIL_MAILBOX
  mailUserId: string
  steps: MyMailTagStep[]
  threadRow: MyMailThreadRow
  /** The label put on each mail in the person's Gmail once its line is written or tied. */
  label: typeof MY_MAIL_GMAIL_LABEL
  /** Lines to write, lines to tie, files on the written lines, mails not written. */
  counts: { lines: number; tied: number; files: number; skipped: number }
}

const clean = (address: string | null | undefined): string => (address ?? '').trim().toLowerCase()

const display = (a: EmailAddress): string => (a.name?.trim() ? `${a.name.trim()} <${a.address}>` : a.address)

/** The job in its one column. */
function jobColumnsOf(job: MyMailJobChip): MyMailTagPlan['jobColumns'] {
  return {
    bid_id: job.kind === 'bid' ? job.id : null,
    project_id: job.kind === 'project' ? job.id : null,
    jobs_ledger_id: job.kind === 'pipeline' ? job.id : null,
  }
}

/** Why a mail is never written, by its labels, or null. */
function neverWritten(email: Pick<EmailIn, 'labels'>): MyMailTagSkip | null {
  const labels = new Set(email.labels)
  for (const [label, why] of Object.entries(MY_MAIL_NEVER_LABELS)) if (labels.has(label)) return why
  return null
}

/** Gmail's own label on a mail the person sent: in their Sent, whatever address it went out from. */
export const MY_MAIL_SENT_LABEL = 'SENT'

/**
 * Whose thread a mail lands on, and which way (`emailParty`). A mail in the person's Sent is theirs whatever address it
 * went out from (an alias, a send-as): its From counts as ours and never as a box's copy, so the line lands on the first
 * To or Cc outside, going out. With nobody outside, a mail from an address the office does not know as a person's (an
 * alias, a box sent as) is the person's own note, on their own thread, coming in.
 */
function partyOf(email: EmailIn, ours: OurAddresses, isPerson: (address: string) => boolean, person: MyMailPerson): EmailParty | null {
  if (!email.labels.includes(MY_MAIL_SENT_LABEL) || !email.from) return emailParty(email, null, ours)
  const from = clean(email.from.address)
  const sent: OurAddresses = {
    isOurs: (address) => clean(address) === from || ours.isOurs(address),
    isTheBox: (address) => clean(address) !== from && ours.isTheBox(address),
  }
  const party = emailParty(email, null, sent)
  if (party?.direction === 'in' && !isPerson(from)) return { address: { name: person.name.trim() || null, address: person.address.trim() }, direction: 'in' }
  return party
}

/**
 * The plan for tagging one conversation onto `job`, as `person`, over what the database already holds (`known`). The
 * mails keep the conversation's order; one Message-ID is planned once.
 */
export function planTag(thread: MyMailThread, person: MyMailPerson, job: MyMailJobChip, known: MyMailKnown): MyMailTagPlan {
  const me = clean(person.address)
  const team = new Map(Object.entries(known.team ?? {}).map(([address, member]) => [clean(address), member]))
  const boxes = new Set((known.boxes ?? []).map(clean).filter((a) => a !== '' && a !== me))
  const ours: OurAddresses = {
    isOurs: (address) => {
      const a = clean(address)
      return a === me || team.has(a) || boxes.has(a)
    },
    isTheBox: (address) => boxes.has(clean(address)),
  }
  const isPerson = (address: string) => {
    const a = clean(address)
    return a === me || team.has(a)
  }
  const hidden = new Set(known.hidden ?? [])
  const box = `${person.name.trim() || person.address.trim()}'s mail`
  const key = jobKey(job)
  const seen = new Set<string>()
  const steps: MyMailTagStep[] = []

  for (const email of thread.messages) {
    const never = neverWritten(email)
    if (never) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: never })
      continue
    }
    if (email.labels.some((l) => hidden.has(l))) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: 'hidden' })
      continue
    }
    const rfc = rfcMessageId(email)
    if (rfc && seen.has(rfc)) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: 'twice' })
      continue
    }
    if (rfc) seen.add(rfc)
    // By the Message-ID in any box; a mail with none by its Gmail id, in this person's box alone.
    const line = rfc ? known.byMessageId[rfc] : known.byGmailId?.[email.gmailId]
    if (line) {
      const tie = line.jobKey === null || (line.jobKey !== key && (line.mine === true || line.tagTie === true))
      steps.push({ kind: 'tie', gmailId: email.gmailId, rfcMessageId: rfc, messageId: line.messageId, onJob: line.jobKey, tie })
      continue
    }
    const party = partyOf(email, ours, isPerson, person)
    if (!party) {
      steps.push({ kind: 'skip', gmailId: email.gmailId, why: 'noParty' })
      continue
    }
    const from = clean(email.from?.address)
    const sent = email.labels.includes(MY_MAIL_SENT_LABEL)
    const whoUserId = party.direction === 'out' ? (from === me || sent ? person.userId : (team.get(from)?.userId ?? null)) : null
    const sender = email.from ?? party.address
    steps.push({
      kind: 'write',
      gmailId: email.gmailId,
      threadId: email.threadId ?? thread.threadId,
      rfcMessageId: rfc,
      direction: party.direction,
      party: party.address,
      whoUserId,
      whoText: party.direction === 'out' ? `${display(sender)} to ${display(party.address)} · from ${box}` : `${display(sender)} to ${box}`,
      subject: email.subject.trim() || null,
      body: email.text,
      at: email.at,
      files: email.files.flatMap((f): MyMailTagFile[] => {
        const keep = fileKeep(f)
        return keep === 'skip' ? [] : [{ partId: f.partId, attachmentId: f.attachmentId, name: f.name, mime: f.mime, size: f.size, keep }]
      }),
      links: fileLinks(email.links).map((l) => ({ name: l.name, url: l.url, host: l.host })),
      emlName: `${email.gmailId}.eml`,
    })
  }

  const jobColumns = jobColumnsOf(job)
  const writes = steps.filter((s): s is Extract<MyMailTagStep, { kind: 'write' }> => s.kind === 'write')
  return {
    threadId: thread.threadId,
    jobKey: key,
    job: { ...job, key },
    jobColumns,
    mailbox: MY_MAIL_MAILBOX,
    mailUserId: person.userId,
    steps,
    threadRow: { user_id: person.userId, gmail_thread_id: thread.threadId, ...jobColumns, tagged_by: person.userId },
    label: MY_MAIL_GMAIL_LABEL,
    counts: {
      lines: writes.length,
      tied: steps.filter((s) => s.kind === 'tie' && s.tie).length,
      files: writes.reduce((n, s) => n + s.files.length, 0),
      skipped: steps.filter((s) => s.kind === 'skip').length,
    },
  }
}
