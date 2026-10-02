/**
 * Who answered, when the office types a reviewer's decision (Submittals stage 5b): a person
 * already on the room, the bid's GC as a company, one of the GC's contacts the app already
 * holds, or someone else with a name (an email only if the office has one). One row's answer
 * window and the whole-submittal approval both ask it the same way. Pure.
 */
import type { RoomRole } from '../../../supabase/functions/_shared/submittalRoomPayload'

/** An existing person on the room, or one not on it yet. The email is the room's key for a person who comes back; without one they are known by name. */
export type ReviewerChoice = { id: string } | { name: string; email: string | null; role: RoomRole }

/** The picker's state: `person` is a room person's id, `gc`, `contact:<id>`, or `new` with the three fields typed. */
export type ReviewerPick = { person: string; name: string; email: string; role: RoomRole }

/** What the bid already knows about who could answer: its GC and the GC's contacts on file. */
export type ReviewerSources = { gcName: string | null; contacts: ReadonlyArray<{ id: string; name: string; email: string | null }> }

export const NO_REVIEWER_SOURCES: ReviewerSources = { gcName: null, contacts: [] }

type RoomPerson = { id: string; name: string | null; email?: string | null; closed_at: string | null; may_decide: boolean | null }

const same = (a: string | null | undefined, b: string | null | undefined): boolean => !!a?.trim() && a.trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/** The GC as a pick: offered unless a person on the room already carries that name. */
export function gcOffered(people: ReadonlyArray<RoomPerson>, sources: ReviewerSources): boolean {
  return !!sources.gcName?.trim() && !people.some((p) => !p.closed_at && same(p.name, sources.gcName))
}

/** The GC's contacts not on the room yet: matched by email, or by name when neither has one. */
export function contactsOffered(people: ReadonlyArray<RoomPerson>, sources: ReviewerSources): ReviewerSources['contacts'] {
  const open = people.filter((p) => !p.closed_at)
  return sources.contacts.filter((c) => c.name.trim() && !open.some((p) => (c.email?.trim() ? same(p.email, c.email) : same(p.name, c.name))))
}

/** The picker's opening answer: the first open person who may decide, else the bid's GC, else the first person, else a new one. */
export function initialReviewerPick(people: ReadonlyArray<RoomPerson>, sources: ReviewerSources = NO_REVIEWER_SOURCES): ReviewerPick {
  const decider = people.find((p) => !p.closed_at && p.may_decide)?.id
  return { person: decider ?? (gcOffered(people, sources) ? 'gc' : people[0]?.id ?? 'new'), name: '', email: '', role: 'architect' }
}

const EMAIL = /\S+@\S+\.\S+/

/** A new reviewer needs a name. An email is optional, and has to read as one when typed. */
export function reviewerPickBad(pick: ReviewerPick): boolean {
  if (pick.person !== 'new') return false
  const email = pick.email.trim()
  return !pick.name.trim() || (email !== '' && !EMAIL.test(email))
}

export function reviewerChoiceFrom(pick: ReviewerPick, sources: ReviewerSources = NO_REVIEWER_SOURCES): ReviewerChoice {
  if (pick.person === 'new') return { name: pick.name.trim(), email: pick.email.trim() || null, role: pick.role }
  if (pick.person === 'gc') return { name: (sources.gcName ?? '').trim(), email: null, role: 'builder' }
  if (pick.person.startsWith('contact:')) {
    const c = sources.contacts.find((x) => `contact:${x.id}` === pick.person)
    if (c) return { name: c.name.trim(), email: c.email?.trim() || null, role: 'builder' }
  }
  return { id: pick.person }
}

/**
 * The person on the room a typed reviewer is: the one with that email, else (no email typed)
 * the one with that name and no email of their own. Null means a new person joins the room.
 */
export function matchRoomPerson<P extends { id: string; name: string | null; email: string | null }>(people: ReadonlyArray<P>, choice: { name: string; email: string | null }): P | null {
  const email = choice.email?.trim()
  if (email) return people.find((p) => same(p.email, email)) ?? null
  return people.find((p) => !p.email?.trim() && same(p.name, choice.name)) ?? null
}
