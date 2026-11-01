import { supabase } from '../supabase'
import type { Json } from '../../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { contactForCustomer, loadContact } from '../messages/messagesIo'
import { supabaseTextsSwitchIo } from '../quo/textsSwitchIo'
import { TEXTS_OFF } from '../quo/textsSwitch'
import type { LienDeskItemRow } from './lienDesk'
import {
  courtesyEmailText,
  courtesyOwnerSubject,
  courtesyPlan,
  courtesySubject,
  courtesyTextBody,
  withCourtesyRecord,
  type CourtesyFacts,
  type CourtesyRecipientPlan,
  type CourtesyRecord,
  type CourtesySent,
} from './lienCourtesyNotice'

/**
 * The courtesy notice's reads and writes (punch list #231, PR 2). The kernel (`lienCourtesyNotice.ts`)
 * says who gets it and what it says; this file finds the addresses, sends, and writes the record.
 *
 * - The GC's email is the one the sent notice's draft carries (the courtesy PDF went there), else
 *   the one on their Messages contact. Their number is their Messages contact's phone channel
 *   (`contact_for_customer` makes the contact when there is none, the office's own door), and a
 *   text goes only while Send texts is on and the number has not sent STOP. `quo-send` adds the
 *   opt-out line itself.
 * - The owner's email is the property record's (`job_property_owners.owner_email`). The owner is
 *   not a Messages contact, so the owner gets no text.
 * - The email goes through `send-lien-filing-email` with `email_type: 'lien_courtesy'` and no
 *   attachment: the function logs it, files the sent copy on the job and replies to the office.
 *   Until that kind is deployed the function refuses the missing PDF, and the refusal is recorded
 *   as the reason the email did not go — nothing is pretended.
 * - The record rides the sent item's `fields.courtesy[]` (`withCourtesyRecord`); the job's trail
 *   line (`lien_courtesy_sent`) is a trigger's, on that update (PR 3's migration), since the table
 *   takes no client insert. A press where nothing went writes no record: the office reads why and
 *   tries again.
 */

export type CourtesyRecipient = CourtesyRecipientPlan & {
  /** The Messages contact the text goes to; null when there is none. */
  contactId: string | null
  /** The phone channel's row; null when the text cannot go. */
  textChannelId: string | null
}

export type CourtesyRecipientsInput = {
  gcCustomerId: string | null
  gcName: string
  /** The address the sent notice's draft carries; '' when none. */
  gcEmail: string
  ownerName: string
  ownerEmail: string
}

/** Each recipient with their channels found: the GC's from the notice and their Messages contact, the owner's from the property record. */
export async function loadCourtesyRecipients(input: CourtesyRecipientsInput): Promise<CourtesyRecipient[]> {
  const textsOn = await supabaseTextsSwitchIo()
    .load()
    .catch(() => false)
  let contactId: string | null = null
  let textChannelId: string | null = null
  let phone = ''
  let textHold = ''
  let gcEmail = input.gcEmail.trim()
  if (input.gcCustomerId) {
    try {
      contactId = await contactForCustomer(input.gcCustomerId)
      const contact = await loadContact(contactId)
      const phones = (contact?.channels ?? []).filter((c) => c.kind === 'phone' && c.value.trim())
      const live = phones.find((c) => !c.optedOutAt) ?? null
      if (live) {
        phone = live.value.trim()
        if (!textsOn) textHold = TEXTS_OFF
        else textChannelId = live.id
      } else if (phones.length) {
        phone = phones[0]!.value.trim()
        textHold = 'they sent STOP'
      }
      if (!gcEmail) gcEmail = (contact?.channels ?? []).find((c) => c.kind === 'email' && c.value.trim())?.value.trim() ?? ''
    } catch (e) {
      textHold = `their Messages contact could not be opened: ${formatErrorMessage(e)}`
    }
  }
  const plans = courtesyPlan([
    { who: 'original_contractor', name: input.gcName, email: gcEmail, phone, textHold: phone ? textHold : '' },
    { who: 'owner', name: input.ownerName, email: input.ownerEmail, phone: '', textHold: '' },
  ])
  return plans.map((p) => (p.who === 'original_contractor' ? { ...p, contactId, textChannelId: p.text.goes ? textChannelId : null } : { ...p, contactId: null, textChannelId: null }))
}

type EmailAnswer = { success?: boolean; resend_email_id?: string | null; error?: string } | null
type TextAnswer = { ok?: boolean; messageId?: string; words?: string; error?: string } | null

async function sendCourtesyEmail(input: { jobId: string; to: string; who: CourtesyRecipient['who']; subject: string; text: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('send-lien-filing-email', {
    body: { job_id: input.jobId, to_email: input.to, recipient_label: input.who, subject: input.subject, email_text: input.text, email_type: 'lien_courtesy' },
  })
  if (error) {
    const context = (error as { context?: unknown }).context
    const answer = context instanceof Response ? ((await context.json().catch(() => null)) as EmailAnswer) : null
    throw new Error(answer?.error || formatErrorMessage(error, 'the email did not go'))
  }
  const answer = data as EmailAnswer
  if (answer?.error) throw new Error(answer.error)
  return answer?.resend_email_id || 'sent'
}

async function sendCourtesyText(input: { jobId: string; contactId: string; channelId: string; body: string }): Promise<string> {
  const { data, error } = await supabase.functions.invoke('quo-send', {
    body: { contactId: input.contactId, channelId: input.channelId, tie: { jobId: input.jobId, column: 'jobs_ledger_id' }, body: input.body, held: false },
  })
  if (error) {
    const context = (error as { context?: unknown }).context
    const answer = context instanceof Response ? ((await context.json().catch(() => null)) as TextAnswer) : null
    throw new Error(answer?.words || answer?.error || formatErrorMessage(error, 'the text did not go'))
  }
  const answer = data as TextAnswer
  if (!answer?.ok) throw new Error(answer?.words || answer?.error || 'the text did not go')
  return answer.messageId || 'sent'
}

export type CourtesySendInput = {
  item: Pick<LienDeskItemRow, 'id' | 'fields'>
  jobId: string
  facts: CourtesyFacts
  /** The one line the office may change on the GC's email. */
  greeting: string
  recipients: ReadonlyArray<CourtesyRecipient>
  by: { userId: string | null; name: string }
}

export type CourtesySendResult = { record: CourtesyRecord | null; to: CourtesySent[] }

/**
 * Press: each channel that goes is sent in turn, a failure recorded as its reason and the rest
 * still sent; with at least one away the record is written on the sent item and a line on the
 * job's trail; with nothing away, nothing is written and the reasons come back.
 */
export async function sendCourtesyNotice(input: CourtesySendInput): Promise<CourtesySendResult> {
  const to: CourtesySent[] = []
  for (const r of input.recipients) {
    if (r.email.goes) {
      const subject = r.who === 'owner' ? courtesyOwnerSubject(input.facts) : courtesySubject(input.facts)
      const text = courtesyEmailText(input.facts, r.who, input.greeting)
      try {
        const id = await sendCourtesyEmail({ jobId: input.jobId, to: r.email.address, who: r.who, subject, text })
        to.push({ who: r.who, name: r.name, channel: 'email', address: r.email.address, ok: true, id, reason: '' })
      } catch (e) {
        to.push({ who: r.who, name: r.name, channel: 'email', address: r.email.address, ok: false, id: null, reason: formatErrorMessage(e, 'the email did not go') })
      }
    }
    if (r.text.goes && r.contactId && r.textChannelId) {
      try {
        const id = await sendCourtesyText({ jobId: input.jobId, contactId: r.contactId, channelId: r.textChannelId, body: courtesyTextBody(input.facts, r.who) })
        to.push({ who: r.who, name: r.name, channel: 'text', address: r.text.address, ok: true, id, reason: '' })
      } catch (e) {
        to.push({ who: r.who, name: r.name, channel: 'text', address: r.text.address, ok: false, id: null, reason: formatErrorMessage(e, 'the text did not go') })
      }
    }
  }
  if (!to.some((t) => t.ok)) return { record: null, to }
  const record: CourtesyRecord = { at: new Date().toISOString(), by: input.by.name.trim(), lienDay: input.facts.lienDay, claim: input.facts.claim, to }
  const fields = withCourtesyRecord((input.item.fields ?? {}) as Record<string, unknown>, record) as unknown as Json
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ fields } as never).eq('id', input.item.id), 'lien desk: record the courtesy notice')
  return { record, to }
}
