import { phoneChannelKey } from './lienCourtesyContact'
import { parseCourtesyRecords } from './lienCourtesyNotice'

/**
 * A reply in Messages closes the courtesy notice (punch list #249, row 3; #262's call 2). `courtesyStatus`
 * has closed on `repliedAt` since v2.6259, and until v2.6674 nothing passed it: the GC or the owner answering
 * in Messages kept the press live and the Reminders strip's row on step 1. The owner's rule of 2026-11-07:
 * any inbound line from the GC's or the property owner's contacts newer than the sent notice's last courtesy
 * closes it, whatever thread it lands on, including a thread the office never texted from — a reply is an
 * answer whichever number or address it comes back on.
 *
 * Pure: whose line counts (`courtesyReplyContacts` — every contact on the GC's customer row, and the contact
 * whose channel holds the owner's number or address, mirroring what the press texts and emails), the newest
 * courtesy per job (`lastCourtesyAtByJob`, read off the first packet as `courtesyByJobFrom` reads it), and the
 * reply that closes each (`courtesyRepliedAtByJob`). `lienCourtesyReplyIo.ts` reads the rows; `useLienDeskData`
 * hands the answer to `courtesyByJobFrom`, so the footer, the Reminders strip and the Dashboard's lien month
 * read the one rule.
 */

/** Mirrors `contact_channel_key('email', …)`: lower-cased and trimmed, '' when it is no address. */
export function emailChannelKey(value: string | null | undefined): string {
  const e = (value ?? '').trim().toLowerCase()
  return e.includes('@') ? e : ''
}

export type CourtesyReplyParty = {
  /** The GC's customer id; null when the job names none. */
  gcCustomerId: string | null
  /** The owner of record's number and address as `resolveLienProperty` gives them; '' when none. */
  ownerPhone: string
  ownerEmail: string
}

export type CourtesyContactRow = { id: string; customer_id: string | null }
export type CourtesyChannelRow = { contact_id: string; kind: string; key: string | null }

/** The channel keys a party's owner would be found by, for the one read of `contact_channels`. */
export function courtesyReplyChannelKeys(parties: ReadonlyArray<Pick<CourtesyReplyParty, 'ownerPhone' | 'ownerEmail'>>): string[] {
  const keys = new Set<string>()
  for (const p of parties) {
    const phone = phoneChannelKey(p.ownerPhone)
    const email = emailChannelKey(p.ownerEmail)
    if (phone) keys.add(phone)
    if (email) keys.add(email)
  }
  return [...keys]
}

/**
 * The Messages contacts whose inbound line answers one notice: every contact on the GC's customer row (their
 * own thread and anyone's at the company the spine ties to it), and every contact whose phone or email channel
 * carries the owner of record's number or address. Nothing is made to find out; a party with no contact has none.
 */
export function courtesyReplyContacts(party: CourtesyReplyParty, contacts: ReadonlyArray<CourtesyContactRow>, channels: ReadonlyArray<CourtesyChannelRow>): string[] {
  const ids = new Set<string>()
  if (party.gcCustomerId) for (const c of contacts) if (c.customer_id === party.gcCustomerId) ids.add(c.id)
  const phone = phoneChannelKey(party.ownerPhone)
  const email = emailChannelKey(party.ownerEmail)
  for (const ch of channels) {
    if (!ch.key) continue
    if ((phone && ch.kind === 'phone' && ch.key === phone) || (email && ch.kind === 'email' && ch.key === email)) ids.add(ch.contact_id)
  }
  return [...ids]
}

/**
 * The newest courtesy press per job, ISO, read off the first packet the way `courtesyByJobFrom` reads the
 * records (letter two's `firstItemId`); a job whose packet carries no record is left out — a reply closes
 * nothing that never went.
 */
export function lastCourtesyAtByJob(
  letterTwoByJob: Readonly<Record<string, { firstItemId?: string | null } | undefined>>,
  items: ReadonlyArray<{ id: string; fields: unknown }>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [jobId, lt] of Object.entries(letterTwoByJob)) {
    const first = lt?.firstItemId ? items.find((i) => i.id === lt.firstItemId) ?? null : null
    const records = parseCourtesyRecords((first?.fields as { courtesy?: unknown } | null)?.courtesy)
    const last = records[records.length - 1]
    if (last) out[jobId] = last.at
  }
  return out
}

export type CourtesyReplyNotice = {
  jobId: string
  /** ISO — the newest courtesy press on the sent notice. */
  lastCourtesyAt: string
  /** The contacts whose line counts (`courtesyReplyContacts`). */
  contactIds: ReadonlyArray<string>
}

/** One inbound line as the read hands it: whose thread, and when. */
export type CourtesyInboundLine = { contactId: string; at: string }

/** Milliseconds since the epoch, NaN for a value that is no instant. */
const ms = (iso: string): number => Date.parse(iso)

/**
 * The newest inbound line after the notice's last courtesy on any of its contacts, as an ISO string in the
 * record's own form (`toISOString`), so `courtesyStatus`'s `repliedAt > last.at` compares like with like —
 * PostgREST hands `at` back with an offset, the record keeps a Z. Null when nothing came back since.
 */
export function courtesyRepliedAt(notice: CourtesyReplyNotice, lines: ReadonlyArray<CourtesyInboundLine>): string | null {
  const since = ms(notice.lastCourtesyAt)
  if (!Number.isFinite(since)) return null
  const mine = new Set(notice.contactIds)
  let newest = Number.NEGATIVE_INFINITY
  for (const l of lines) {
    if (!mine.has(l.contactId)) continue
    const at = ms(l.at)
    if (!Number.isFinite(at) || at <= since) continue
    if (at > newest) newest = at
  }
  return Number.isFinite(newest) ? new Date(newest).toISOString() : null
}

/** `courtesyRepliedAt` per notice, keyed by job; a job nobody answered is left out. */
export function courtesyRepliedAtByJob(notices: ReadonlyArray<CourtesyReplyNotice>, lines: ReadonlyArray<CourtesyInboundLine>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of notices) {
    const at = courtesyRepliedAt(n, lines)
    if (at) out[n.jobId] = at
  }
  return out
}

/** The earliest `lastCourtesyAt` across the notices — the read's floor; null with no notice. */
export function courtesyRepliesSince(notices: ReadonlyArray<Pick<CourtesyReplyNotice, 'lastCourtesyAt'>>): string | null {
  let floor: string | null = null
  for (const n of notices) if (Number.isFinite(ms(n.lastCourtesyAt)) && (floor === null || ms(n.lastCourtesyAt) < ms(floor))) floor = n.lastCourtesyAt
  return floor ? new Date(ms(floor)).toISOString() : null
}
