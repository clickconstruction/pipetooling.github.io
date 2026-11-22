/**
 * The claim on the firm's emails (v2.8228, punch list #85, a review residual): the pure rules
 * `legal-notify-dispatch` runs so that two runs that overlap cannot send the same email twice. No Deno
 * API here: `src/lib/legal/legalNotifyClaim.test.ts` runs it under vitest.
 *
 * Before, a run read the open rows, sent, and only then wrote what it had sent. A second run that
 * started before the first finished read the same rows and sent them again. Now a run claims first:
 *
 *   claim  — `legal_notify_claim_events` (the firm's oldest open events, `FOR UPDATE SKIP LOCKED`) and
 *            `legal_notify_claim_digest` (one person's digest) stamp a lease, `claimed_until` /
 *            `digest_claimed_until`, and answer only what this run now holds, as it stands now;
 *   send   — only what was claimed;
 *   mark   — the ledger or the digest's stamp is written and the claim let go in the same write.
 *
 * A send that fails is marked as a failed try and its claim let go, so the next five-minute tick takes it:
 * the twelve tries of `_shared/legalNotifyLedger.ts` keep their pace. A run that dies holds its rows only
 * until the lease is past, then they are tried again. Nothing is lost either way.
 *
 * Before the migration is pushed the claim functions do not exist. The dispatcher then runs as it did
 * before the claim (`missing`), so a deploy ahead of the push sends as before. Any other failure to claim
 * sends nothing this tick: the rows wait, and no email goes out unclaimed.
 */

/**
 * How long a claim holds, in seconds. Longer than a run can live (the platform ends a function within
 * 400 seconds), so a claim outlives its run only when the run died.
 */
export const LEGAL_NOTIFY_LEASE_SECONDS = 600

/** How many of a firm's open events one run claims, the fifty a tick has always read. */
export const LEGAL_NOTIFY_CLAIM_LIMIT = 50

/** Whether a row is free to claim: never claimed, or its lease is past. The two database functions hold the same rule. */
export function legalClaimFree(claimedUntil: string | null | undefined, nowIso: string): boolean {
  if (!claimedUntil) return true
  const until = new Date(claimedUntil).getTime()
  return !Number.isFinite(until) || until <= new Date(nowIso).getTime()
}

/** The lease a claim made at `nowIso` stamps. */
export function legalClaimLease(nowIso: string, seconds = LEGAL_NOTIFY_LEASE_SECONDS): string {
  return new Date(new Date(nowIso).getTime() + seconds * 1000).toISOString()
}

/**
 * How a call to a claim function ended:
 *   `claimed` — it answered, and the run holds what it answered;
 *   `missing` — the function is not in the database yet (before the push): run as before the claim;
 *   `failed`  — anything else: send nothing for these rows this tick.
 */
export type LegalClaimAnswer = 'claimed' | 'missing' | 'failed'

export function legalClaimAnswer(error: { code?: string | null; message?: string | null } | null | undefined): LegalClaimAnswer {
  if (!error) return 'claimed'
  const code = String(error.code ?? '')
  // PostgREST's "not in the schema cache" and Postgres's "function does not exist".
  if (code === 'PGRST202' || code === '42883') return 'missing'
  return 'failed'
}

/** What lets a claim go, written with the row's own mark. Empty when the row was read without a claim: the column may not exist yet. */
function release(claimed: boolean, column: 'claimed_until' | 'digest_claimed_until'): Record<string, null> {
  return claimed ? { [column]: null } : {}
}

/**
 * After an event's pass, the ledger write: who was sent, who failed and how many tries, and the claim let
 * go. A person whose send failed is tried by the next tick, not held for the lease.
 */
export function legalEventLedgerPatch(sentTo: unknown, claimed: boolean): Record<string, unknown> {
  return { sent_to: sentTo, ...release(claimed, 'claimed_until') }
}

/** The event's last write once every person is settled (or the ledger could not be kept): the stamp, and the claim let go. */
export function legalEventStampPatch(nowIso: string, claimed: boolean): Record<string, unknown> {
  return { sent_now_at: nowIso, ...release(claimed, 'claimed_until') }
}

/** A digest that went: the person's stamp, and the claim let go. */
export function legalDigestSentPatch(readAt: string, nowIso: string, claimed: boolean): Record<string, unknown> {
  return { last_digest_at: readAt, updated_at: nowIso, ...release(claimed, 'digest_claimed_until') }
}

/** A digest that did not go (the send failed, or its lines could not be read): only the claim is let go, so the next tick tries it. Null when there was no claim to let go. */
export function legalDigestReleasePatch(claimed: boolean): Record<string, null> | null {
  return claimed ? release(true, 'digest_claimed_until') : null
}

/**
 * The claims a run still holds when it ends early (a thrown error part way through its rows). They are let
 * go on the way out so the next tick takes them, not the tick after the lease.
 */
export function legalClaimLeftovers(claimed: Iterable<string>, written: Iterable<string>): string[] {
  const done = new Set(written)
  return [...new Set(claimed)].filter((id) => !done.has(id))
}

/** Claimed rows in the order they were queued: an update's answer comes back in no promised order. */
export function legalClaimedInOrder<T extends { created_at?: string | null }>(rows: ReadonlyArray<T>): T[] {
  return [...rows].sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
}
