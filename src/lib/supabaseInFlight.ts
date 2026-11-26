/**
 * How many requests the Supabase client has in flight right now (punch list #365, v2.8616), and a wrapper for the
 * client's `fetch` that keeps the count. The short Dashboard's two count lines, the office's and the door's, are counts
 * over every source of the Needs you card, about sixty hooks, and until this file the page knew only when the two lien
 * reads were in: every other source landed after them and moved a number under the reader. Thirty-four of those hooks
 * say nothing about whether their read is in (their first value is the same as an empty one), so the one fact every
 * read shares is this count: a read is a request through this client, and the page is quiet when none is in flight.
 * The sibling of `wrapFetchCountingWrites` (`unsavedWork.ts`), which counts the writes alone for the auto-reload.
 */
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

let inFlight = 0
const listeners = new Set<() => void>()

function notify() {
  for (const cb of listeners) cb()
}

/** Requests in flight through the client at this moment: database, auth, storage and function calls alike. */
export function supabaseInFlightCount(): number {
  return inFlight
}

export function subscribeSupabaseInFlight(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Wrap a fetch so every request counts while it runs, however it ends. */
export function wrapFetchCountingInFlight(inner: FetchLike): FetchLike {
  return async (input, init) => {
    inFlight += 1
    notify()
    try {
      return await inner(input, init)
    } finally {
      inFlight -= 1
      notify()
    }
  }
}

/**
 * How long the client must have had nothing in flight before a page may call the reads in. A hook that reads B once
 * A has landed leaves the count at zero for a render between them, a few milliseconds; this covers that gap. It is a
 * guess about the gap and not a fact about the reads, which is why the page that reads it also keeps a cap.
 */
export const SUPABASE_QUIET_MS = 300

/** Test seam. */
export function __resetSupabaseInFlightForTests(): void {
  inFlight = 0
  listeners.clear()
}
