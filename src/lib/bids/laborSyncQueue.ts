/**
 * One Labor sync at a time per cost estimate (v2.4903). The Bids page can start several Labor loads
 * at once (a version switch re-runs its effect on each dependency that moves), and a sync plans its
 * writes from what it reads. Four at once each set the same rows aside on ZZ Test the night PR 0b
 * shipped. A sync queued here starts after the one before it has settled, so it reads what that one
 * left. A failed sync never blocks the next.
 */
const queue = new Map<string, Promise<void>>()

export function oneLaborSyncAtATime(key: string, run: () => Promise<void>): Promise<void> {
  const before = queue.get(key) ?? Promise.resolve()
  const next = before.then(() => run())
  const settled = next.then(() => undefined, () => undefined)
  queue.set(key, settled)
  void settled.then(() => {
    if (queue.get(key) === settled) queue.delete(key)
  })
  return next
}
