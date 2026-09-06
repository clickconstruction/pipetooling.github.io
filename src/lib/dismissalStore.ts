/**
 * Alert dismissals follow the person (T5-08 / C27 kin J27-F6): the three dismissal kernels
 * (`bulkDeleteAlertDismiss`, `claimDevAlertDismiss`, `devRejectedNotificationDismiss`) keep
 * their synchronous localStorage contract; this store mirrors every save to
 * `user_dismissals` and, at sign-in, seeds localStorage from the server so a new phone
 * does not re-raise alerts the person already dismissed.
 *
 * The kernels stay pure: they call `pushDismissal`, which is a no-op until Layout registers
 * the server pusher at runtime (tests never register one).
 */

type Pusher = (userId: string, key: string, state: unknown) => void
let pusher: Pusher | null = null

export function registerDismissalPusher(fn: Pusher | null): void {
  pusher = fn
}

export function pushDismissal(prefix: string, userId: string, state: unknown): void {
  try {
    pusher?.(userId, prefix, state)
  } catch {
    /* never let a sync failure break the dismissal */
  }
}

/** Seed localStorage from the server rows (server wins only where the device has nothing). */
export function seedDismissalsIntoLocalStorage(userId: string, rows: ReadonlyArray<{ key: string; state: unknown }>): number {
  let seeded = 0
  for (const r of rows) {
    try {
      const lsKey = r.key + userId
      if (localStorage.getItem(lsKey) != null) continue
      localStorage.setItem(lsKey, JSON.stringify(r.state))
      seeded++
    } catch {
      /* private mode */
    }
  }
  return seeded
}
