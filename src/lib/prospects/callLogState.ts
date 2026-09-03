/**
 * Call-log state helpers for the Follow Up workstation.
 *
 * "Called" (v2.2301) means the prospect has a `didnt_answer` / `answered`
 * comment on record. Two things went wrong around that definition:
 *
 * 1. Logging a call only patched the comments list — the called-ids set and
 *    the Prospect List's last-call map were rebuilt on the next full load, so
 *    the "never called" chip stayed up after Answered / Didn't Answer.
 * 2. Enter in the comment box files a plain `user_comment`. Callers type the
 *    call result there ("left a vm", "he answered and hung up on me"), press
 *    Enter, and the call never counts — the prospect stays "never called",
 *    the Activity report undercounts, warmth never moves.
 *
 * `findRetaggableNote` fixes (2) without a new step: when the composer is
 * empty and the caller's own plain note is the newest thing on the prospect
 * (within `RETAG_NOTE_WINDOW_MS`), Didn't Answer / Answered retag that note
 * into the call instead of filing a boilerplate "Contacted" row next to it.
 */

import type { CALL_INTERACTION_TYPES } from './callingOrder'

export type CallInteractionType = (typeof CALL_INTERACTION_TYPES)[number]

export type ProspectLastCallEntry = { interaction_type: string; created_at: string | null }

/** How long after typing a plain note the outcome buttons still claim it. */
export const RETAG_NOTE_WINDOW_MS = 10 * 60_000

export type RetaggableComment = {
  id: string
  created_by: string
  created_at: string | null
  interaction_type: string
}

/**
 * The caller's own plain note that Didn't Answer / Answered should turn into
 * the call, or null. Order-independent: picks the newest comment by
 * `created_at`, and only claims it when it is a `user_comment` by `userId`
 * filed within the window. Anything else newer (another user's note, an
 * outcome already logged) means the typed note was not "the call".
 */
export function findRetaggableNote<T extends RetaggableComment>(
  comments: readonly T[],
  userId: string,
  nowMs: number,
  windowMs: number = RETAG_NOTE_WINDOW_MS,
): T | null {
  let newest: T | null = null
  let newestMs = Number.NEGATIVE_INFINITY
  for (const c of comments) {
    const t = c.created_at ? new Date(c.created_at).getTime() : Number.NaN
    if (Number.isNaN(t)) continue
    if (t > newestMs) {
      newest = c
      newestMs = t
    }
  }
  if (!newest) return null
  if (newest.interaction_type !== 'user_comment') return null
  if (newest.created_by !== userId) return null
  if (nowMs - newestMs > windowMs) return null
  return newest
}

/** New set with `prospectId` marked as called (input untouched). */
export function withCalledProspect(ids: ReadonlySet<string>, prospectId: string): Set<string> {
  const next = new Set(ids)
  next.add(prospectId)
  return next
}

/** New map with `prospectId`'s latest call set (input untouched). */
export function withLastCall<T extends ProspectLastCallEntry>(
  map: Readonly<Record<string, T>>,
  prospectId: string,
  entry: T,
): Record<string, T> {
  return { ...map, [prospectId]: entry }
}
