/**
 * A moved first visit (v2.5597, punch list #115 PR 6): when the office moves a job's first visit to another day or
 * window, the Rescheduled text becomes an offer on Today's sends instead of a sheet, since the block editors change
 * blocks in several places and the move itself is the moment. The office presses it there, or puts it away. Pure parts
 * here (`rescheduledOfferBody`); `offerRescheduledVisit` reads the job, the customer and the lines and writes the offer,
 * swallowing every refusal (a tech moving a block is not the office; a customer with no number gets nothing).
 */
import { jobKey } from '../messages/jobKeys'
import { supabaseOffersIo } from '../offers/offersIo'
import { supabase } from '../supabase'
import { blanksLeftIn, lineFor, tellFills, tellWords, type TellBlock } from './tellCustomer'
import { supabaseTellCustomerIo, type TellCustomerIo } from './tellCustomerIo'
import type { QuickReply } from '../quickReplies/kernel'
import type { PortalLang } from '../gc/portalI18n'
import { formatErrorMessage } from '../../utils/errorHandling'

export interface RescheduledOfferIn {
  customerName: string | null
  lang: PortalLang
  me: string | null
  jobName: string | null
  jobAddress: string | null
  block: TellBlock
  lines: readonly QuickReply[]
  userId: string
}

/** The Rescheduled text as it would go, or null when a blank nobody can fill is left. */
export function rescheduledOfferBody(input: RescheduledOfferIn): string | null {
  const fills = tellFills({ customerName: input.customerName, me: input.me, jobName: input.jobName, jobAddress: input.jobAddress, block: input.block })
  const line = lineFor('rescheduled', input.lines, input.userId)
  const words = tellWords(line, fills, input.lang)
  if (words.left.length || blanksLeftIn(words.text, 'rescheduled').length) return null
  return words.text
}

export interface MovedVisit {
  jobId: string
  /** The block's group, so a job with other visits is not a first visit. */
  groupId: string | null
  /** The block itself when it has no group, left out of the count. */
  blockId?: string | null
  workDate: string
  timeStart: string
  timeEnd: string
  assigneeUserId: string | null
}

/**
 * After a block's day or window changed: when it is the job's first visit and the customer has a number, write the
 * Rescheduled text as an offer waiting on Today's sends. Never throws; a refusal or a missing piece means no offer.
 */
export async function offerRescheduledVisit(moved: MovedVisit, io: TellCustomerIo = supabaseTellCustomerIo(), client: unknown = supabase): Promise<boolean> {
  try {
    const { data: auth } = await (client as typeof supabase).auth.getUser()
    const userId = auth?.user?.id
    if (!userId) return false
    if (!(await io.isFirstVisit(moved.jobId, moved.groupId, moved.blockId ?? null))) return false
    const job = await io.loadJob(moved.jobId)
    if (!job.customerId) return false
    const [contact, lines, me, tech] = await Promise.all([
      io.loadContact(job.customerId),
      io.loadLines(),
      io.loadMyName(userId),
      moved.assigneeUserId ? io.loadMyName(moved.assigneeUserId) : Promise.resolve(null),
    ])
    const number = contact.numbers.find((n) => !n.stopped) ?? null
    if (!number) return false
    const body = rescheduledOfferBody({
      customerName: job.customerName,
      lang: job.lang,
      me,
      jobName: job.jobName,
      jobAddress: job.jobAddress,
      block: { workDate: moved.workDate, timeStart: moved.timeStart, timeEnd: moved.timeEnd, techName: tech },
      lines,
      userId,
    })
    if (!body) return false
    await supabaseOffersIo(client).make({ contactId: contact.contactId, stepKey: 'booked', jobKey: jobKey({ kind: 'pipeline', id: moved.jobId }), body, channelId: number.channelId, sendOn: null })
    return true
  } catch (e) {
    console.warn('[tell the customer] the moved visit made no offer:', formatErrorMessage(e))
    return false
  }
}
