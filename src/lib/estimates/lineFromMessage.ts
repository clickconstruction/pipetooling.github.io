/**
 * Messages, residential R8 · 8: a line on an estimate started from a customer's message (`RESIDENTIAL_BUILD_PLAN.md` →
 * R8, card 8 of `customer-messages-integrations-mockups.html` v0.2 on branch spike/gc-mode, its chip renamed by the
 * lead). Cut 4b's change order from a message (`changeOrders/fromMessage.ts`) with the estimate's form in place of the
 * change order's: a press on a line gives the Estimates form its starting line, on the job the message is tied to,
 * with the customer who wrote as the signer and the message kept as the estimate's source. The message then carries
 * *became line 2 on estimate 1044, $0 until priced*, and once the office prices it, a line back to the customer says so.
 *
 * It is a plain line in the estimate's `line_items_snapshot`, never one of the estimate's options. It joins the job's
 * open estimate, a draft not yet sent, or starts a new estimate on the job. It is never a change order: on main a
 * change order is the GC customer's paper with its own signing, and new work after the first estimate is accepted is a
 * second estimate the customer approves the same way as the first.
 *
 * Pure. The line is the estimate's own `EstimateLineItemNormalized`, saved through the Estimates page's existing write
 * (`estimateDraftPersist.ts`); the message that started it is R8's `estimates.source_message_id`.
 */
import type { UserRole } from '../../hooks/useAuth'
import type { Contact } from '../contacts/kernel'
import { computeEstimateLineExtendedCents, type EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { GC_MONEY_TEAM, GC_OFFICE_TEAM } from '../gc/access'
import { normalizeJobsLedgerStatus } from '../jobsLedgerStatusPipeline'
import type { ThreadMessage } from '../messages/thread'
import { isReplaceableStubLine } from './estimateDraftLines'

// ---------- who may ----------

/** Who starts a line from a message and saves its draft: anyone in the office, as with a change order. */
export const LINE_DRAFT_TEAM: readonly UserRole[] = GC_OFFICE_TEAM

/**
 * Who sends it to the customer: the money team, so this line and the change order from a message read the same. An
 * ordinary estimate's send is wider today; widening this one is this line.
 */
export const LINE_SEND_TEAM: readonly UserRole[] = GC_MONEY_TEAM

export function whoMayDraft(role: UserRole | null | undefined): boolean {
  return role != null && LINE_DRAFT_TEAM.includes(role)
}

export function whoMaySend(role: UserRole | null | undefined): boolean {
  return role != null && LINE_SEND_TEAM.includes(role)
}

// ---------- what it reads ----------

/** The message a line starts from: the least of the spine's `messages` row this reads. */
export type LineMessage = Pick<ThreadMessage, 'id' | 'contactId' | 'jobId' | 'channel' | 'direction' | 'at' | 'body'>

/** The contact the message is with: the least of the spine's contact this reads. */
export type LineContact = Pick<Contact, 'id' | 'kind' | 'name'> & { customerId?: string | null }

/** A Pipeline job, as this reads its `jobs_ledger` row. */
export interface LineJob {
  id: string
  /** `job_name`. */
  name: string
  /** `jobs_ledger.status`: waiting, working, ready to bill, billed or paid. */
  status: string
  /** The customer the job is for. */
  customerId: string | null
}

/** An estimate on a job, as this reads its `estimates` row. */
export interface LineEstimate {
  id: string
  /** `job_ledger_id`. */
  jobId: string | null
  /** `doc_kind`: an estimate, or a change order, which a line from a message never joins. */
  docKind: string
  /** `estimate_status`: draft, sent, customer accepted, declined or superseded. */
  status: string
  /** `estimate_number`. */
  number: number
  /** `line_items_snapshot`. */
  lines: readonly EstimateLineItemNormalized[]
}

// ---------- the draft ----------

/** A line started from a message: the form's starting line, where it goes, who signs, and where it came from. */
export interface LineDraft {
  jobId: string
  jobName: string
  /** The customer who signs: the one who wrote. */
  signer: { contactId: string; customerId: string; name: string }
  /** The message it came from, kept as the estimate's source. */
  sourceMessageId: string
  /** The open estimate the line joins. Null: a new estimate on the job. */
  estimateId: string | null
  estimateNumber: number | null
  /**
   * The line in the estimate's own shape: the message's first sentence as the description, one of it, and a price
   * the office fills in. The name of the line is left for the office too.
   */
  line: EstimateLineItemNormalized
  /** True when the line takes the place of the estimate's blank or placeholder last line. */
  replacesLast: boolean
  /** The line's place on the estimate once added, 1 on a new one: the chip's number. */
  number: number
}

export type LineRefusal = 'not a customer' | 'no job' | 'not their job' | 'job billed'

export type LineResult = { ok: true; draft: LineDraft } | { ok: false; why: LineRefusal; words: string }

/** A description longer than this is cut at a word, for the office to finish. */
const DESCRIPTION_MAX = 160

const KIND_WORDS: Readonly<Record<LineContact['kind'], string>> = {
  customer: 'a customer',
  trade: 'a trade partner',
  arch: 'an architect',
  unknown: 'a number nobody has named yet',
}

/** The message's first sentence, cut at a word when it runs long. */
export function lineDescription(body: string): string {
  const firstLine = (body.trim().split(/\r?\n/)[0] ?? '').trim()
  const sentence = (firstLine.split(/(?<=[.?!])\s+/)[0] ?? '').trim()
  if (sentence.length <= DESCRIPTION_MAX) return sentence
  const cut = sentence.slice(0, DESCRIPTION_MAX)
  const space = cut.lastIndexOf(' ')
  return `${cut.slice(0, space > 0 ? space : DESCRIPTION_MAX).trim()}…`
}

/** The job's open estimate: a draft estimate on it, the newest when there are two. */
function openEstimate(jobId: string, estimates: readonly LineEstimate[]): LineEstimate | null {
  const open = estimates.filter((e) => e.jobId === jobId && e.docKind === 'estimate' && e.status === 'draft')
  return open.reduce<LineEstimate | null>((best, e) => (!best || e.number > best.number ? e : best), null)
}

/**
 * A line's starting draft from a customer's message: on the job the message is tied to, a job of theirs we have not
 * billed, signed by the customer who wrote, the message kept as its source, on the job's open estimate or a new one.
 * Refused, in words, when the contact is not a customer, the message has no job, the job is not theirs, or the job is
 * billed or paid.
 */
export function lineDraftFromMessage(
  message: LineMessage,
  contact: LineContact,
  jobs: readonly LineJob[],
  estimates: readonly LineEstimate[],
): LineResult {
  if (contact.kind !== 'customer')
    return { ok: false, why: 'not a customer', words: `A line from a message goes on a customer's estimate. This message is with ${KIND_WORDS[contact.kind]}.` }
  if (!message.jobId) return { ok: false, why: 'no job', words: 'Tie the message to a job first. An estimate belongs to one job.' }
  const job = jobs.find((j) => j.id === message.jobId)
  if (!job || !contact.customerId || job.customerId !== contact.customerId)
    return { ok: false, why: 'not their job', words: `This message is tied to a job that is not ${contact.name}'s. Tie it to one of their jobs first.` }
  const status = normalizeJobsLedgerStatus(job.status)
  if (status === 'billed') return { ok: false, why: 'job billed', words: `${job.name} is billed already. Start the work as a new job.` }
  if (status === 'paid') return { ok: false, why: 'job billed', words: `${job.name} is paid and closed. Start the work as a new job.` }

  const estimate = openEstimate(job.id, estimates)
  const last = estimate?.lines[estimate.lines.length - 1]
  const replacesLast = Boolean(last && isReplaceableStubLine(last))
  const count = estimate?.lines.length ?? 0
  return {
    ok: true,
    draft: {
      jobId: job.id,
      jobName: job.name,
      signer: { contactId: contact.id, customerId: contact.customerId, name: contact.name },
      sourceMessageId: message.id,
      estimateId: estimate?.id ?? null,
      estimateNumber: estimate?.number ?? null,
      line: { line_item: '', description: lineDescription(message.body), quantity: 1, unit_price_cents: 0, amount_cents: computeEstimateLineExtendedCents(1, 0) },
      replacesLast,
      number: replacesLast ? count : count + 1,
    },
  }
}

// ---------- the chip on the message, and the lines after ----------

/** Dollars as a line says them: "$185", or "$185.50" when there are cents. */
function dollars(cents: number): string {
  const whole = cents % 100 === 0
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`
}

const estimateWords = (estimateNumber: number | null): string => (estimateNumber != null ? `estimate ${estimateNumber}` : 'a new estimate')

/**
 * The chip on the message once its line is saved: "became line 2 on estimate 1044, $0 until priced", then "became
 * line 2 on estimate 1044, $185". Before a new estimate has its number: "became line 1 on a new estimate, …".
 */
export function becameChip(line: { number: number; estimateNumber: number | null; amountCents: number }): string {
  const price = line.amountCents ? dollars(line.amountCents) : '$0 until priced'
  return `became line ${line.number} on ${estimateWords(line.estimateNumber)}, ${price}`
}

/** What the office hears once the draft is saved: where it went, and who takes it from there. */
export function draftedWords(draft: Pick<LineDraft, 'number' | 'estimateNumber' | 'jobName'>): string {
  return `Line ${draft.number} is drafted on ${estimateWords(draft.estimateNumber)} for ${draft.jobName}. The money team prices it and sends it.`
}

/**
 * The line back to the customer once the office prices it: "Dana, the work you asked about is $185. It is on your
 * estimate for Helotes. Approve it there and we will do it." Null while it is still $0.
 */
export function pricedWords(first: string, line: { amountCents: number }, jobName: string): string | null {
  if (line.amountCents <= 0) return null
  return `${first}, the work you asked about is ${dollars(line.amountCents)}. It is on your estimate for ${jobName}. Approve it there and we will do it.`
}
