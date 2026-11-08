/**
 * The contract window's text doors through the company number (punch list #125 PR 5, v2.6700). Until this, **Text the
 * link** in the Contract window's Nudge group, **Text link** on the signed rail and the *Text it too* half of **Send the
 * link** each opened an `sms:` on the person's own phone: nothing landed in the customer's thread and the answer went to
 * that phone. Now the two Text doors open the customer's box (`JobCustomerBox`, `ContractTextDoor.tsx`) on Text with
 * the same words and the link filled, and the box's confirm and holds decide; the *Text it too* half goes through
 * `quo-send` in the same press as the email (`sendLink` in `JobContractModal.tsx`).
 *
 * The number is the window's: typed in the rail (`recipientPhone`), or the job's customer phone on the signed rail.
 * `quo-send` texts only a number on the customer's contact (`contact_channels`), so this kernel says whether the typed
 * number is one of them (`typedNumberOnContact`), puts it first when it is so the box texts that one and not another
 * of theirs (`contactLeadingWith`), and when it is not, names the owner's call of 2026-11-08 (question 5): the send
 * adds it to the contact, asked with one chip, one tap (`addNumberChipWords`, `addNumberNote`); the numbers already on
 * file are offered beside it (`numbersOnFile`).
 */
import { normalizeChannel, textableNumbers, type Contact, type ContactChannel } from '../contacts/kernel'

/** The words a signing link goes out with, the same words the `sms:` door carried, so a customer reads what she did before. */
export function contractSignTextWords(address: string | null | undefined, url: string): string {
  return `Here is your service agreement for ${address?.trim() || 'your project'} — review and sign here: ${url}`
}

/** The signed rail's words: the signed record's page. */
export function contractSignedTextWords(address: string | null | undefined, url: string): string {
  return `Here is your signed agreement for ${address?.trim() || 'your project'}: ${url}`
}

/** The typed number as the spine keys it: ten digits, or '' when it is not a number. */
export function typedNumberKey(typed: string | null | undefined): string {
  return normalizeChannel('phone', typed ?? '')
}

/** The contact's channel that is the typed number, compared as the spine compares (ten digits), or null. */
export function typedNumberOnContact(contact: Pick<Contact, 'channels'>, typed: string | null | undefined): ContactChannel | null {
  const key = typedNumberKey(typed)
  if (!key) return null
  return contact.channels.find((ch) => ch.kind === 'phone' && normalizeChannel('phone', ch.value) === key) ?? null
}

/**
 * The contact with one channel moved to the front, so the box's rule — the first number that can still take a text —
 * lands on the window's number. A channel not on the contact leaves it as it was.
 */
export function contactLeadingWith<T extends Pick<Contact, 'channels'>>(contact: T, channelId: string | null): T {
  if (!channelId) return contact
  const lead = contact.channels.find((ch) => ch.id === channelId)
  if (!lead) return contact
  return { ...contact, channels: [lead, ...contact.channels.filter((ch) => ch.id !== channelId)] }
}

/** The numbers on file that can still take a text, as the chip row offers them when the typed number is not one of them. */
export function numbersOnFile(contact: Pick<Contact, 'channels'>): ContactChannel[] {
  return textableNumbers(contact)
}

/** What the door does with the window's number. */
export type TextDoorNumber =
  /** No number was typed: the box picks theirs as it always does. */
  | { kind: 'none' }
  /** The typed number is on their contact: the box texts it. */
  | { kind: 'onFile'; channel: ContactChannel }
  /** The typed number is not on their contact: one chip adds it, the numbers on file are offered beside. */
  | { kind: 'notOnFile'; typed: string; onFile: ContactChannel[] }

export function textDoorNumber(contact: Pick<Contact, 'channels'>, typed: string | null | undefined): TextDoorNumber {
  const trimmed = (typed ?? '').trim()
  if (!typedNumberKey(trimmed)) return { kind: 'none' }
  const channel = typedNumberOnContact(contact, trimmed)
  if (channel) return { kind: 'onFile', channel }
  return { kind: 'notOnFile', typed: trimmed, onFile: numbersOnFile(contact) }
}

/** The one chip: *Add (512) 555-0100 to Sam's contact*. */
export function addNumberChipWords(first: string, typed: string): string {
  return `Add ${typed.trim()} to ${first}’s contact`
}

/** The line over the chip, in the box's own voice. */
export function addNumberNote(first: string, typed: string): string {
  return `${typed.trim()} is not on ${first}’s contact yet, so the company number cannot text it.`
}

/** The quiet press beside the chip: text a number already on file instead. */
export function textOnFileWords(channel: Pick<ContactChannel, 'value'>): string {
  return `Text ${channel.value} instead`
}

/** The toast after the chip: the number joined their contact as a text channel. */
export function numberAddedWords(first: string, typed: string): string {
  return `${typed.trim()} added to ${first}’s contact.`
}
