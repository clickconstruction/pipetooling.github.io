/**
 * Messages, cut 4b: a change order started from a customer's message (`BUILD_PLAN.md` → *A change order from a
 * message*; decision 11 taken as the split: anyone in the office drafts it, the money team sends it). A *Start a
 * change order* press on a message gives the Change orders window its starting words: the job from the message's
 * tie, the customer contact who signs, the message kept on the order. Saved, the message carries a *became CO 2* chip
 * and the order a line back to the message; sent, it keeps a record as our contract's send does.
 *
 * Pure. The draft is the form's `ChangeOrderDraft` (`gc/changeOrderRows.ts`). `gc_draft_change_order_from_message`
 * numbers it under the job's lock and refuses it in `gc_draft_change_order`'s words; the message and the contact are
 * the least of cluster 1's shapes this reads. The send record is `gc_owner_contract_sends`'s columns with the change
 * order in place of the price by line.
 */
import type { UserRole } from '../../hooks/useAuth'
import { calendarYmdInAppTzFromIso, formatDenverTimeOnly } from '../../utils/dateUtils'
import { GC_MONEY_TEAM, GC_OFFICE_TEAM } from '../gc/access'
import type { ChangeOrderDraft } from '../gc/changeOrderRows'
import type { ChangeOrder, GcProject } from '../gc/types'
import { weekdayDate } from '../gc/words'

// ---------- who may ----------

/** Who starts a change order from a message and saves its draft: anyone in the office (decision 11). */
export const CHANGE_ORDER_DRAFT_TEAM: readonly UserRole[] = GC_OFFICE_TEAM

/** Who sends one to the customer to sign: the money team, since it carries our price (decision 11). */
export const CHANGE_ORDER_SEND_TEAM: readonly UserRole[] = GC_MONEY_TEAM

export function whoMayDraft(role: UserRole | null | undefined): boolean {
  return role != null && CHANGE_ORDER_DRAFT_TEAM.includes(role)
}

export function whoMaySend(role: UserRole | null | undefined): boolean {
  return role != null && CHANGE_ORDER_SEND_TEAM.includes(role)
}

// ---------- what it reads ----------

/** The message a change order starts from: the least of cluster 1's `messages` row this reads. */
export interface SourceMessage {
  id: string
  contactId: string
  /** The job the message is tied to; null when it is on the person. */
  jobId: string | null
  channel: 'text' | 'email' | 'call' | 'voicemail' | 'missed' | 'portal' | 'note'
  direction: 'in' | 'out' | 'team'
  /** An ISO timestamp. */
  at: string
  body: string
}

/** The contact the message is with: the least of cluster 1's `contacts` this reads. */
export interface MessageContact {
  id: string
  kind: 'customer' | 'trade' | 'arch' | 'unknown'
  name: string
  first: string
}

/** A job the customer is on, as the Change orders window reads it. */
export type ChangeOrderJob = Pick<GcProject, 'id' | 'name' | 'stage' | 'lostOn'> & { changeOrders?: readonly Pick<ChangeOrder, 'number'>[] }

// ---------- the draft ----------

/** A change order started from a message: the window's starting words, who signs, and where it came from. */
export interface ChangeOrderFromMessage {
  projectId: string
  jobName: string
  /**
   * The form's starting words: the message's first line as the description, the customer's ask as the reason. Its
   * cost and price may stay 0: the money team prices the draft before it goes.
   */
  draft: ChangeOrderDraft
  /** The customer contact who signs it. */
  signer: { contactId: string; name: string }
  /** The message it came from, kept on the order. */
  sourceMessageId: string
  /** The number it should take; `gc_draft_change_order_from_message` gives the real one under a lock on the job. */
  nextNumber: number
}

export type FromMessageRefusal = 'no job' | 'not a customer' | 'not won'

export type FromMessageResult = { ok: true; order: ChangeOrderFromMessage } | { ok: false; why: FromMessageRefusal; words: string }

/** A description longer than this is cut at a word, for the office to finish. */
const DESCRIPTION_MAX = 160

const KIND_WORDS: Readonly<Record<MessageContact['kind'], string>> = {
  customer: 'a customer',
  trade: 'a trade partner',
  arch: 'an architect',
  unknown: 'a number nobody has named yet',
}

/** The message's first line, cut at a word when it runs long. */
function descriptionOf(body: string): string {
  const line = (body.trim().split(/\r?\n/)[0] ?? '').trim()
  if (line.length <= DESCRIPTION_MAX) return line
  const cut = line.slice(0, DESCRIPTION_MAX)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : DESCRIPTION_MAX).trim()}…`
}

/**
 * A change order's starting draft from a customer's message: on the job the message is tied to, a job of theirs that
 * we won, signed by the customer contact, the message kept as its source. Refused, in words, when the message has no
 * job, the contact is not a customer, or the job is still bidding or lost.
 */
export function draftFromMessage(message: SourceMessage, contact: MessageContact, jobs: readonly ChangeOrderJob[]): FromMessageResult {
  if (contact.kind !== 'customer')
    return { ok: false, why: 'not a customer', words: `A change order goes to a customer. This message is with ${KIND_WORDS[contact.kind]}.` }
  const job = message.jobId ? jobs.find((j) => j.id === message.jobId) : undefined
  if (!job) return { ok: false, why: 'no job', words: 'Tie the message to a job first. A change order belongs to one job.' }
  if (job.lostOn) return { ok: false, why: 'not won', words: `A change order needs a job we won. ${job.name} was lost.` }
  if (job.stage === 'pursuing') return { ok: false, why: 'not won', words: `A change order needs a job we won. ${job.name} is still bidding.` }
  const numbers = (job.changeOrders ?? []).map((c) => c.number)
  return {
    ok: true,
    order: {
      projectId: job.id,
      jobName: job.name,
      draft: { description: descriptionOf(message.body), reason: 'owner', schedule: '', packageId: null, cost: 0, price: 0, days: 0 },
      signer: { contactId: contact.id, name: contact.name },
      sourceMessageId: message.id,
      nextNumber: numbers.length ? Math.max(...numbers) + 1 : 1,
    },
  }
}

// ---------- the chip on the message, and the line back ----------

/** The chip on the message once its change order is saved: 'became CO 2'. */
export const becameChip = (number: number): string => `became CO ${number}`

const CHANNEL_WORDS: Readonly<Record<SourceMessage['channel'], string>> = {
  text: 'text',
  email: 'email',
  call: 'call',
  voicemail: 'voicemail',
  missed: 'missed call',
  portal: 'message in the portal',
  note: 'team note',
}

const dayOf = (iso: string): string => weekdayDate(calendarYmdInAppTzFromIso(iso) || null)
const clockOf = (iso: string): string => formatDenverTimeOnly(Date.parse(iso)).replace(/ /g, ' ')

/** The order's line back to the message it came from: 'From Priya's text on Mon Sep 28.' */
export function fromMessageLine(message: SourceMessage, contact: Pick<MessageContact, 'first'>): string {
  const whose = message.direction === 'in' ? `${contact.first}'s` : message.direction === 'team' ? 'a' : 'our'
  return `From ${whose} ${CHANNEL_WORDS[message.channel]} on ${dayOf(message.at)}.`
}

// ---------- the send record ----------

/**
 * A change order's send, in the columns `gc_owner_contract_sends` keeps our contract's send in, with the change
 * order in place of the price by line: the day it went and who sent it, the day to sign by, the note, the file, and
 * once they sign, the day, the printed name, the signature's file and the consent.
 */
export interface ChangeOrderSendRow {
  change_order_id: string
  project_id: string
  customer_id: string | null
  sent_on: string
  sent_by: string | null
  sign_by: string
  note: string
  file_name: string
  file_path: string
  file_sha256: string
  signed_on: string | null
  signer_printed_name: string | null
  signer_signature_storage_path: string | null
  signer_consented_at: string | null
  signer_ip: string | null
  signer_user_agent: string | null
}

/** The send as the order's window reads it: sent, the link, opened, signed, the name, the signature, the consent. */
export interface ChangeOrderSendRecord {
  sent: { on: string; by: string | null; signBy: string }
  /** Their portal's link to the change order. */
  link: string | null
  /** Their first view of it in the portal, an ISO timestamp. */
  opened: string | null
  signed: string | null
  name: string | null
  /** The signature's file in storage. */
  signature: string | null
  consent: { at: string; ip: string | null; userAgent: string | null } | null
}

/** A send row read as its record, with their portal's link and their first view of it. */
export function sendRecord(row: ChangeOrderSendRow, portal: { link: string | null; openedAt: string | null }): ChangeOrderSendRecord {
  return {
    sent: { on: row.sent_on, by: row.sent_by, signBy: row.sign_by },
    link: portal.link,
    opened: portal.openedAt,
    signed: row.signed_on,
    name: row.signer_printed_name,
    signature: row.signer_signature_storage_path,
    consent: row.signer_consented_at ? { at: row.signer_consented_at, ip: row.signer_ip, userAgent: row.signer_user_agent } : null,
  }
}

/** The record in words, a line each, as the order's window lists it. */
export function sendRecordLines(record: ChangeOrderSendRecord): string[] {
  const lines = [`Sent ${weekdayDate(record.sent.on)}, to sign by ${weekdayDate(record.sent.signBy)}.`]
  if (record.link) lines.push(`Their link: ${record.link}`)
  lines.push(record.opened ? `Opened ${dayOf(record.opened)} at ${clockOf(record.opened)}.` : 'Not opened yet.')
  lines.push(record.signed ? `Signed ${weekdayDate(record.signed)}${record.name ? ` as ${record.name}` : ''}.` : 'Not signed yet.')
  if (record.signature) lines.push('Their signature is kept with it.')
  if (record.consent) lines.push(`They agreed to sign electronically ${dayOf(record.consent.at)} at ${clockOf(record.consent.at)}.`)
  return lines
}
