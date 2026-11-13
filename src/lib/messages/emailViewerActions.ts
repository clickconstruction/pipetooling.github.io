/**
 * Messages, the email viewer's action row (v2.6509): which presses the message window offers, read from what the
 * window already knows about the line. Grace, 2026-11-04, on an invitation to bid in the viewer: "I like that we have
 * buttons like start a change order, but this item is a new bid, or it could be we found the bid elsewhere and just
 * want to attach this history to the bid so we know it is coming in from other sources, we need to add buttons to
 * offer this." Until now *Start a change order* (cut 4b) drew on every customer line that was not on a Pipeline job,
 * an invitation included, which has no change order to draft.
 *
 * The rule: a line on a bid offers **Open the bid**. An email that came in and reads as an invitation to bid, or that
 * is on no job, offers **Start a bid** (the New lane's *Bid it?* door, `start_bid_from_message`) and **Put it on a
 * bid…** (the tie through the Tied to row's own writer, then one line on the bid's log through `bid_log_message_in`,
 * so the bid's history says it came in from another source). **Start a change order** shows only on a line tied to a
 * GC project that is not an invitation. Copy, Print and Share are the window's own and stay on every line. Pure: the
 * hook (`useEmailViewerThreadSlots`) and cut 4b's hook both ask here, so one place decides the row.
 */
import type { UserRole } from '../../hooks/useAuth'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { whoMayDraft } from '../changeOrders/fromMessage'
import { KIND_WORDS, type InvitationKind } from '../emailIn/invitation'
import { canOpenMessages } from '../gc/access'
import { jobRefOf } from './jobKeys'
import type { MessageChannel, MessageDirection } from './thread'

/** A press the row may offer, in the row's order. */
export type ViewerPress = 'change_order' | 'start_bid' | 'put_on_bid' | 'open_bid'

export interface ViewerFacts {
  /** The line's tie as the window keys it: `bid:<id>`, `project:<id>`, `pipeline:<id>`, or null on the person. */
  jobId: string | null
  channel: MessageChannel
  direction: MessageDirection
  /** The reader marked the line an invitation to bid (`messages.invitation`), or the kernel reads it as one now. */
  invitation: boolean
  role: UserRole | null | undefined
}

/** The presses the row offers for a line, in order. Empty for someone off the office team, and on a note or an event. */
export function viewerPresses(f: ViewerFacts): ViewerPress[] {
  if (!canOpenMessages(f.role)) return []
  if (f.channel === 'event' || f.channel === 'note') return []
  const ref = jobRefOf(f.jobId)
  if (ref?.kind === 'bid') return ['open_bid']
  const emailIn = f.channel === 'email' && f.direction === 'in'
  if (emailIn && (f.invitation || ref === null)) return ['start_bid', 'put_on_bid']
  // A line on a GC project takes a change order (cut 4b); a line on a Pipeline job goes on its estimate (R8 · 8).
  if (ref?.kind === 'project' && !f.invitation && whoMayDraft(f.role)) return ['change_order']
  return []
}

/** Each press's label and the words its hover card says, in the shape of *Start a change order*'s. */
export const VIEWER_PRESS_WORDS: Readonly<Record<ViewerPress, { label: string; tip: string }>> = {
  change_order: { label: 'Start a change order', tip: 'Drafts a change order from this message, on the job it is tied to. The money team prices it and sends it.' },
  start_bid: { label: 'Start a bid', tip: 'Makes a bid from this email, with the name, the link and the due day. The customer is made if new. Ties this email to the bid and opens it.' },
  put_on_bid: { label: 'Put it on a bid…', tip: 'Ties this email to a bid you already have and writes it on the bid’s history, so the bid says it came in from here too.' },
  open_bid: { label: 'Open the bid', tip: 'Opens the bid this email is tied to.' },
}

/** The bid's name as the Start a bid field starts: what the reader read from the subject, else the subject itself. */
export function startBidName(line: { subject?: string | null }, invitation: { project: string | null } | null): string {
  return (invitation?.project ?? '').trim() || (line.subject ?? '').trim()
}

/**
 * The one line *Put it on a bid* writes on the bid's log: what came in, from whom and on what day, so the bid's history
 * says it reached us by email too. "Invitation to bid came in by email from Glenn Gelwin, Oct 22." A plain email names
 * its subject: "An email came in from Glenn Gelwin, Oct 22: Re: fixture schedule."
 */
export function putOnBidLogLine(line: { who: string; at: string; subject?: string | null }, kind: InvitationKind | null): string {
  const who = line.who.trim() || 'someone'
  const day = formatWorkDateYmdMonthDayShort(calendarYmdInAppTzFromIso(line.at))
  if (kind) return `${KIND_WORDS[kind]} came in by email from ${who}, ${day}.`
  const subject = (line.subject ?? '').trim()
  return `An email came in from ${who}, ${day}${subject ? `: ${subject}` : ''}.`
}

/** What the toast says once the email is on the bid: "Put on B512 Oak Hill Clinic. Its history says it came in by email." */
export function putOnBidWords(bid: { num: string; name: string }): string {
  return `Put on ${bid.num} ${bid.name}. Its history says it came in by email.`
}
