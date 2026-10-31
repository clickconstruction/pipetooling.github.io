/**
 * A conversation handed on pings the person it went to (v2.6228, from the bids-inbox sorting review of 2026-10-31:
 * *Who has it?* moved a thread into a teammate's Mine and nobody's phone said so). The words of that push, pure and
 * light enough for the edge copy (`scripts/edge-kernels.mjs`): `messages-notify` builds it when the client says a
 * thread was just handed (`{ handed: { contact_id } }`), checks the hand is fresh and the caller's, and sends it to
 * the one person through the same web push as a customer's reply, their own push hours kept (`pushHours.ts`).
 */
import { messagesThreadHref } from '../gc/links'
import { snippetOf, type ThreadMessage } from './thread'

/** The `notification_history.template_type` the ping is recorded as. */
export const HANDED_TEMPLATE = 'message_handed'

/** A hand older than this is not pinged: the client calls right after the press, and nothing replays old hands. */
export const HANDED_FRESH_MINUTES = 15

/** How many characters of the last message the push carries. */
export const HANDED_BODY_MAX = 140

export interface HandedPushInput {
  contactId: string
  /** The conversation's name as the thread shows it: "Dale Ferris". */
  contactName: string
  /** Who handed it: "Rosa". */
  byName: string
  /** Their newest line in, for the push's words and the thread's landing. Null when they have none. */
  line: Pick<ThreadMessage, 'id' | 'channel' | 'subject' | 'body'> | null
}

export interface HandedPush {
  /** "Rosa handed you Dale Ferris" */
  title: string
  /** The last message's words, clipped, else "Open the thread." */
  body: string
  /** The thread, at the line when there is one. */
  url: string
  /** One per conversation on the device: a second hand of the same thread replaces the first. */
  tag: string
  messageId: string | null
}

const clip = (s: string, max: number): string => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`)

export function handedPush(input: HandedPushInput): HandedPush {
  const words = input.line ? snippetOf(input.line).replace(/\s+/g, ' ').trim() : ''
  return {
    title: `${input.byName.trim() || 'Someone'} handed you ${input.contactName.trim() || 'a conversation'}`,
    body: words ? clip(words, HANDED_BODY_MAX) : 'Open the thread.',
    url: messagesThreadHref(input.contactId, input.line?.id ?? null),
    tag: `handed:${input.contactId}`,
    messageId: input.line?.id ?? null,
  }
}

/** Whether a hand is fresh enough to ping: `has_since` within the last `HANDED_FRESH_MINUTES`. */
export function handedFresh(hasSinceIso: string | null | undefined, nowIso: string): boolean {
  if (!hasSinceIso) return false
  const since = Date.parse(hasSinceIso)
  const now = Date.parse(nowIso)
  return Number.isFinite(since) && Number.isFinite(now) && now - since >= 0 && now - since <= HANDED_FRESH_MINUTES * 60_000
}
