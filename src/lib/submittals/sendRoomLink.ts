/**
 * Submittals decision 11 (v2.5026, the owner's call of 2026-10-09): the app may send the room link.
 * The one call the Share step makes to `send-submittal-room-link`, the office's words for each
 * refusal, and what the step reads back from the room's events. It never throws for a refusal: the
 * answer carries the key, and the step says it with `roomLinkRefusalWords`.
 */
import { supabase } from '../supabase'
import { ROOM_LINK_ERRORS, ROOM_LINK_EVENT, type RoomLinkErrorKey } from '../../../supabase/functions/_shared/submittalRoomLinkEmail'
import type { SubmittalEventRow, SubmittalPersonRow } from './submittalRoom'

export type RoomLinkAnswer = { ok: true; to: string; sentAt: string; recorded: boolean } | { ok: false; key: RoomLinkErrorKey; detail?: string }

const REFUSAL_WORDS: Record<RoomLinkErrorKey, string> = {
  badRequest: 'The server could not read the request. Reload the page and send it again.',
  signIn: 'Sign in again, then send the link.',
  readOnly: 'A training account cannot email a reviewer.',
  notFound: 'That person is no longer on this room. Reload the page.',
  personClosed: 'Their link is closed, so nothing was sent.',
  roomClosed: 'The room is closed. Reopen it to send the link.',
  notShared: 'Share a revision first. The link shows nothing until then.',
  noEmail: 'There is no email address on file for them.',
  sendFailed: 'The email did not go. Try again in a minute.',
  failed: 'Something went wrong on our side. Try again in a minute.',
}

/** The office's words for a refusal. */
export function roomLinkRefusalWords(key: RoomLinkErrorKey): string {
  return REFUSAL_WORDS[key]
}

/** The answer from the function's body, or from its error body. Anything unknown is `failed`. */
export function readRoomLinkAnswer(data: unknown, errorBody: unknown): RoomLinkAnswer {
  if (errorBody && typeof errorBody === 'object') {
    const e = errorBody as { error?: unknown; detail?: unknown }
    const key = typeof e.error === 'string' && Object.prototype.hasOwnProperty.call(ROOM_LINK_ERRORS, e.error) ? (e.error as RoomLinkErrorKey) : 'failed'
    return { ok: false, key, ...(typeof e.detail === 'string' && e.detail ? { detail: e.detail } : {}) }
  }
  const d = (data ?? null) as { ok?: unknown; to?: unknown; sentAt?: unknown; recorded?: unknown } | null
  if (d?.ok === true && typeof d.to === 'string' && typeof d.sentAt === 'string') return { ok: true, to: d.to, sentAt: d.sentAt, recorded: d.recorded !== false }
  return { ok: false, key: 'failed' }
}

/** Email one person their link, with the office's own line when there is one. */
export async function sendRoomLink(personId: string, note = ''): Promise<RoomLinkAnswer> {
  try {
    const line = note.trim()
    const r = await supabase.functions.invoke('send-submittal-room-link', { body: { person_id: personId, ...(line ? { note: line } : {}) } })
    const context = (r.error as { context?: { json?: () => Promise<unknown> } } | null)?.context
    const errorBody = r.error ? ((await context?.json?.().catch(() => null)) ?? { error: 'failed', detail: r.error.message }) : null
    return readRoomLinkAnswer(r.data, errorBody)
  } catch (e) {
    return { ok: false, key: 'failed', detail: e instanceof Error ? e.message : String(e) }
  }
}

/** The office has emailed a link from the app on this room: the Share window's box starts ticked from then on. */
export function roomHasSentLink(events: ReadonlyArray<Pick<SubmittalEventRow, 'event_type'>>): boolean {
  return events.some((e) => e.event_type === ROOM_LINK_EVENT)
}

/** A person the app can email: their link is open and an address is on file. */
export function canEmailLink(p: Pick<SubmittalPersonRow, 'email' | 'closed_at'>): boolean {
  return !p.closed_at && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((p.email ?? '').trim())
}

/** The line after the Share window's sends: how many went, and who did not get one. */
export function sharedLinksLine(sent: number, refused: ReadonlyArray<{ name: string; key: RoomLinkErrorKey }>): string {
  const went = sent === 0 ? 'No link was emailed.' : `Emailed ${sent === 1 ? 'one person their link' : `${sent} people their links`}.`
  if (refused.length === 0) return went
  return `${went} Not sent to ${refused.map((r) => r.name).join(', ')}: ${roomLinkRefusalWords(refused[0]!.key)}`
}
