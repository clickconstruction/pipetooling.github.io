/**
 * Whose call it is, when the office types a reviewer's decision (Submittals stage 5b): a
 * person already on the room, or one not on it yet with a name, an email and a role. One
 * row's editor and the whole-submittal approval both ask it the same way. Pure.
 */
import type { RoomRole } from '../../../supabase/functions/_shared/submittalRoomPayload'

/** An existing person on the room, or one not on it yet. */
export type ReviewerChoice = { id: string } | { name: string; email: string; role: RoomRole }

/** The picker's state: `person` is a room person's id, or "new" with the three fields typed. */
export type ReviewerPick = { person: string; name: string; email: string; role: RoomRole }

/** The picker's opening answer: the first open person who may decide, else the first person, else a new one. */
export function initialReviewerPick(people: ReadonlyArray<{ id: string; closed_at: string | null; may_decide: boolean | null }>): ReviewerPick {
  return { person: people.find((p) => !p.closed_at && p.may_decide)?.id ?? people[0]?.id ?? 'new', name: '', email: '', role: 'architect' }
}

/** A new reviewer needs a name and an email, so the record says whose call it is. */
export function reviewerPickBad(pick: ReviewerPick): boolean {
  return pick.person === 'new' && !(pick.name.trim() && /\S+@\S+\.\S+/.test(pick.email.trim()))
}

export function reviewerChoiceFrom(pick: ReviewerPick): ReviewerChoice {
  return pick.person === 'new' ? { name: pick.name.trim(), email: pick.email.trim(), role: pick.role } : { id: pick.person }
}
