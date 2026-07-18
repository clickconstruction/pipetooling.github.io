/**
 * Per-id in-flight mutation locks for the Dashboard billing engine
 * (`useDashboardBillingInvoices`; issue 5 of the post-extraction billing
 * bug-review pass seeded by PR #385). A Set of in-flight ids replaces the old
 * single-slot `string | null` refs: the same-id double-click guard is
 * preserved exactly, while a mutation on a *different* id no longer overwrites
 * the slot (which used to break the first mutation's finally-cleanup and left
 * concurrent different-id mutations effectively unguarded).
 */

/** Returns true and records `id` as in flight; false if `id` already holds the lock. */
export function tryAcquireMutationLock(locks: Set<string>, id: string): boolean {
  if (locks.has(id)) return false
  locks.add(id)
  return true
}

/** Releases only `id`'s lock; other in-flight ids stay locked. No-op when not held. */
export function releaseMutationLock(locks: Set<string>, id: string): void {
  locks.delete(id)
}
