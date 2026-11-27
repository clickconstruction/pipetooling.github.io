import type { AmendmentHow, AmendmentKind, AmendmentTarget } from './personAmendments'

/**
 * What the People → HR tab hands `dev_hr_entry_write` for a correction link (punch list #315, the audit's leak).
 *
 * The tab used to write `person_file_amendments` itself, as the signed-in dev. The table's guard answers before its
 * row policy, so a direct write by anyone signed in could learn where an id stood, and the direct grants could not be
 * revoked while the tab used them. The dev-gated door the dev seat already writes through carries both of the tab's
 * writes, so the tab uses it too: `amendments[]` for a link between two things already on the file, and
 * `withdraw_amendments[]` for a link taken off with its reason. The door stamps who made each from the sign-in.
 *
 * Pure, so the shapes are pinned by a test and not by a round trip.
 */
export type DoorLink = { from_kind: AmendmentKind; from_id: string; to_kind: AmendmentKind; to_id: string; how: AmendmentHow }

/** One link a target, from the newer thing to each older one. */
export function doorLinksPayload(input: { personId: string; fromKind: AmendmentKind; fromId: string; targets: ReadonlyArray<AmendmentTarget> }): { person_id: string; amendments: DoorLink[] } {
  return {
    person_id: input.personId,
    amendments: input.targets.map((t) => ({ from_kind: input.fromKind, from_id: input.fromId, to_kind: t.kind, to_id: t.id, how: t.how })),
  }
}

/** The door holds a reason to 200 characters, as the table's own check does. */
export const WITHDRAW_WHY_MAX = 200

/** One link taken off, with its reason trimmed and held to the door's length. */
export function doorWithdrawPayload(input: { personId: string; id: string; why: string }): { person_id: string; withdraw_amendments: Array<{ id: string; why: string }> } {
  return { person_id: input.personId, withdraw_amendments: [{ id: input.id, why: input.why.trim().slice(0, WITHDRAW_WHY_MAX) }] }
}

/**
 * The door raises when the link it is asked to take off is no longer live. The tab's old update changed no row then
 * and said nothing, and the person's wish holds either way: the link is off. So that one refusal reads as done.
 */
export function withdrawRefusalMeansAlreadyOff(message: string | null | undefined): boolean {
  return /\bno live link\b/.test(message ?? '')
}
