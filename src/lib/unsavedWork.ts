/**
 * What is unsaved right now (v2.3741) — the two signals the auto-reload gate
 * (src/lib/autoReload.ts) reads before reloading at a quiet moment.
 *
 * 1. Holds: a component that holds work not yet saved says so while it does
 *    (`useHoldsUnsavedWork(dirty || saving, 'Legal firm settings')`). Anything not tagged is
 *    simply unknown to the gate, which is why the gate also refuses over a focused field or an
 *    open dialog — the holds cover the inline editors those two miss.
 * 2. In-flight writes: every non-GET request through the Supabase client is counted between
 *    send and response (`wrapFetchCountingWrites`), so a reload never lands mid-POST — the person
 *    could not tell whether the save went through.
 */
let nextHoldId = 1
const holds = new Map<number, string>()
const listeners = new Set<() => void>()

function notify() {
  for (const cb of listeners) cb()
}

/** Register unsaved work; call the returned function to release it. */
export function holdUnsavedWork(label: string): () => void {
  const id = nextHoldId++
  holds.set(id, label)
  notify()
  let released = false
  return () => {
    if (released) return
    released = true
    holds.delete(id)
    notify()
  }
}

export function unsavedHoldCount(): number {
  return holds.size
}

export function unsavedHoldLabels(): string[] {
  return [...holds.values()]
}

export function subscribeUnsavedWork(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

let inFlightWrites = 0

export function inFlightWriteCount(): number {
  return inFlightWrites
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const fromInit = init?.method
  if (typeof fromInit === 'string' && fromInit) return fromInit.toUpperCase()
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase()
  return 'GET'
}

/** Wrap a fetch so every request that is not GET / HEAD / OPTIONS counts as a write while it runs. */
export function wrapFetchCountingWrites(inner: FetchLike): FetchLike {
  return async (input, init) => {
    const method = requestMethod(input, init)
    const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
    if (!isWrite) return inner(input, init)
    inFlightWrites += 1
    notify()
    try {
      return await inner(input, init)
    } finally {
      inFlightWrites -= 1
      notify()
    }
  }
}

/** Test seam. */
export function __resetUnsavedWorkForTests(): void {
  holds.clear()
  inFlightWrites = 0
  listeners.clear()
}
