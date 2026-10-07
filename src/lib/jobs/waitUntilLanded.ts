/**
 * Wait for a write that lands somewhere else (v2.4521, pure). A Stripe bill closed from the
 * app is paid at Stripe at once, but our ledger is written by Stripe's webhook a moment
 * later. The board used to reload after a fixed 700 ms, and a slower webhook left the row in
 * its old section until someone refreshed the page. This asks `read` until it says the write
 * is in, or the time runs out.
 *
 * `read` is asked first right away, then every `intervalMs`. A read that throws counts as
 * "not yet". Resolves true the moment a read says yes; false when `timeoutMs` passes first.
 */
export type WaitUntilLandedOptions = {
  read: () => Promise<boolean>
  intervalMs: number
  timeoutMs: number
  /** Test seams; the defaults are the real clock. */
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export async function waitUntilLanded({ read, intervalMs, timeoutMs, sleep = realSleep, now = Date.now }: WaitUntilLandedOptions): Promise<boolean> {
  const deadline = now() + timeoutMs
  for (;;) {
    let landed = false
    try {
      landed = await read()
    } catch {
      landed = false
    }
    if (landed) return true
    if (now() + intervalMs > deadline) return false
    await sleep(intervalMs)
  }
}

function realSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
