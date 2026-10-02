/**
 * See what they see (punch list #62), Layer 1 (v2.4174): one live line under the rows that says
 * what the GC's page will read, built from the draft as it stands through the room's own
 * kernel (`_shared/submittalRoomPayload.ts` — the function and the app import the same
 * file), so the office reads the reviewer's exact headline and subline, never a paraphrase.
 */
import { roomCounts, roomHeadline, roomRowsFrom, roomSubline, type RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

export type ReviewerLine = {
  /** "The GC's page will read" / "The GC's page reads". */
  lead: string
  /** The room's headline and subline, quoted as the reviewer sees them. */
  line: string
  /** What is true about visibility right now. */
  note: string
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

export function describeForReviewer(items: ReadonlyArray<RoomItemSource>, shared: boolean): ReviewerLine {
  const counts = roomCounts(roomRowsFrom(items.map(toRoomItemSource)))
  const sub = roomSubline(counts)
  return {
    lead: shared ? 'The GC’s page reads:' : 'The GC’s page will read:',
    line: `“${roomHeadline(counts)}”${sub ? ` — ${sub}` : ''}`,
    note: shared ? 'That is what the link shows now.' : 'The GC sees nothing until you share.',
  }
}
