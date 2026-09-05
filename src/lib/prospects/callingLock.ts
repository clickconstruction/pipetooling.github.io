/**
 * Pure kernel for the Follow Up calling lock (journey-map Tier-1 #14(b),
 * J34-F5/N3 — "opening is a write"). A `prospect_calling_locks` row means
 * "someone is on the phone with this prospect right now", so the calling
 * queue hides it from the other callers. The lock is ADVISORY: it hides, it
 * never blocks.
 *
 * Before this kernel the row was written on VIEW (opening Follow Up announced
 * you as calling), never expired (a closed tab hid the prospect from every
 * caller forever — there was no reader of `locked_at`), and was upserted
 * `onConflict: 'prospect_id'` (viewing stole a colleague's live lock). Now:
 *
 *  - the lock is taken on INTENT — the first dial / composer focus / outcome
 *    click / Set callback on a prospect — never on view;
 *  - a row older than {@link CALLING_LOCK_TTL_MS} is stale: the queue ignores
 *    it and the next caller takes it over;
 *  - a live lock held by someone else is never stolen — the workstation says
 *    "<name> is calling this one" instead.
 */

/** A lock older than this is stale: ignored by readers, taken over by the next caller. */
export const CALLING_LOCK_TTL_MS = 30 * 60 * 1000

export type CallingLockRow = {
  prospect_id?: string
  user_id: string
  locked_at: string | null
}

export type CallingLockDecision = 'take' | 'held-by-other' | 'stale-take'

/** What the caller did that shows intent to work this prospect (telemetry tag). */
export type CallingLockTrigger = 'dial' | 'composer' | 'outcome' | 'callback'

/** True when the row is younger than the TTL. A missing/unparseable `locked_at` is never live. */
export function isCallingLockLive(
  row: Pick<CallingLockRow, 'locked_at'>,
  nowMs: number,
  ttlMs: number = CALLING_LOCK_TTL_MS,
): boolean {
  if (!row.locked_at) return false
  const at = Date.parse(row.locked_at)
  if (!Number.isFinite(at)) return false
  return nowMs - at < ttlMs
}

/**
 * Decide what taking the lock means given the row already on the table.
 *  - no row, or my own row → 'take' (write / refresh mine)
 *  - someone else's row older than the TTL → 'stale-take' (take it over)
 *  - someone else's live row → 'held-by-other' (do not write; show who)
 */
export function callingLockDecision({
  existing,
  now,
  me,
  ttlMs = CALLING_LOCK_TTL_MS,
}: {
  existing: CallingLockRow | null | undefined
  now: number
  me: string
  ttlMs?: number
}): CallingLockDecision {
  if (!existing) return 'take'
  if (existing.user_id === me) return 'take'
  if (!isCallingLockLive(existing, now, ttlMs)) return 'stale-take'
  return 'held-by-other'
}

/** ISO cutoff for the queue read: rows with `locked_at` before this are stale and must not hide anything. */
export function callingLockCutoffIso(nowMs: number, ttlMs: number = CALLING_LOCK_TTL_MS): string {
  return new Date(nowMs - ttlMs).toISOString()
}
