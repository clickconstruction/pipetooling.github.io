/**
 * See what they see (punch list #62), Layer 1 (v2.4174): one live line under the rows that says
 * what the GC's page will read, built from the draft as it stands through the room's own
 * kernel (`_shared/submittalRoomPayload.ts` — the function and the app import the same
 * file), so the office reads the reviewer's exact headline and subline, never a paraphrase.
 *
 * v2.4593: the line and the window say what the link shows today. "The GC sees nothing until
 * you share" was false on every draft over a shared revision (BP398's Rev 4 draft, while the
 * link shows Rev 2), and "That is what the link shows now" was false once the room closed.
 */
import { roomCounts, roomHeadline, roomRowsFrom, roomSubline, type RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

export type ReviewerLine = {
  /** "The GC’s page will read:" / "The GC’s page reads:". */
  lead: string
  /** The room's headline and subline, quoted as the reviewer sees them. */
  line: string
  /** What the link shows today. */
  note: string
  /** The window's first sentences (What the GC sees). */
  intro: string
}

/** Where the revision on screen stands against the room's link. */
export type LinkView = {
  /** The revision on screen: the newest, the only one the line and the window describe. */
  rev: number
  /** The revision the link shows now (`linkShowsRevOf`); null while nothing is shared. */
  linkShowsRev: number | null
  /** The room is closed: its link says only that the review is closed. */
  roomClosed: boolean
}

/**
 * The revision the room's link shows now, by get-submittal-room's own rule: the newest revision
 * with a share date. A revision answered by email and never shared has none, so the link skips it.
 */
export function linkShowsRevOf(revisions: ReadonlyArray<{ rev_number: number; shared_at: string | null }>): number | null {
  let newest: number | null = null
  for (const r of revisions) if (r.shared_at && (newest == null || r.rev_number > newest)) newest = r.rev_number
  return newest
}

/** The room is closed for everyone on the link, by get-submittal-room's own test. */
export function isRoomClosed(room: { status?: string | null; closed_at?: string | null } | null | undefined): boolean {
  return !!room && (room.status === 'closed' || !!room.closed_at)
}

/** The stored item, narrowed to what the room reads. */
export function toRoomItemSource(item: RoomItemSource): RoomItemSource {
  return {
    id: item.id,
    tag: item.tag,
    sequence_order: item.sequence_order,
    specified_manufacturer: item.specified_manufacturer ?? null,
    specified_model: item.specified_model ?? null,
    specified_description: item.specified_description ?? null,
    submitted_manufacturer: item.submitted_manufacturer ?? null,
    submitted_model: item.submitted_model ?? null,
    submitted_label: item.submitted_label ?? null,
    status: item.status,
    reason_kind: item.reason_kind ?? null,
    reason_note: item.reason_note ?? null,
    lead_time_days: item.lead_time_days ?? null,
    sheet_pages: item.sheet_pages ?? null,
    review_decision: item.review_decision ?? null,
    review_note: item.review_note ?? null,
    reviewed_by_name: item.reviewed_by_name ?? null,
    reviewed_by_person_id: item.reviewed_by_person_id ?? null,
    reviewed_at: item.reviewed_at ?? null,
    order_only: item.order_only === true,
  }
}

/**
 * What the link shows today, for the revision on screen: the one place the line under the rows
 * and the window (What the GC sees) take their words about it, so the two cannot disagree.
 */
export function describeLink(view: LinkView): Omit<ReviewerLine, 'line'> {
  const live = !view.roomClosed && view.linkShowsRev === view.rev
  let note = 'The GC sees nothing until you share.'
  if (view.roomClosed) note = `The room is closed. Its link says only that the review is closed. ${view.linkShowsRev === view.rev ? 'Reopen it to show this again.' : `Reopen it, then share Rev ${view.rev}.`}`
  else if (live) note = 'That is what the link shows now.'
  else if (view.linkShowsRev != null) note = `Until you share Rev ${view.rev}, the link shows Rev ${view.linkShowsRev}.`
  return {
    lead: live ? 'The GC’s page reads:' : 'The GC’s page will read:',
    note,
    intro: `This is the page the GC ${live ? 'opens' : 'will open'} from your link. It is drawn from your rows as they stand.`,
  }
}

export function describeForReviewer(items: ReadonlyArray<RoomItemSource>, view: LinkView): ReviewerLine {
  const counts = roomCounts(roomRowsFrom(items.map(toRoomItemSource)))
  const sub = roomSubline(counts)
  return { ...describeLink(view), line: `“${roomHeadline(counts)}”${sub ? ` — ${sub}` : ''}` }
}
