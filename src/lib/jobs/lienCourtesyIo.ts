import { supabase } from '../supabase'
import type { Json } from '../../types/database'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { contactForCustomer, findContactIdForPhone, findCustomerContactId, loadContact } from '../messages/messagesIo'
import { courtesyGcChannels, courtesyOwnerChannels, phoneChannelKey, textChannelFor, type CourtesyOwnerChannels } from './lienCourtesyContact'
import { supabaseTextsSwitchIo } from '../quo/textsSwitchIo'
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
 *   the one on their Messages contact or their customer record. Their number is their Messages
 *   contact's phone channel, or, while they have no contact, the number on their customer record —
 *   read, never made (punch list #243): the window used to open the thread with `contact_for_customer`,
 *   which makes the contact, so a window opened and cancelled left one behind. Now the press makes
 *   it, and only when a text goes. A text goes only while Send texts is on and the number has not
 *   sent STOP. `quo-send` adds the opt-out line itself.
 * - The owner's email and phone are the property's as `resolveLienProperty` gives them (v2.6497): the
 *   per-job override's where it names the owner, else the property record's, which the office types
 *   on the property window beside the mailing address. The Messages spine has no kind for a property
 *   owner, so the window never makes a contact for one: the owner's text goes only when their number
 *   already belongs to a contact (`contact_for_channel`), on that channel, under the GC's own holds;
 *   otherwise the Text column says *not in Messages, so the email goes alone*.
 * - The email goes through `send-lien-filing-email` with `email_type: 'lien_courtesy'` and no
 *   attachment: the function logs it, files the sent copy on the job and replies to the office.
 *   Until that kind is deployed the function refuses the missing PDF, and the refusal is recorded
 *   as the reason the email did not go — nothing is pretended.
 * - The record rides the sent item's `fields.courtesy[]` (`withCourtesyRecord`); the job's trail
 *   line (`lien_courtesy_sent`) is a trigger's, on that update (PR 3's migration), since the table
 *   takes no client insert. A press where nothing went writes no record: the office reads why and
 *   tries again. A press whose messages went but whose record did not take comes back with
 *   `recordError` instead of throwing (punch list #249, row 1), so the window closes and the footer
 *   offers *Write the record again ›* (`writeCourtesyRecord`) in place of a second send.
 */

export type CourtesyRecipient = CourtesyRecipientPlan & {
  /** The Messages contact the text goes from; null when the GC has none yet — the press makes it when the text goes. */
  contactId: string | null
  /** The phone channel's row; null when the text cannot go, or while there is no contact yet. */
  textChannelId: string | null
}

export type CourtesyRecipientsInput = {
  gcCustomerId: string | null
  gcName: string
  /** The address the sent notice's draft carries; '' when none. */
  gcEmail: string
  ownerName: string
  ownerEmail: string
  /** The owner's number on the property record (v2.6497); '' when none. */
  ownerPhone: string
}

/** The number and address on the GC's customer record — what `contact_find_or_make` copies onto the contact it makes. */
async function customerContactInfo(customerId: string): Promise<{ phone: string; email: string }> {
  const row = await withSupabaseRetry<{ contact_info: unknown } | null>(
    () => supabase.from('customers').select('contact_info').eq('id', customerId).maybeSingle(),
    'lien desk: read the GC’s number',
  )
  const ci = (row?.contact_info ?? null) as { phone?: unknown; email?: unknown } | null
  return { phone: typeof ci?.phone === 'string' ? ci.phone.trim() : '', email: typeof ci?.email === 'string' ? ci.email.trim() : '' }
}

/** Each recipient with their channels found: the GC's from the notice, their Messages contact or their record (nothing made), the owner's from the property record. */
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
      const foundId = await findCustomerContactId(input.gcCustomerId)
      const contact = foundId ? await loadContact(foundId) : null
      const record = contact ? { phone: '', email: '' } : await customerContactInfo(input.gcCustomerId)
      const found = courtesyGcChannels({ contact: contact ? { id: contact.id, channels: contact.channels } : null, customerPhone: record.phone, customerEmail: record.email, textsOn })
      contactId = found.contactId
      textChannelId = found.textChannelId
      phone = found.phone
      textHold = found.textHold
      if (!gcEmail) gcEmail = found.email
    } catch (e) {
      textHold = `their Messages contact could not be opened: ${formatErrorMessage(e)}`
    }
  }
  // The owner (v2.6497): the record's number, texted only on a thread that already holds it; nothing is made for them.
  let owner: CourtesyOwnerChannels = courtesyOwnerChannels({ contact: null, phone: input.ownerPhone, textsOn })
  if (phoneChannelKey(input.ownerPhone)) {
    try {
      const holderId = await findContactIdForPhone(input.ownerPhone)
      const holder = holderId ? await loadContact(holderId) : null
      owner = courtesyOwnerChannels({ contact: holder ? { id: holder.id, channels: holder.channels } : null, phone: input.ownerPhone, textsOn })
    } catch (e) {
      owner = { contactId: null, textChannelId: null, phone: input.ownerPhone.trim(), textHold: `their Messages contact could not be read: ${formatErrorMessage(e)}` }
    }
  }
  const plans = courtesyPlan([
    // The hold rides whether or not a number was found (v2.6382): with no number it is the reason none was — their contact could not be read.
    { who: 'original_contractor', name: input.gcName, email: gcEmail, phone, textHold },
    { who: 'owner', name: input.ownerName, email: input.ownerEmail, phone: owner.phone, textHold: owner.textHold },
  ])
  return plans.map((p) => (p.who === 'original_contractor' ? { ...p, contactId, textChannelId: p.text.goes ? textChannelId : null } : { ...p, contactId: owner.contactId, textChannelId: p.text.goes ? owner.textChannelId : null }))
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
  /** The GC's customer: the press makes their Messages contact from it when a text goes and they have none yet. */
  gcCustomerId: string | null
  facts: CourtesyFacts
  /** The one line the office may change on the GC's email. */
  greeting: string
  recipients: ReadonlyArray<CourtesyRecipient>
  by: { userId: string | null; name: string }
}

export type CourtesySendResult = {
  record: CourtesyRecord | null
  to: CourtesySent[]
  /** Set when the messages went but the record did not take (punch list #249, row 1): the window closes, nothing is sent again, and the footer offers to write the record alone. */
  recordError?: string
}

/** The record alone, for a press whose messages went but whose record did not take (punch list #249, row 1): nothing is sent. */
export async function writeCourtesyRecord(item: Pick<LienDeskItemRow, 'id' | 'fields'>, record: CourtesyRecord): Promise<void> {
  const fields = withCourtesyRecord((item.fields ?? {}) as Record<string, unknown>, record) as unknown as Json
  await withSupabaseRetry(() => supabase.from('job_lien_desk_items').update({ fields } as never).eq('id', item.id), 'lien desk: record the courtesy notice')
}

/**
 * The text's door: the recipient's Messages contact and the channel the number sits on. A GC with no
 * contact yet gets one here, at the press and only because a text goes (punch list #243) — the
 * office's own door, `contact_for_customer`, which copies the record's number onto it. The owner's
 * text goes only on a contact the plan already found (v2.6497); none is made for them.
 */
async function textDoorFor(r: CourtesyRecipient, gcCustomerId: string | null): Promise<{ contactId: string; channelId: string }> {
  if (r.contactId && r.textChannelId) return { contactId: r.contactId, channelId: r.textChannelId }
  if (r.who !== 'original_contractor' || !gcCustomerId) throw new Error('no Messages contact to text from')
  const contactId = await contactForCustomer(gcCustomerId)
  const contact = await loadContact(contactId)
  const channel = textChannelFor(contact?.channels ?? [], r.text.address)
  if (!channel) throw new Error('their Messages contact holds no number that can be texted')
  return { contactId, channelId: channel.id }
}

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
    if (r.text.goes) {
      try {
        const door = await textDoorFor(r, input.gcCustomerId)
        const id = await sendCourtesyText({ jobId: input.jobId, contactId: door.contactId, channelId: door.channelId, body: courtesyTextBody(input.facts, r.who) })
        to.push({ who: r.who, name: r.name, channel: 'text', address: r.text.address, ok: true, id, reason: '' })
      } catch (e) {
        to.push({ who: r.who, name: r.name, channel: 'text', address: r.text.address, ok: false, id: null, reason: formatErrorMessage(e, 'the text did not go') })
      }
    }
  }
  if (!to.some((t) => t.ok)) return { record: null, to }
  const record: CourtesyRecord = { at: new Date().toISOString(), by: input.by.name.trim(), lienDay: input.facts.lienDay, claim: input.facts.claim, to }
  try {
    await writeCourtesyRecord(input.item, record)
  } catch (e) {
    // The messages went; a throw here left the window open with its Send press live, and a second press sent everything twice (punch list #249, row 1).
    return { record, to, recordError: formatErrorMessage(e, 'the record could not be written') }
  }
  return { record, to }
}
