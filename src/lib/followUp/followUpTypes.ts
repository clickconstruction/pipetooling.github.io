/**
 * Messages, cut 2: the row shapes a kernel reads from Follow up's columns, kept apart from `followUpRows.ts` so a kernel
 * that runs on the edge can read them. The copy of the kernels (`scripts/edge-kernels.mjs`) refuses a type taken from a
 * file that runs code of its own; this file imports nothing, so it never is (R5's push on `messages-notify` reads
 * `messages/hasRule.ts` through it). `followUpRows.ts` re-exports each, so its readers need no change.
 */

/** The conversation's state and who has it: cut 2's columns on a `contacts` row. */
export interface ContactFollowUpRow {
  state: string
  snoozed_until: string | null
  has_user_id: string | null
  has_since: string | null
  has_how: string | null
  /** How they asked to hear from us (v2.5597): text, email, either, or null for nobody said. */
  prefers?: string | null
}
