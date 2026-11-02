import { TEXTS_OFF } from '../quo/textsSwitch'

/**
 * The GC's channels for the courtesy notice, read without making anything (punch list #243, PR 1).
 *
 * The send window used to open the GC's Messages thread with `contact_for_customer`, which makes
 * the contact when there is none — so a window opened and cancelled, or a send by email alone,
 * left a stray contact behind (the courtesy notice's live test, 2026-11-01). Now the window reads:
 * the GC's own contact when one exists, else the number and address on their customer record,
 * which is exactly what `contact_find_or_make` would copy onto the contact it makes. The press
 * makes the contact, and only when a text goes (`lienCourtesyIo.ts`). Pure; the IO reads the rows.
 */

export type CourtesyChannelLike = { id: string; kind: string; value: string; optedOutAt: string | null }

/**
 * Mirrors `contact_channel_key('phone', …)` (20261012010000_messages_spine.sql): the digits alone, a
 * leading 1 dropped from eleven, at least seven of them; '' when the spine would keep no channel
 * for the value, so a number that cannot be texted is never planned as one.
 */
export function phoneChannelKey(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/[^0-9]/g, '')
  const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return d.length >= 7 ? d : ''
}

export type CourtesyGcChannelsInput = {
  /** The GC's own Messages contact when one exists; null when none — nothing is made to find out. */
  contact: { id: string; channels: ReadonlyArray<CourtesyChannelLike> } | null
  /** `customers.contact_info.phone`, '' when none: what the contact would get when it is made. Read only when there is no contact. */
  customerPhone: string
  /** `customers.contact_info.email`, '' when none: the same. */
  customerEmail: string
  /** Send texts (Settings → Phone and texts). */
  textsOn: boolean
}

export type CourtesyGcChannels = {
  /** The contact the text goes from; null until the press makes it. */
  contactId: string | null
  /** The number the text goes to, as given; '' when there is none to text. */
  phone: string
  /** Why the number cannot be texted; '' when it can. */
  textHold: string
  /** The phone channel's row; null while there is no contact yet — the press finds it on the contact it makes. */
  textChannelId: string | null
  /** The address the contact or the record holds, for when the sent notice carries none. */
  email: string
}

/** The GC's number and address as the window shows them, and whether a text may go. */
export function courtesyGcChannels(input: CourtesyGcChannelsInput): CourtesyGcChannels {
  if (input.contact) {
    const phones = input.contact.channels.filter((c) => c.kind === 'phone' && c.value.trim())
    const live = phones.find((c) => !c.optedOutAt) ?? null
    const email = input.contact.channels.find((c) => c.kind === 'email' && c.value.trim())?.value.trim() ?? ''
    if (live) return { contactId: input.contact.id, phone: live.value.trim(), textHold: input.textsOn ? '' : TEXTS_OFF, textChannelId: input.textsOn ? live.id : null, email }
    if (phones.length) return { contactId: input.contact.id, phone: phones[0]!.value.trim(), textHold: 'they sent STOP', textChannelId: null, email }
    return { contactId: input.contact.id, phone: '', textHold: '', textChannelId: null, email }
  }
  const phone = phoneChannelKey(input.customerPhone) ? input.customerPhone.trim() : ''
  return { contactId: null, phone, textHold: phone && !input.textsOn ? TEXTS_OFF : '', textChannelId: null, email: input.customerEmail.trim() }
}

/**
 * On the contact the press made: the live phone channel that holds the planned number, else the
 * first live phone channel; null when the contact holds no number that can be texted.
 */
export function textChannelFor(channels: ReadonlyArray<CourtesyChannelLike>, phone: string): CourtesyChannelLike | null {
  const live = channels.filter((c) => c.kind === 'phone' && c.value.trim() && !c.optedOutAt)
  const key = phoneChannelKey(phone)
  return (key ? live.find((c) => phoneChannelKey(c.value) === key) : undefined) ?? live[0] ?? null
}
