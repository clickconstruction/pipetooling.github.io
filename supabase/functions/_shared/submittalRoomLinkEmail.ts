/**
 * Submittals decision 11 (v2.5026, the owner's call of 2026-10-09): the app may send the room link.
 * What `send-submittal-room-link` reads from a request, why it refuses, the address it sends, and
 * the email a reviewer gets. Pure, no Deno API, so the app's tests run it
 * (`src/lib/submittals/submittalRoomLinkEmail.test.ts`) and What customers see builds its sample
 * with it.
 */

/** Each refusal and its status. The office reads each in its own words (`roomLinkRefusalWords`). */
export const ROOM_LINK_ERRORS = {
  badRequest: 400,
  signIn: 401,
  readOnly: 403,
  notFound: 404,
  personClosed: 409,
  roomClosed: 409,
  notShared: 409,
  noEmail: 422,
  sendFailed: 502,
  failed: 500,
} as const

export type RoomLinkErrorKey = keyof typeof ROOM_LINK_ERRORS

/** The office's own line in the email, at most this long. */
export const ROOM_LINK_NOTE_MAX = 1000

/** What the sender stamps: the event, the sent copy's kind and `email_send_log.email_type`. */
export const ROOM_LINK_EVENT = 'link_sent'
export const ROOM_LINK_KIND = 'submittal_room_link'

export type RoomLinkRequest = { personId: string; note: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** `{ person_id, note? }`, or null for anything else: the first check after the caller. */
export function parseRoomLinkRequest(body: unknown): RoomLinkRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const b = body as Record<string, unknown>
  const personId = typeof b.person_id === 'string' ? b.person_id.trim() : ''
  if (!UUID.test(personId)) return null
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return null
  const note = typeof b.note === 'string' ? b.note.trim() : ''
  if (note.length > ROOM_LINK_NOTE_MAX) return null
  return { personId, note }
}

/**
 * Why a send is refused, or null when it may go. In order: who presses (a training account or a
 * digital twin never emails a reviewer), the person and the room, a closed link or room, a room
 * nobody shared, and an address to send to.
 */
export function roomLinkRefusal(args: {
  caller: { read_only?: boolean | null; is_digital_twin?: boolean | null } | null
  person: { email: string | null; closed_at: string | null } | null
  room: { status: string; shared_at: string | null } | null
}): RoomLinkErrorKey | null {
  if (!args.caller) return 'signIn'
  if (args.caller.read_only || args.caller.is_digital_twin) return 'readOnly'
  if (!args.person || !args.room) return 'notFound'
  if (args.person.closed_at) return 'personClosed'
  if (args.room.status === 'closed') return 'roomClosed'
  if (!args.room.shared_at) return 'notShared'
  if (!EMAIL_SHAPE.test((args.person.email ?? '').trim())) return 'noEmail'
  return null
}

/** The page a personal token opens, as the office's Personal link copies it (`roomLink`). */
export function roomLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/submittal?t=${encodeURIComponent(token)}`
}

/**
 * The email as the sent copy keeps it: the reviewer's token shows as `?t=…`, as the law firm's link
 * does (docs/SENT_COPIES.md, *A key is never kept*). Done here rather than in `sentCopyKeptHtml`,
 * which every email function bundles.
 */
export function roomLinkKeptHtml(html: string): string {
  return html.replace(/([?&](?:amp;)?t=)[^"'&<\s]+/g, '$1…')
}

/** "B375 SpaceX BA-02N", as the reply email names the bid; "the project" with neither. */
export function roomLinkBidLabel(bid: { bid_number?: string | null; project_name?: string | null } | null): string {
  const number = (bid?.bid_number ?? '').trim()
  return [number ? `B${number}` : '', (bid?.project_name ?? '').trim()].filter(Boolean).join(' ') || 'the project'
}

export type RoomLinkEmailInput = {
  companyName: string
  phone: string
  bidLabel: string
  /** The revision on the page now, the newest shared; null names none. */
  revNumber: number | null
  personName: string
  /** Deciding, or only watching: the line about what they can do on the page. */
  mayDecide: boolean
  link: string
  /** The office's own line, as typed; empty for none. */
  note: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** The email a reviewer reads: the subject, the plain text and the HTML. */
export function buildSubmittalRoomLinkEmail(input: RoomLinkEmailInput): { subject: string; text: string; html: string } {
  const greet = `Hi ${firstName(input.personName) || 'there'},`
  const note = input.note.trim()
  const what = input.revNumber != null ? `Rev ${input.revNumber} of the submittal` : 'The submittal'
  const ready = `${what} for ${input.bidLabel} is ready for your review. It lists each product we plan to install. Where one differs from the plans, it says why.`
  const can = input.mayDecide ? 'On the page you can approve each product, send one back, or ask a question.' : 'On the page you can read every product and ask a question.'
  const yours = 'This link is yours. There is no password.'
  const sign = `${input.companyName}${input.phone ? ` · ${input.phone}` : ''}`
  const subject = `${input.companyName} shared ${input.revNumber != null ? `Rev ${input.revNumber} of ` : ''}the submittal for ${input.bidLabel}`
  const text = [greet, '', ...(note ? [note, ''] : []), ready, '', can, '', `Open the review: ${input.link}`, '', yours, '', sign].join('\n')
  const link = escapeHtml(input.link)
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1a2330;max-width:600px">
  <p>${escapeHtml(greet)}</p>
  ${note ? `<p style="white-space:pre-wrap">${escapeHtml(note)}</p>\n  ` : ''}<p>${escapeHtml(ready)}</p>
  <p>${escapeHtml(can)}</p>
  <p><a href="${link}" style="display:inline-block;background:#b0662f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open the review</a></p>
  <p style="color:#5b6577;font-size:12px;word-break:break-all">${link}</p>
  <p style="color:#5b6577;font-size:13px">${escapeHtml(yours)}</p>
  <p style="color:#5b6577;font-size:13px">${escapeHtml(sign)}</p>
</div>`
  return { subject, text, html }
}
